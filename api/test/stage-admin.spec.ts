/**
 * 情景闯关后台管理（StageService.adminXxx）单测（剧本 → 关卡 结构）。
 * 重点钉住：概览按剧本分组、会话按 storyId 筛选与标题、强制结束状态机、详情消息完整返回。
 */
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { GamifyService } from '../src/modules/client/gamify/gamify.service.js';
import type { TextChatProvider } from '../src/common/ai/text-chat.provider.js';
import type { ImageGenApiProvider } from '../src/common/ai/image-gen.provider.js';
import type { FileService } from '../src/common/file/file.service.js';
import { StageService } from '../src/modules/client/stage/stage.service.js';
import { makeStageScriptMock, makeStageStoryMock, seedScriptRows, seedStoryRows } from './helpers/stage-story-mock.js';

function makeService() {
  const scripts = seedScriptRows();
  const stories = seedStoryRows(scripts);
  const stageScript = makeStageScriptMock(scripts);
  const stageStory = makeStageStoryMock(stories);
  const categories = scripts.map((row, index) => ({
    id: row.categoryId,
    name: row.name.replace(' · 默认剧本', ''),
    nameEn: null,
    icon: null,
    status: 1,
    sort: index,
  }));

  const sessions: Array<Record<string, any>> = [];
  const messages: Array<Record<string, any>> = [];

  const prisma: any = {
    sentenceCategory: {
      findMany: vi.fn(async () => categories),
      findUnique: vi.fn(async (args: any) => categories.find((c) => c.id === args.where.id) ?? null),
      findFirst: vi.fn(async (args: any) => categories.find((c) => c.name === args.where.name) ?? null),
    },
    stageScript,
    stageStory,
    studyStageProgress: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      groupBy: vi.fn(async (args: any) =>
        args?.where?.dialogueClearedAt ? [{ storyId: stories[0].id, _count: { _all: 2 } }] : [],
      ),
      count: vi.fn(async () => 0),
    },
    stageDialogueSession: {
      findMany: vi.fn(async (args: any) => {
        const rows = sessions.filter((row) => args?.where?.storyId === undefined || row.storyId === args.where.storyId);
        return rows.map((row) => ({
          ...row,
          _count: { messages: messages.filter((m) => m.sessionId === row.id).length },
        }));
      }),
      findFirst: vi.fn(async (args: any) => {
        const rows = sessions.filter(
          (row) =>
            (args?.where?.userId === undefined || row.userId === args.where.userId) &&
            (args?.where?.storyId === undefined || row.storyId === args.where.storyId) &&
            (args?.where?.status === undefined || row.status === args.where.status),
        );
        return rows.at(-1) ?? null;
      }),
      findUnique: vi.fn(async (args: any) => sessions.find((row) => row.id === args.where.id) ?? null),
      update: vi.fn(async (args: any) => {
        const row = sessions.find((item) => item.id === args.where.id);
        Object.assign(row!, args.data);
        return row;
      }),
      groupBy: vi.fn(async (args: any) => {
        if (args.by.includes('userId')) {
          return [{ userId: 7n, storyId: stories[0].id, _count: { _all: 1 } }];
        }
        return [{ storyId: stories[0].id, _count: { _all: 1 }, _avg: { turnCount: 8 } }];
      }),
      count: vi.fn(
        async (args: any) =>
          sessions.filter((row) => args?.where?.storyId === undefined || row.storyId === args.where.storyId).length,
      ),
    },
    stageDialogueMessage: {
      findMany: vi.fn(async (args: any) =>
        messages.filter((row) => row.sessionId === args.where.sessionId).sort((a, b) => Number(a.id - b.id)),
      ),
    },
    clientUser: {
      findMany: vi.fn(async () => [{ id: 7n, nickname: '小明' }]),
      findUnique: vi.fn(async () => ({ nickname: '小明', xp: 100 })),
    },
    clientXpLog: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
    },
    sentence: { groupBy: vi.fn(async () => []) },
    $queryRaw: vi.fn(async () => [{ sid: stories[0].id, cnt: 1 }]),
    $transaction: async (arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg)),
  };

  const gamify = { awardXp: vi.fn(), checkAchievements: vi.fn() };
  const ai = { stageDialogueTurn: vi.fn(), stageDialogueSummary: vi.fn(), generateStageStory: vi.fn() };
  const imageGen = { generate: vi.fn() };
  const fileService = {
    save: vi.fn(),
    findById: vi.fn(async (_id?: number): Promise<{ fileUrl: string } | null> => null),
  };
  const service = new StageService(
    prisma as unknown as PrismaService,
    gamify as unknown as GamifyService,
    ai as unknown as TextChatProvider,
    imageGen as unknown as ImageGenApiProvider,
    fileService as unknown as FileService,
  );
  return { service, prisma, scripts, stories, sessions, messages, categories, imageGen, fileService };
}

describe('adminOverview：按剧本分组', () => {
  it('每组 = 一个剧本，关卡统计按 storyId 聚合', async () => {
    const { service, stories, scripts } = makeService();
    const chapters = await service.adminOverview();
    expect(chapters.length).toBeGreaterThan(0);
    const first = chapters[0];
    expect(first.key).toBe(`script-${scripts[0].id}`);
    expect(first.name).toBe(scripts[0].name);
    expect(first.stages[0].id).toBe(Number(stories[0].id));
    expect(first.stages[0].scriptName).toBe(scripts[0].name);
    expect(first.stages[0].sessionCount).toBeGreaterThanOrEqual(0);
  });
});

describe('adminSessionList / Detail：按 storyId 工作', () => {
  it('列表按 storyId 筛选，标题取关卡标题', async () => {
    const { service, sessions, stories, messages } = makeService();
    sessions.push({
      id: 1n,
      userId: 7n,
      storyId: stories[0].id,
      categoryId: 1n,
      status: 'completed',
      turnCount: 8,
      goalReached: true,
      cleared: true,
      showTranslation: true,
      translationUsed: false,
      startedAt: new Date(),
      endedAt: new Date(),
    });
    messages.push({
      id: 1n,
      sessionId: 1n,
      role: 'npc',
      speaker: 'Maya',
      contentEn: 'Hi',
      contentZh: '嗨',
      createdAt: new Date(),
    });

    const { list, total } = await service.adminSessionList({ storyId: Number(stories[0].id) });
    expect(total).toBe(1);
    expect(list[0].storyId).toBe(Number(stories[0].id));
    expect(list[0].stageTitle).toBe(stories[0].title);
    expect(list[0].nickname).toBe('小明');

    const detail = await service.adminSessionDetail(1);
    expect(detail.messages).toHaveLength(1);
    expect(detail.stageTitle).toBe(stories[0].title);
  });

  it('强制结束：active → ended，且不改 cleared/进度', async () => {
    const { service, sessions, stories } = makeService();
    sessions.push({
      id: 2n,
      userId: 7n,
      storyId: stories[0].id,
      categoryId: 1n,
      status: 'active',
      turnCount: 2,
      goalReached: false,
      cleared: false,
      showTranslation: true,
      translationUsed: false,
      startedAt: new Date(),
      endedAt: null,
    });
    await service.adminCloseSession(2);
    expect(sessions[0].status).toBe('ended');
    expect(sessions[0].cleared).toBe(false);
    expect(sessions[0].endedAt).toBeTruthy();
  });
});

describe('批量生成剧本封面（补全缺失 / 批量重生）', () => {
  /** 造一张真实 PNG buffer，喂给 normalizeGeneratedImage 走真实 sharp 链路。 */
  async function pngBuffer(): Promise<Buffer> {
    const sharp = (await import('sharp')).default;
    return sharp({ create: { width: 800, height: 600, channels: 3, background: '#88a' } })
      .png()
      .toBuffer();
  }

  it('force=false 只补缺失封面，已有封面（且文件存在）的跳过', async () => {
    const { service, scripts, imageGen, fileService } = makeService();
    scripts[0].coverFileId = 100n;
    scripts[1].coverFileId = 101n;
    fileService.findById.mockImplementation(async (id?: number) =>
      id !== undefined && id >= 100 ? { fileUrl: `http://x/${id}.webp` } : null,
    );
    imageGen.generate.mockResolvedValue({ buffer: await pngBuffer() });
    fileService.save.mockResolvedValue({ file: { id: 900n, fileUrl: 'http://x/new.webp' } });

    const result = await service.generateMissingScriptCovers();
    expect(result.skipped).toEqual([1, 2]);
    expect(result.generated).toHaveLength(scripts.length - 2);
    expect(result.failed).toEqual([]);
  });

  it('force=true 全部启用剧本都重生成，已有封面也不跳过', async () => {
    const { service, scripts, imageGen, fileService } = makeService();
    for (const row of scripts) row.coverFileId = 100n + row.id;
    fileService.findById.mockResolvedValue({ fileUrl: 'http://x/old.webp' });
    imageGen.generate.mockResolvedValue({ buffer: await pngBuffer() });
    fileService.save.mockResolvedValue({ file: { id: 901n, fileUrl: 'http://x/new.webp' } });

    const result = await service.regenerateAllScriptCovers();
    expect(result.generated).toHaveLength(scripts.length);
    expect(result.skipped).toEqual([]);
    expect(result.failed).toEqual([]);
    // 每个剧本的 cover_file_id 都被回写成新文件
    expect(scripts.every((row) => row.coverFileId === 901n)).toBe(true);
  });

  it('单个剧本生图失败进 failed，不影响其他剧本', async () => {
    const { service, scripts, imageGen, fileService } = makeService();
    imageGen.generate.mockImplementation(async () => {
      if (imageGen.generate.mock.calls.length === 2) throw new Error('quota exceeded');
      return { buffer: await pngBuffer() };
    });
    fileService.save.mockResolvedValue({ file: { id: 902n, fileUrl: 'http://x/new.webp' } });

    const result = await service.regenerateAllScriptCovers();
    expect(result.failed).toEqual([2]);
    expect(result.generated).toHaveLength(scripts.length - 1);
  });
});
