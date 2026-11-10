/**
 * 情景闯关「关卡 CRUD」单测（stage_story 表迁移后的行为契约）。
 *
 * 钉住：
 * 1. 种子回填幂等：onModuleInit 只补缺失 category，已存在的行（含运营改过的标题）不覆盖；
 * 2. getStages 完全走库表：停用的关卡不下发，章内按 sort 排序；
 * 3. 新增校验：分类不存在/已停用/已被占用、章节不存在、开场白 speaker 不在角色里、minTurns>maxTurns 都拒；
 * 4. 编辑：category 不允许改（历史进度按分类记录）；
 * 5. 停用/删除/重排序的行为与边界。
 */
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { GamifyService } from '../src/modules/client/gamify/gamify.service.js';
import type { AgnesSentenceProvider } from '../src/common/ai/agnes-sentence.provider.js';
import type { AgnesImageProvider } from '../src/common/ai/agnes-image.provider.js';
import type { FileService } from '../src/common/file/file.service.js';
import { StageService } from '../src/modules/client/stage/stage.service.js';
import { STAGE_CHAPTERS, STAGE_STORIES } from '../src/modules/client/stage/stage-stories.js';
import { makeStageStoryMock, seedRows, type StageStoryRow } from './helpers/stage-story-mock.js';

const EXTRA_CATEGORY = '全新场景';

function makeService(opts?: { storyRows?: StageStoryRow[] }) {
  const categoryNames = [...new Set([...STAGE_STORIES.map((item) => item.category), EXTRA_CATEGORY])];
  const categories = categoryNames.map((name, index) => ({
    id: BigInt(index + 1),
    name,
    nameEn: null,
    icon: null,
    status: 1,
    sort: index,
  }));
  const stageStory = makeStageStoryMock(opts?.storyRows);

  const prisma: any = {
    sentenceCategory: {
      findMany: vi.fn(async (args?: any) =>
        args?.where?.status !== undefined ? categories.filter((c) => c.status === args.where.status) : categories,
      ),
      findUnique: vi.fn(async (args: any) => categories.find((c) => c.id === args.where.id) ?? null),
      findFirst: vi.fn(async (args: any) => categories.find((c) => c.name === args.where.name) ?? null),
    },
    studyStageProgress: {
      findMany: vi.fn(async () => []),
      groupBy: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    clientXpLog: {
      findMany: vi.fn(async () => []),
    },
    stageDialogueSession: {
      findMany: vi.fn(async () => []),
      groupBy: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    sentence: {
      groupBy: vi.fn(async () => []),
    },
    stageChapterCover: {
      findMany: vi.fn(async () => []),
    },
    stageStory,
    $queryRaw: vi.fn(async () => []),
    $transaction: async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => Promise<unknown>)(prisma);
      return Promise.all(arg as Promise<unknown>[]);
    },
  };

  const gamify = { awardXp: vi.fn(), checkAchievements: vi.fn() };
  const ai = { stageDialogueTurn: vi.fn(), stageDialogueSummary: vi.fn() };
  const imageGen = { generate: vi.fn() };
  const fileService = { save: vi.fn(), findById: vi.fn(async () => null) };
  const service = new StageService(
    prisma as unknown as PrismaService,
    gamify as unknown as GamifyService,
    ai as unknown as AgnesSentenceProvider,
    imageGen as unknown as AgnesImageProvider,
    fileService as unknown as FileService,
  );
  return { service, prisma, stageStory, categories };
}

const NEW_STORY = {
  chapterKey: 'arrive',
  category: EXTRA_CATEGORY,
  title: '新关卡：雨夜咖啡馆',
  intro: '你推开门，雨声被关在门外。',
  outro: '你撑着伞走进雨里。',
  userRole: '路过的行人',
  setting: '雨夜的街角咖啡馆，暖黄灯光。',
  goal: '点一杯热饮并和老板聊两句',
  minTurns: 4,
  maxTurns: 10,
  rewardXp: 30,
  roles: [{ nameEn: 'Sam', name: '老板 Sam', persona: '慢条斯理，喜欢听故事', emoji: '🧑‍🍳' }],
  opening: [{ speaker: 'Sam', contentEn: 'Raining hard tonight.', contentZh: '今晚雨很大。' }],
  starterHints: [{ en: 'A hot chocolate, please.', zh: '一杯热巧克力。' }],
};

describe('onModuleInit 种子回填：幂等，不覆盖已有行', () => {
  it('空表时把 STAGE_STORIES 全部写入', async () => {
    const { service, stageStory } = makeService({ storyRows: [] });
    await service.onModuleInit();
    expect(stageStory.rows).toHaveLength(STAGE_STORIES.length);
    expect(stageStory.rows[0].category).toBe(STAGE_STORIES[0].category);
    expect(stageStory.rows[0].roles).toEqual(STAGE_STORIES[0].roles);
  });

  it('已有同 category 的行跳过（运营改过的标题不被覆盖）', async () => {
    const rows = seedRows();
    rows[0] = { ...rows[0], title: '运营改过的标题' };
    const { service, stageStory } = makeService({ storyRows: rows });
    await service.onModuleInit();
    expect(stageStory.rows).toHaveLength(STAGE_STORIES.length);
    expect(stageStory.rows[0].title).toBe('运营改过的标题');
  });
});

describe('getStages 走库表：停用隐藏、按 sort 排序', () => {
  it('启用关卡按 sort 下发；status=0 的关卡不出现在地图里', async () => {
    const rows = seedRows();
    // 把第一章前两关顺序调反
    const [a, b] = rows;
    rows[0] = { ...a, sort: 20 };
    rows[1] = { ...b, sort: 10 };
    // 停用「居家生活」那关
    const home = rows.find((row) => row.category === '居家生活')!;
    Object.assign(home, { status: 0 });
    const { service } = makeService({ storyRows: rows });

    const overview = await service.getStages(1);
    const arrive = overview.chapters.find((chapter) => chapter.key === 'arrive')!;
    // 停用的不出现
    expect(arrive.stages.some((stage) => stage.name === '居家生活')).toBe(false);
    // 章内按 sort：购物消费(3) 在 日常生活(20) 前面
    expect(arrive.stages.map((stage) => stage.name)).toEqual(['购物消费', '日常生活']);
    expect(overview.totalStages).toBe(overview.chapters.reduce((sum, c) => sum + c.total, 0));
  });
});

describe('createStory 新增校验', () => {
  it('正常新增：落到该章 sort 末尾，返回 id', async () => {
    const { service, stageStory } = makeService();
    const result = await service.createStory(NEW_STORY);
    expect(result.id).toBeGreaterThan(0);
    const created = stageStory.rows.find((row) => row.category === EXTRA_CATEGORY)!;
    expect(created.title).toBe(NEW_STORY.title);
    expect(created.status).toBe(1);
    const arriveMax = Math.max(...stageStory.rows.filter((r) => r.chapterKey === 'arrive').map((r) => r.sort));
    expect(created.sort).toBe(arriveMax);
  });

  it('分类已被占用 → 409；分类不存在 → 400；章节不存在 → 400', async () => {
    const { service } = makeService();
    await expect(service.createStory({ ...NEW_STORY, category: '日常生活' })).rejects.toMatchObject({ code: 409 });
    await expect(service.createStory({ ...NEW_STORY, category: '不存在的分类' })).rejects.toMatchObject({ code: 400 });
    await expect(service.createStory({ ...NEW_STORY, chapterKey: 'nope' })).rejects.toMatchObject({ code: 400 });
  });

  it('开场白 speaker 不在角色里 → 400；minTurns > maxTurns → 400', async () => {
    const { service } = makeService();
    await expect(
      service.createStory({ ...NEW_STORY, opening: [{ speaker: 'Ghost', contentEn: 'Boo', contentZh: ' uh' }] }),
    ).rejects.toMatchObject({ code: 400 });
    await expect(service.createStory({ ...NEW_STORY, minTurns: 20, maxTurns: 5 })).rejects.toMatchObject({ code: 400 });
  });
});

describe('updateStory：category 不可改，其余字段可改', () => {
  it('改标题成功；改 category 被拒', async () => {
    const { service, stageStory } = makeService();
    const first = stageStory.rows[0];
    await service.updateStory(Number(first.id), { title: '改过的标题' });
    expect(stageStory.rows[0].title).toBe('改过的标题');
    await expect(service.updateStory(Number(first.id), { category: EXTRA_CATEGORY })).rejects.toMatchObject({
      code: 400,
    });
  });

  it('关卡不存在 → 404', async () => {
    const { service } = makeService();
    await expect(service.updateStory(9999, { title: 'x' })).rejects.toMatchObject({ code: 404 });
  });
});

describe('停用 / 删除 / 重排序', () => {
  it('停用后 getStages 不再下发该关卡；重新启用又回来', async () => {
    const { service, stageStory } = makeService();
    const first = stageStory.rows[0];
    await service.setStoryStatus(Number(first.id), 0);
    let overview = await service.getStages(1);
    expect(overview.chapters.flatMap((c) => c.stages).some((s) => s.name === first.category)).toBe(false);
    await service.setStoryStatus(Number(first.id), 1);
    overview = await service.getStages(1);
    expect(overview.chapters.flatMap((c) => c.stages).some((s) => s.name === first.category)).toBe(true);
  });

  it('删除物理删行并返回关联会话数；删不存在 → 404', async () => {
    const { service, stageStory } = makeService();
    const before = stageStory.rows.length;
    const result = await service.deleteStory(Number(stageStory.rows[0].id));
    expect(result).toHaveProperty('sessionCount');
    expect(stageStory.rows).toHaveLength(before - 1);
    await expect(service.deleteStory(9999)).rejects.toMatchObject({ code: 404 });
  });

  it('重排序：同章 ids 重写 sort；混入其他章 → 400', async () => {
    const { service, stageStory } = makeService();
    const arriveIds = stageStory.rows.filter((r) => r.chapterKey === 'arrive').map((r) => Number(r.id));
    const reversed = [...arriveIds].reverse();
    await service.reorderStories('arrive', reversed);
    const sorted = stageStory.rows
      .filter((r) => r.chapterKey === 'arrive')
      .sort((a, b) => a.sort - b.sort)
      .map((r) => Number(r.id));
    expect(sorted).toEqual(reversed);

    const workId = Number(stageStory.rows.find((r) => r.chapterKey === 'work')!.id);
    await expect(service.reorderStories('arrive', [workId, ...arriveIds])).rejects.toMatchObject({ code: 400 });
  });
});

describe('adminStories 列表', () => {
  it('返回全部关卡（含停用），带 chapterName 与统计字段', async () => {
    const { service, stageStory } = makeService();
    stageStory.rows[0] = { ...stageStory.rows[0], status: 0 };
    const list = await service.adminStories();
    expect(list).toHaveLength(STAGE_STORIES.length);
    expect(list[0]).toMatchObject({
      chapterName: STAGE_CHAPTERS.find((c) => c.key === list[0].chapterKey)?.name,
      status: expect.any(Number),
      sessionCount: expect.any(Number),
      participantCount: expect.any(Number),
      clearedCount: expect.any(Number),
    });
    expect(list.some((item) => item.status === 0)).toBe(true);
    expect(list[0].categoryId).toBeGreaterThan(0);
  });
});
