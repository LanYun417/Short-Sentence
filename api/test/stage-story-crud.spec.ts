/**
 * 情景闯关「剧本 / 关卡 CRUD」单测（场景 → 剧本 → 关卡 重构后的行为契约）。
 *
 * 钉住：
 * 1. 种子回填幂等：onModuleInit 按分类建默认剧本、补缺失关卡，不覆盖已有改动；
 * 2. 剧本 CRUD：新增校验（分类存在/启用、同场景重名 409）、编辑、启停、删除（连删关卡）；
 * 3. 关卡 CRUD：挂剧本、校验（角色/开场白/minTurns）、编辑可换剧本、启停、删除、剧本内重排；
 * 4. getStages 停用剧本/关卡不下发。
 */
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { GamifyService } from '../src/modules/client/gamify/gamify.service.js';
import type { TextChatProvider } from '../src/common/ai/text-chat.provider.js';
import type { ImageGenApiProvider } from '../src/common/ai/image-gen.provider.js';
import type { FileService } from '../src/common/file/file.service.js';
import { StageService } from '../src/modules/client/stage/stage.service.js';
import { STAGE_STORIES } from '../src/modules/client/stage/stage-stories.js';
import { makeStageScriptMock, makeStageStoryMock, seedScriptRows, seedStoryRows } from './helpers/stage-story-mock.js';

const NEW_SCRIPT = { categoryId: 1, name: '程序员的一天', blurb: '写代码、开会、改需求' };

const NEW_STORY = {
  scriptId: 1,
  title: '晨会 standup',
  intro: '九点半，你端着咖啡走进会议室。',
  outro: '你把自己的进度说清楚了。',
  userRole: '新入职的工程师',
  setting: '清晨的会议室，白板上写满了任务卡片。',
  goal: '用英语汇报昨天完成的进度和今天的计划',
  minTurns: 4,
  maxTurns: 10,
  rewardXp: 30,
  roles: [{ nameEn: 'Alex', name: '组长 Alex', persona: '语速快但耐心', emoji: '🧑‍💼' }],
  opening: [
    { speaker: 'Alex', contentEn: 'Morning! What did you finish yesterday?', contentZh: '早！昨天完成了什么？' },
  ],
  starterHints: [{ en: 'I finished the login page.', zh: '我完成了登录页。' }],
};

function makeService(opts?: { emptyDb?: boolean }) {
  const scripts = opts?.emptyDb ? [] : seedScriptRows();
  const stories = opts?.emptyDb ? [] : seedStoryRows(scripts);
  const stageScript = makeStageScriptMock(scripts);
  const stageStory = makeStageStoryMock(stories);
  const categories = (opts?.emptyDb ? seedScriptRows() : scripts).map((row, index) => ({
    id: row.categoryId,
    name: row.name.replace(' · 默认剧本', ''),
    nameEn: null,
    icon: null,
    status: 1,
    sort: index,
  }));

  const prisma: any = {
    sentenceCategory: {
      findMany: vi.fn(async (args?: any) =>
        args?.where?.status !== undefined ? categories.filter((c) => c.status === args.where.status) : categories,
      ),
      findUnique: vi.fn(async (args: any) => categories.find((c) => c.id === args.where.id) ?? null),
      findFirst: vi.fn(async (args: any) => categories.find((c) => c.name === args.where.name) ?? null),
    },
    stageScript,
    stageStory,
    studyStageProgress: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      groupBy: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    stageDialogueSession: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      groupBy: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    clientXpLog: { findMany: vi.fn(async () => []), findUnique: vi.fn(async () => null) },
    clientUser: { findUnique: vi.fn(async () => ({ xp: 0 })) },
    sentence: { groupBy: vi.fn(async () => []) },
    $queryRaw: vi.fn(async () => []),
    $transaction: async (arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg)),
  };

  const gamify = { awardXp: vi.fn(), checkAchievements: vi.fn() };
  const ai = { stageDialogueTurn: vi.fn(), stageDialogueSummary: vi.fn(), generateStageStory: vi.fn() };
  const imageGen = { generate: vi.fn() };
  const fileService = { save: vi.fn(), findById: vi.fn(async () => null) };
  const service = new StageService(
    prisma as unknown as PrismaService,
    gamify as unknown as GamifyService,
    ai as unknown as TextChatProvider,
    imageGen as unknown as ImageGenApiProvider,
    fileService as unknown as FileService,
  );
  return { service, prisma, scripts, stories, stageScript, stageStory, categories };
}

describe('onModuleInit 种子回填：幂等，不覆盖已有行', () => {
  it('空表时按分类建默认剧本并把 STAGE_STORIES 全部写入', async () => {
    const { service, stageScript, stageStory } = makeService({ emptyDb: true });
    await service.onModuleInit();
    const categoryCount = new Set(STAGE_STORIES.map((item) => item.category)).size;
    expect(stageScript.rows).toHaveLength(categoryCount);
    expect(stageStory.rows).toHaveLength(STAGE_STORIES.length);
    expect(stageStory.rows[0].scriptId).toBe(stageScript.rows[0].id);
  });

  it('已有同剧本同标题的关卡跳过（运营改过的标题不被覆盖）', async () => {
    const { service, stageScript, stageStory } = makeService();
    stageStory.rows[0].title = '运营改过的标题';
    await service.onModuleInit();
    expect(stageStory.rows).toHaveLength(STAGE_STORIES.length);
    expect(stageStory.rows[0].title).toBe('运营改过的标题');
    expect(stageScript.rows).toHaveLength(new Set(STAGE_STORIES.map((item) => item.category)).size);
  });
});

describe('剧本 CRUD', () => {
  it('新增剧本：落到该场景 sort 末尾；同场景重名 409；分类不存在/停用 400', async () => {
    const { service, stageScript } = makeService();
    const result = await service.createScript(NEW_SCRIPT);
    expect(result.id).toBeGreaterThan(0);
    const created = stageScript.rows.find((row) => row.name === NEW_SCRIPT.name)!;
    expect(created.categoryId).toBe(1n);
    expect(created.status).toBe(1);

    await expect(service.createScript(NEW_SCRIPT)).rejects.toMatchObject({ code: 409 });
    await expect(service.createScript({ ...NEW_SCRIPT, categoryId: 999 })).rejects.toMatchObject({ code: 400 });
  });

  it('编辑剧本：改名成功；启停；删除连删关卡', async () => {
    const { service, stageScript, stageStory } = makeService();
    await service.updateScript(1, { name: '改名后的剧本', blurb: '新简介' });
    expect(stageScript.rows[0].name).toBe('改名后的剧本');
    expect(stageScript.rows[0].blurb).toBe('新简介');

    await service.setScriptStatus(1, 0);
    expect(stageScript.rows[0].status).toBe(0);

    const storyCount = stageStory.rows.filter((row) => row.scriptId === stageScript.rows[0].id).length;
    const result = await service.deleteScript(1);
    expect(result.deletedStories).toBe(storyCount);
    expect(stageScript.rows.some((row) => row.id === 1n)).toBe(false);
    expect(stageStory.rows.some((row) => row.scriptId === 1n)).toBe(false);
  });

  it('adminScripts：带场景名/封面/关卡数与启停状态', async () => {
    const { service } = makeService();
    const list = await service.adminScripts();
    expect(list.length).toBe(new Set(STAGE_STORIES.map((item) => item.category)).size);
    expect(list[0]).toMatchObject({
      categoryName: expect.any(String),
      name: expect.any(String),
      stageCount: expect.any(Number),
      enabledStageCount: expect.any(Number),
      coverUrl: null,
    });
  });
});

describe('关卡 CRUD（挂剧本）', () => {
  it('正常新增：落到剧本 sort 末尾，返回 id', async () => {
    const { service, stageStory } = makeService();
    const result = await service.createStory(NEW_STORY);
    expect(result.id).toBeGreaterThan(0);
    const created = stageStory.rows.find((row) => row.title === NEW_STORY.title)!;
    expect(created.scriptId).toBe(1n);
    expect(created.status).toBe(1);
  });

  it('校验：剧本不存在、开场白 speaker 不在角色里、minTurns > maxTurns 都 400', async () => {
    const { service } = makeService();
    await expect(service.createStory({ ...NEW_STORY, scriptId: 999 })).rejects.toMatchObject({ code: 400 });
    await expect(
      service.createStory({ ...NEW_STORY, opening: [{ speaker: 'Ghost', contentEn: 'Boo', contentZh: '呜' }] }),
    ).rejects.toMatchObject({ code: 400 });
    await expect(service.createStory({ ...NEW_STORY, minTurns: 20, maxTurns: 5 })).rejects.toMatchObject({
      code: 400,
    });
  });

  it('编辑关卡：改标题、允许换剧本；不存在 404', async () => {
    const { service, stageStory } = makeService();
    const first = stageStory.rows[0];
    await service.updateStory(Number(first.id), { title: '改过的关卡标题' });
    expect(stageStory.rows[0].title).toBe('改过的关卡标题');

    await service.updateStory(Number(first.id), { scriptId: 2 });
    expect(stageStory.rows[0].scriptId).toBe(2n);

    await expect(service.updateStory(9999, { title: 'x' })).rejects.toMatchObject({ code: 404 });
  });

  it('启停 / 删除 / 剧本内重排', async () => {
    const { service, stageScript, stageStory } = makeService();
    const first = stageStory.rows[0];

    await service.setStoryStatus(Number(first.id), 0);
    expect(stageStory.rows[0].status).toBe(0);

    // 重排：把同剧本的 ids 倒序
    const scriptId = Number(first.scriptId);
    const ids = stageStory.rows.filter((row) => row.scriptId === first.scriptId).map((row) => Number(row.id));
    const reversed = [...ids].reverse();
    await service.reorderStories(scriptId, reversed);
    const sorted = stageStory.rows
      .filter((row) => row.scriptId === first.scriptId)
      .sort((a, b) => a.sort - b.sort)
      .map((row) => Number(row.id));
    expect(sorted).toEqual(reversed);

    // 混入其他剧本 → 400
    const other = stageStory.rows.find((row) => row.scriptId !== first.scriptId)!;
    await expect(service.reorderStories(scriptId, [Number(other.id), ...ids])).rejects.toMatchObject({ code: 400 });

    // 删除
    const before = stageStory.rows.length;
    await service.deleteStory(Number(first.id));
    expect(stageStory.rows).toHaveLength(before - 1);
    expect(stageScript.rows.length).toBeGreaterThan(0);
  });
});

describe('getStages：停用剧本/关卡不下发', () => {
  it('停用剧本整条线消失；停用单个关卡只消失该关', async () => {
    const { service, stageScript, stageStory } = makeService();
    // 停用一个剧本
    stageScript.rows[0].status = 0;
    let overview = await service.getStages(1);
    expect(overview.chapters.some((c) => c.key === `script-${stageScript.rows[0].id}`)).toBe(false);

    // 停用另一个剧本里的第一关
    const other = stageStory.rows.find((row) => row.scriptId === stageScript.rows[1].id)!;
    other.status = 0;
    overview = await service.getStages(1);
    expect(overview.chapters.flatMap((c) => c.stages).some((s) => s.id === Number(other.id))).toBe(false);
  });
});
