import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { QuestionsService } from '../src/modules/client/questions/questions.service.js';
import { SentenceService } from '../src/modules/sentence/sentence.service.js';
import { SENTENCE_STATUS, type SaveSentenceDto } from '../src/modules/sentence/sentence.dto.js';

/**
 * 「无配图题不下发」的保险丝。
 *
 * 生成链路本来保证 status=ready 与 image_file_id 同一条 update 写入，
 * 但运营手工改状态 / 补图脚本中途放行 / sys_file 记录被删都可能留下脏数据。
 * 这里钉住：新题池、题库池、复习池、加权池、题库计数**全部**带图片过滤，
 * 且管理端不允许把无图题直接置 ready。
 */

type Where = Record<string, unknown>;

interface Pickers {
  pickReadySentence: (
    excludeIds: number[],
    difficulty?: number,
    mastery?: Array<{ sentenceId: number; correctCount: number; lastCorrectAt: Date }>,
    suppressedIds?: number[],
  ) => Promise<number | null>;
  pickBankSentence: (
    where: Where,
    excludeIds: number[],
    mastery: Array<{ sentenceId: number; correctCount: number; lastCorrectAt: Date }>,
    suppressedIds: number[],
  ) => Promise<number | null>;
  pickDueReviewSentence: (userId: number, excludeIds: number[], suppressedIds?: number[]) => Promise<number | null>;
  filterMasteryBySentence: (
    mastery: Array<{ sentenceId: number; correctCount: number; lastCorrectAt: Date }>,
    baseWhere: Where,
    excludeIds: number[],
    suppressedIds: number[],
  ) => Promise<unknown[]>;
  listFestivals: () => Promise<unknown[]>;
}

/** 记录每次查询的 where，count/findMany 都返回空集以便抽题提前收敛。 */
function makePrisma(sentenceRows: Array<Record<string, unknown>> = []) {
  const countWhere: Where[] = [];
  const recordWhere: Where[] = [];
  const groupByWhere: Where[] = [];
  const findManySelect: Array<Record<string, unknown>> = [];
  const prisma = {
    sentence: {
      count: vi.fn(async (args: { where: Where }) => {
        countWhere.push(args.where);
        return 0;
      }),
      findMany: vi.fn(async (args: { where: Where; select?: Record<string, unknown> }) => {
        findManySelect.push(args.select ?? {});
        return sentenceRows;
      }),
      findFirst: vi.fn(async () => null),
      groupBy: vi.fn(async (args: { where: Where }) => {
        groupByWhere.push(args.where);
        return [];
      }),
    },
    sentenceRecord: {
      findMany: vi.fn(async (args: { where: Where }) => {
        recordWhere.push(args.where);
        return [];
      }),
    },
    sentenceCategory: { findMany: vi.fn(async () => []) },
  };
  const service = new QuestionsService(
    prisma as unknown as PrismaService,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return {
    pickers: service as unknown as Pickers,
    countWhere,
    recordWhere,
    groupByWhere,
    findManySelect,
  };
}

const readyWithImage = { status: 'ready', retiredAt: null, imageFileId: { gt: 0n } };
const masteryEntry = [{ sentenceId: 9, correctCount: 10, lastCorrectAt: new Date() }];

describe('抽题层的配图过滤', () => {
  it('新题池与题库池的 count 都要求已有配图', async () => {
    const { pickers, countWhere } = makePrisma();

    await pickers.pickReadySentence([], undefined, [], []);
    await pickers.pickBankSentence({ festivalName: '春节' }, [], [], []);

    expect(countWhere).toHaveLength(2);
    for (const where of countWhere) {
      expect(where).toMatchObject(readyWithImage);
    }
    expect(countWhere[1]).toMatchObject({ festivalName: '春节' });
  });

  it('复习池的 sentence 条件同样要求已有配图', async () => {
    const { pickers, recordWhere } = makePrisma();

    await pickers.pickDueReviewSentence(1, [], []);

    expect(recordWhere).toHaveLength(1);
    expect(recordWhere[0].sentence).toMatchObject(readyWithImage);
  });

  it('加权池（按 id 直接抽，绕过 count）剔除无图题', async () => {
    const noImage = makePrisma([
      { id: 9n, status: 'ready', retiredAt: null, difficulty: 2, festivalName: null, categoryId: 1n, imageFileId: 0n },
    ]);
    const empty = await noImage.pickers.filterMasteryBySentence(masteryEntry, readyWithImage, [], []);
    expect(empty).toEqual([]);
    expect(noImage.findManySelect[0]).toHaveProperty('imageFileId', true);

    const withImage = makePrisma([
      { id: 9n, status: 'ready', retiredAt: null, difficulty: 2, festivalName: null, categoryId: 1n, imageFileId: 7n },
    ]);
    const kept = await withImage.pickers.filterMasteryBySentence(masteryEntry, readyWithImage, [], []);
    expect(kept).toHaveLength(1);
  });

  it('节日本题库计数只算真正可抽的题', async () => {
    const { pickers, groupByWhere } = makePrisma();

    await pickers.listFestivals();

    expect(groupByWhere[0]).toMatchObject(readyWithImage);
    expect(groupByWhere[0]).toMatchObject({ festivalName: { not: null } });
  });
});

function makeSentenceService(row: { id: bigint; imageFileId: bigint } | null) {
  const created: Array<Record<string, unknown>> = [];
  const updated: Array<Record<string, unknown>> = [];
  const create = vi.fn(async (args: { data: Record<string, unknown> }) => {
    created.push(args.data);
    return { id: 1n };
  });
  const update = vi.fn(async (args: { data: Record<string, unknown> }) => {
    updated.push(args.data);
    return {};
  });
  const prisma = {
    sentence: {
      findUnique: vi.fn(async () => row),
      findFirst: vi.fn(async () => null),
      create,
      update,
    },
  };
  const service = new SentenceService(prisma as unknown as PrismaService, {} as never);
  return { service, create, update, created, updated };
}

const baseDto: SaveSentenceDto = {
  categoryId: 1,
  sentenceEn: 'Hello there.',
  translationZh: '你好呀',
  status: SENTENCE_STATUS.READY,
};

describe('管理端上架校验', () => {
  it('手工新建题不允许直接置 ready（此时必然无图）', async () => {
    const { service, create } = makeSentenceService(null);

    await expect(service.create(baseDto)).rejects.toThrow(/配图/);
    expect(create).not.toHaveBeenCalled();
  });

  it('无图旧题编辑时置 ready 会被拒绝', async () => {
    const { service, update } = makeSentenceService({ id: 3n, imageFileId: 0n });

    await expect(service.update(3, baseDto)).rejects.toThrow(/配图/);
    expect(update).not.toHaveBeenCalled();
  });

  it('已有配图的题可以正常编辑上架', async () => {
    const { service, update, updated } = makeSentenceService({ id: 3n, imageFileId: 42n });

    await service.update(3, baseDto);

    expect(update).toHaveBeenCalledTimes(1);
    expect(updated[0]).toMatchObject({ status: SENTENCE_STATUS.READY });
  });

  it('未指定状态时沿用默认待生成，不受影响', async () => {
    const { service, create, created } = makeSentenceService(null);
    const dto = { ...baseDto, status: undefined };

    await service.create(dto);

    expect(create).toHaveBeenCalledTimes(1);
    expect(created[0]).toMatchObject({ status: SENTENCE_STATUS.PENDING_IMAGE });
  });
});
