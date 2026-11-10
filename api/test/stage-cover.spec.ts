/**
 * 情景闯关「章节封面 AI 生图」单测。
 *
 * 钉住四条不变量：
 * 1. 生成链路：imageGen 生图 → sharp 转 webp → file 落盘 → stage_chapter_cover upsert，
 *    返回的 coverUrl 来自 file 表；prompt = 章节场景描述 + 统一风格后缀（含 no text 约束）。
 * 2. 幂等：已有封面且 regenerate=false 时直接返回已有 URL，不重复调用生图接口。
 * 3. regenerate=true 强制重生成（upsert 走 update 分支）。
 * 4. 补生成任务只补缺失章节，单章失败不影响其他章；getStages/adminCovers 正确下发 coverUrl。
 */
import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { GamifyService } from '../src/modules/client/gamify/gamify.service.js';
import type { AgnesSentenceProvider } from '../src/common/ai/agnes-sentence.provider.js';
import type { AgnesImageProvider } from '../src/common/ai/agnes-image.provider.js';
import type { FileService } from '../src/common/file/file.service.js';
import { StageService } from '../src/modules/client/stage/stage.service.js';
import { STAGE_CHAPTERS, STAGE_COVER_STYLE_SUFFIX } from '../src/modules/client/stage/stage-stories.js';

/** 生成一张最小的合法 PNG（避开 sharp 读坏图抛错，专注状态流转）。 */
async function tinyPng(): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: '#ffffff' } })
    .png()
    .toBuffer();
}

interface CoverRow {
  id: bigint;
  chapterKey: string;
  fileId: bigint;
  prompt: string;
  generatedAt: Date;
}

function makeService(opts?: { failOnKeys?: string[] }) {
  const categories = [
    { id: 1n, name: '日常生活', nameEn: 'Daily Life', icon: '☀️' },
    { id: 2n, name: '居家生活', nameEn: 'Home Life', icon: '🏠' },
    // 来自另一章（work），保证 overview 里至少出现两个章节，便于断言「未生成章节 coverUrl 为 null」
    { id: 3n, name: '职场办公', nameEn: 'Work', icon: '💼' },
  ];
  const covers: CoverRow[] = [];
  let coverSeq = 100n;
  const files = new Map<bigint, { fileUrl: string }>();
  let fileSeq = 500n;

  const prisma: any = {
    sentenceCategory: {
      findMany: vi.fn(async () => categories),
    },
    studyStageProgress: {
      findMany: vi.fn(async () => []),
    },
    clientXpLog: {
      findMany: vi.fn(async () => []),
    },
    stageDialogueSession: {
      findMany: vi.fn(async () => []),
    },
    sentence: {
      groupBy: vi.fn(async () => []),
    },
    stageChapterCover: {
      findMany: vi.fn(async ({ where }: any) => {
        if (where?.chapterKey?.in) return covers.filter((c) => where.chapterKey.in.includes(c.chapterKey));
        return covers;
      }),
      findUnique: vi.fn(async ({ where }: any) => covers.find((c) => c.chapterKey === where.chapterKey) ?? null),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const existing = covers.find((c) => c.chapterKey === where.chapterKey);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row: CoverRow = {
          id: coverSeq++,
          chapterKey: create.chapterKey,
          fileId: create.fileId,
          prompt: create.prompt,
          generatedAt: new Date(),
        };
        covers.push(row);
        return row;
      }),
    },
  };

  const gamify = { awardXp: vi.fn(), checkAchievements: vi.fn() };
  const ai = { stageDialogueTurn: vi.fn(), stageDialogueSummary: vi.fn() };
  const imageGen = {
    generate: vi.fn(async (prompt: string, _options: { size: string; ratio: string }) => {
      const key = STAGE_CHAPTERS.find((c) => prompt.includes(c.coverPrompt))?.key;
      if (key && opts?.failOnKeys?.includes(key)) throw new Error('生图接口炸了');
      return { buffer: await tinyPng(), mimeType: 'image/png' };
    }),
  };
  const fileService = {
    save: vi.fn(async (name: string, _mime: string, _buffer: Buffer, _uploader: unknown) => {
      const id = fileSeq++;
      const fileUrl = `/uploads/${name}`;
      files.set(id, { fileUrl });
      return { duplicated: false, file: { id, fileUrl } };
    }),
    findById: vi.fn(async (id: number) => {
      const hit = files.get(BigInt(id));
      return hit ? { id: BigInt(id), fileUrl: hit.fileUrl } : null;
    }),
  };

  const service = new StageService(
    prisma as unknown as PrismaService,
    gamify as unknown as GamifyService,
    ai as unknown as AgnesSentenceProvider,
    imageGen as unknown as AgnesImageProvider,
    fileService as unknown as FileService,
  );
  return { service, prisma, covers, files, imageGen, fileService, categories };
}

describe('generateChapterCover：AI 生图链路与幂等', () => {
  it('生成封面：prompt 含章节场景描述 + 风格后缀（no text），落盘后 upsert 并返回 coverUrl', async () => {
    const { service, covers, imageGen, fileService } = makeService();
    const chapter = STAGE_CHAPTERS[0];

    const result = await service.generateChapterCover(chapter.key);

    expect(imageGen.generate).toHaveBeenCalledTimes(1);
    const prompt = imageGen.generate.mock.calls[0][0] as string;
    expect(prompt).toContain(chapter.coverPrompt);
    expect(prompt).toContain(STAGE_COVER_STYLE_SUFFIX);
    expect(prompt).toContain('no text');
    // 生图参数走 config.stage.cover*（4:3 封面卡）
    expect(imageGen.generate.mock.calls[0][1]).toMatchObject({ ratio: '4:3' });

    expect(fileService.save).toHaveBeenCalledTimes(1);
    expect(fileService.save.mock.calls[0][0]).toBe(`stage-cover-${chapter.key}.webp`);
    expect(fileService.save.mock.calls[0][1]).toBe('image/webp');

    expect(covers).toHaveLength(1);
    expect(covers[0].chapterKey).toBe(chapter.key);
    expect(covers[0].prompt).toBe(prompt);
    expect(result).toEqual({ chapterKey: chapter.key, coverUrl: `/uploads/stage-cover-${chapter.key}.webp` });
  });

  it('已有封面且 regenerate=false：直接返回已有 URL，不重复生图', async () => {
    const { service, imageGen } = makeService();
    const chapter = STAGE_CHAPTERS[0];
    const first = await service.generateChapterCover(chapter.key);
    imageGen.generate.mockClear();

    const second = await service.generateChapterCover(chapter.key);
    expect(imageGen.generate).not.toHaveBeenCalled();
    expect(second.coverUrl).toBe(first.coverUrl);
  });

  it('regenerate=true：强制重生成，upsert 走更新分支（仍一行）', async () => {
    const { service, covers, imageGen } = makeService();
    const chapter = STAGE_CHAPTERS[0];
    await service.generateChapterCover(chapter.key);
    imageGen.generate.mockClear();

    await service.generateChapterCover(chapter.key, true);
    expect(imageGen.generate).toHaveBeenCalledTimes(1);
    expect(covers).toHaveLength(1);
  });

  it('未知 chapterKey 抛 404', async () => {
    const { service } = makeService();
    await expect(service.generateChapterCover('nope')).rejects.toMatchObject({ code: 404 });
  });
});

describe('generateMissingChapterCovers：只补缺失，单章失败不影响其他', () => {
  it('已有封面的章节跳过；缺失的生成；失败的记入 failed', async () => {
    const { service, covers, imageGen } = makeService({ failOnKeys: [STAGE_CHAPTERS[1].key] });
    // 预置第一章已有封面
    await service.generateChapterCover(STAGE_CHAPTERS[0].key);
    imageGen.generate.mockClear();

    const result = await service.generateMissingChapterCovers();
    expect(result.skipped).toEqual([STAGE_CHAPTERS[0].key]);
    expect(result.generated).toEqual([STAGE_CHAPTERS[2].key, STAGE_CHAPTERS[3].key]);
    expect(result.failed).toEqual([STAGE_CHAPTERS[1].key]);
    // 第一章没有被重新生成
    expect(imageGen.generate).toHaveBeenCalledTimes(3);
    expect(covers.map((c) => c.chapterKey).sort()).toEqual(
      STAGE_CHAPTERS.filter((c) => c.key !== STAGE_CHAPTERS[1].key)
        .map((c) => c.key)
        .sort(),
    );
  });
});

describe('getStages / adminCovers 下发 coverUrl', () => {
  it('getStages：已生成封面的章节带 coverUrl，未生成的为 null', async () => {
    const { service } = makeService();
    const chapter = STAGE_CHAPTERS[0];
    await service.generateChapterCover(chapter.key);

    const overview = await service.getStages(1);
    const hit = overview.chapters.find((c) => c.key === chapter.key);
    expect(hit?.coverUrl).toBe(`/uploads/stage-cover-${chapter.key}.webp`);
    const missing = overview.chapters.find((c) => c.key !== chapter.key);
    expect(missing?.coverUrl).toBeNull();
  });

  it('adminCovers：每章一行，含 coverUrl / prompt / generatedAt', async () => {
    const { service } = makeService();
    await service.generateChapterCover(STAGE_CHAPTERS[0].key);

    const list = await service.adminCovers();
    expect(list).toHaveLength(STAGE_CHAPTERS.length);
    const hit = list.find((item) => item.chapterKey === STAGE_CHAPTERS[0].key);
    expect(hit?.coverUrl).toBe(`/uploads/stage-cover-${STAGE_CHAPTERS[0].key}.webp`);
    expect(hit?.generatedAt).not.toBeNull();
    expect(hit?.prompt).toContain(STAGE_COVER_STYLE_SUFFIX);
    const missing = list.find((item) => item.chapterKey !== STAGE_CHAPTERS[0].key);
    expect(missing?.coverUrl).toBeNull();
    expect(missing?.generatedAt).toBeNull();
    // 未生成的行回落展示该章的场景描述
    expect(missing?.prompt).toBe(STAGE_CHAPTERS.find((c) => c.key === missing?.chapterKey)?.coverPrompt);
  });
});
