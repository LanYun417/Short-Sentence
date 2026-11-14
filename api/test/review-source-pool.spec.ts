import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { QuestionsService } from '../src/modules/client/questions/questions.service.js';

/**
 * 复习口径修正的测试（P1「复习中心打通」的后端半边）。
 *
 * 背景：抽题与复习池历史上都写死 `isCorrect: 0`（只收错题），
 * 而答对题同样会按间隔重复排 nextReviewAt，记忆健康页也按这批题统计
 * 「今日待复习」——结果是曲线上有的题用户永远刷不到，数字与内容对不上。
 *
 * 这里守三条：
 * 1. 到期复习题（pickDueReviewSentence）**不限 isCorrect**，按 nextReviewAt 到期为准；
 * 2. 复习池（listReview）同口径，并返回 isCorrect 供前端区分「错题/巩固」徽章；
 * 3. `next(..., 'review')` 只抽到期复习题（复习要成串），无到期题时明确 404。
 */

/** 捕获 sentenceRecord.findMany 的 where，便于断言口径。 */
function makeService(options?: { dueRows?: Array<{ sentenceId: bigint }> }) {
  const dueWhere: Array<Record<string, unknown>> = [];
  const listWhere: Array<Record<string, unknown>> = [];
  const listSelect: Array<Record<string, unknown>> = [];
  const dueRows = options?.dueRows ?? [{ sentenceId: 7n }];
  let recordFindManyCalls = 0;

  const prisma: any = {
    sentence: {
      findUnique: vi.fn(async (args: { where: { id: bigint } }) => ({
        id: args.where.id,
        sentenceEn: 'go',
        alternateAnswers: null,
        translationZh: '走',
        ipa: null,
        explanation: null,
        imageFileId: 5n,
        categoryId: 4n,
        difficulty: 1,
        festivalName: null,
        festivalDate: null,
        wordMeanings: null,
        category: { name: '餐饮美食' },
      })),
      findFirst: vi.fn(async () => ({
        id: 1n,
        sentenceEn: 'go',
        alternateAnswers: null,
        translationZh: '走',
        ipa: null,
        explanation: null,
        imageFileId: 5n,
        categoryId: 4n,
        category: { name: '餐饮美食' },
      })),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => []),
    },
    sentenceRecord: {
      findUnique: vi.fn(async () => null),
      count: vi.fn(async () => 0),
      create: vi.fn(async () => ({ id: 1 })),
      groupBy: vi.fn(async () => []),
    },
    sentenceFavorite: { findUnique: vi.fn(async () => null) },
  };

  // sentenceRecord.findMany 被三个地方复用，按调用次序与 select 形状区分：
  //   第 1 次 = recentSentenceIds（防重窗口，select 只有 sentenceId）
  //   之后 select 只有 sentenceId 的那次 = pickDueReviewSentence
  //   select 含 nextReviewAt 的那次 = listReview（带 skip/take）
  prisma.sentenceRecord.findMany = vi.fn(async (args: any) => {
    const select = (args.select ?? {}) as Record<string, unknown>;
    if ('nextReviewAt' in select) {
      listWhere.push(args.where);
      listSelect.push(args.select);
      return [
        {
          createdAt: new Date(),
          isCorrect: 1,
          reviewLevel: 2,
          nextReviewAt: new Date(),
          sentence: {
            id: 11n,
            sentenceEn: 'a coffee please',
            translationZh: '请给我一杯咖啡',
            ipa: null,
            explanation: null,
            imageFileId: 0n,
            difficulty: 1,
            category: { name: '餐饮美食' },
          },
        },
      ];
    }
    // 只选 sentenceId：首次是防重窗口，其后才是到期复习题
    if (recordFindManyCalls === 0) {
      recordFindManyCalls += 1;
      return [{ sentenceId: 1n }, { sentenceId: 2n }];
    }
    dueWhere.push(args.where);
    return dueRows;
  });

  const service = new QuestionsService(
    prisma as unknown as PrismaService,
    { findById: vi.fn(async () => ({ fileUrl: 'http://x/y.webp' })) } as never,
    { getToday: vi.fn(async () => null), recordAnswer: vi.fn(async () => {}) } as never,
    {
      awardXp: vi.fn(async () => 0),
      checkAchievements: vi.fn(async () => []),
      awardBadge: vi.fn(async () => {}),
    } as never,
    { recordAnswer: vi.fn(async () => {}) } as never,
  );
  return { service, dueWhere, listWhere, listSelect };
}

describe('到期复习题口径', () => {
  it("next(..., 'review') 只走复习分支并标 source=review", async () => {
    const { service } = makeService();
    const question = await service.next(1, undefined, undefined, undefined, 'review');

    // buildNextQuestion 依据传入的 source 打标记；答对题到期同样应能出现在这里
    expect(question.source).toBe('review');
    expect(question.sentenceId).toBe(7);
  });

  it('没有到期题时 source=review 明确 404，不静默回落新题', async () => {
    const { service } = makeService({ dueRows: [] });
    await expect(service.next(1, undefined, undefined, undefined, 'review')).rejects.toMatchObject({
      code: 404,
    });
  });

  it('到期题判定只看 nextReviewAt，不再写死 isCorrect: 0', async () => {
    const { service, dueWhere } = makeService({ dueRows: [] });
    // 触发一次 pickDueReviewSentence（source=review 命中即调用）
    await service.next(1, undefined, undefined, undefined, 'review').catch(() => undefined);

    const where = dueWhere[0] as Record<string, unknown>;
    expect(where.isCorrect).toBeUndefined();
    expect(where.nextReviewAt).toMatchObject({ lte: expect.any(Date) });
  });
});

describe('复习池列表口径', () => {
  it('listReview 不限 isCorrect 且返回该字段（前端区分错题/巩固）', async () => {
    const { service, listWhere, listSelect } = makeService();
    const result = await service.listReview(1, {});

    const where = listWhere[0] as Record<string, unknown>;
    expect(where.isCorrect).toBeUndefined();
    expect(where.nextReviewAt).toMatchObject({ lte: expect.any(Date) });

    // select 必须取 isCorrect，否则前端拿不到徽章依据
    expect(listSelect[0]).toMatchObject({ isCorrect: true });
    expect(result.list[0]?.isCorrect).toBe(true);
  });
});
