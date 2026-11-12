/**
 * 情景闯关「AI 生成关卡草稿」单测。
 *
 * 分两层：
 * 1. parseStageStoryDraft（纯函数）：围栏容忍、坏 JSON/缺字段 → null、开场白 speaker 落地、数值夹取；
 * 2. StageService.generateStoryDraft(scriptId)：剧本/分类校验，草稿带 scriptId 回传、
 *    把同剧本已有标题喂给 provider 做去重。
 */
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { GamifyService } from '../src/modules/client/gamify/gamify.service.js';
import type { TextChatProvider } from '../src/common/ai/text-chat.provider.js';
import { parseStageStoryDraft } from '../src/common/ai/text-chat.provider.js';
import type { ImageGenApiProvider } from '../src/common/ai/image-gen.provider.js';
import type { FileService } from '../src/common/file/file.service.js';
import type { StageStoryDraft } from '../src/common/ai/ai.types.js';
import { StageService } from '../src/modules/client/stage/stage.service.js';
import { STAGE_STORIES } from '../src/modules/client/stage/stage-stories.js';
import { makeStageScriptMock, makeStageStoryMock, seedScriptRows, seedStoryRows } from './helpers/stage-story-mock.js';

const VALID_DRAFT = {
  title: '雨夜的最后一班公交',
  intro: '晚上十一点，你站在公交站，雨越下越大。',
  outro: '你坐上末班车，车窗外的城市慢慢亮起来。',
  userRole: '赶末班车回家的人',
  setting: '深夜的街角公交站，霓虹灯在雨里模糊，站牌下只有你一个人。',
  goal: '问清末班车几点发车，并买一张票',
  minTurns: 5,
  maxTurns: 10,
  rewardXp: 30,
  roles: [{ nameEn: 'Leo', name: '司机 Leo', persona: '四十多岁，话少但热心', emoji: '🧔' }],
  opening: [{ speaker: 'Leo', contentEn: 'Last bus tonight, you making it?', contentZh: '今晚末班车，你赶得上吗？' }],
  starterHints: [
    { en: 'What time does the last bus leave?', zh: '末班车几点发车？' },
    { en: 'One ticket, please.', zh: '请给我一张票。' },
  ],
};

describe('parseStageStoryDraft 解析', () => {
  it('合法 JSON 对象直接解析', () => {
    const draft = parseStageStoryDraft(JSON.stringify(VALID_DRAFT));
    expect(draft).not.toBeNull();
    expect(draft!.title).toBe(VALID_DRAFT.title);
    expect(draft!.roles).toHaveLength(1);
    expect(draft!.starterHints).toHaveLength(2);
  });

  it('容忍 ```json 围栏和夹带文字', () => {
    const draft = parseStageStoryDraft(`前缀说明\n\`\`\`json\n${JSON.stringify(VALID_DRAFT)}\n\`\`\`\n后缀`);
    expect(draft?.title).toBe(VALID_DRAFT.title);
  });

  it('坏 JSON / 非对象 / 缺必填字段 → null', () => {
    expect(parseStageStoryDraft('not json at all')).toBeNull();
    expect(parseStageStoryDraft('[1,2,3]')).toBeNull();
    expect(parseStageStoryDraft(JSON.stringify({ ...VALID_DRAFT, goal: '' }))).toBeNull();
    expect(parseStageStoryDraft(JSON.stringify({ ...VALID_DRAFT, roles: [] }))).toBeNull();
  });

  it('开场白 speaker 不在角色里的行被丢弃；候选短句非英文被丢弃，全清则 null', () => {
    const withGhost = {
      ...VALID_DRAFT,
      opening: [...VALID_DRAFT.opening, { speaker: 'Ghost', contentEn: 'Boo', contentZh: '呜' }],
    };
    const draft = parseStageStoryDraft(JSON.stringify(withGhost));
    expect(draft?.opening).toHaveLength(1);
    expect(draft?.opening[0].speaker).toBe('Leo');

    expect(
      parseStageStoryDraft(JSON.stringify({ ...VALID_DRAFT, starterHints: [{ en: '中文', zh: 'x' }] })),
    ).toBeNull();
  });

  it('数值夹取：minTurns/maxTurns/rewardXp 越界收口，emoji 缺省', () => {
    const wild = {
      ...VALID_DRAFT,
      minTurns: 999,
      maxTurns: -3,
      rewardXp: 99999,
      roles: [{ nameEn: 'A', name: '甲', persona: 'x', emoji: '' }],
    };
    const draft = parseStageStoryDraft(JSON.stringify(wild));
    expect(draft?.minTurns).toBe(50);
    expect(draft?.maxTurns).toBe(50);
    expect(draft?.rewardXp).toBe(10000);
    expect(draft?.roles[0].emoji).toBe('🧑');
  });
});

/* ------------------------------ service 层 ------------------------------ */

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
  const draft: StageStoryDraft = { ...VALID_DRAFT };
  const ai = {
    stageDialogueTurn: vi.fn(),
    stageDialogueSummary: vi.fn(),
    generateStageStory: vi.fn(async (_chapterName: string, _categoryName: string, _existingTitles: string[]) => ({
      ...draft,
    })),
  };
  const imageGen = { generate: vi.fn() };
  const fileService = { save: vi.fn(), findById: vi.fn(async () => null) };
  const service = new StageService(
    prisma as unknown as PrismaService,
    gamify as unknown as GamifyService,
    ai as unknown as TextChatProvider,
    imageGen as unknown as ImageGenApiProvider,
    fileService as unknown as FileService,
  );
  return { service, prisma, scripts, stories, stageScript, stageStory, ai };
}

describe('generateStoryDraft：校验 + 草稿回传', () => {
  it('正常生成：草稿带 scriptId，provider 收到「场景+剧本」名与同剧本已有标题', async () => {
    const { service, ai, scripts, stories } = makeService();
    const scriptId = Number(scripts[0].id);
    const result = await service.generateStoryDraft(scriptId);
    expect(result.scriptId).toBe(scriptId);
    expect(result.title).toBe(VALID_DRAFT.title);
    expect(ai.generateStageStory).toHaveBeenCalledTimes(1);
    const [sceneLabel, categoryName, existingTitles] = ai.generateStageStory.mock.calls[0];
    expect(sceneLabel).toContain(scripts[0].name);
    expect(categoryName).toBe(scripts[0].name.replace(' · 默认剧本', ''));
    expect(existingTitles).toEqual(stories.filter((row) => row.scriptId === scripts[0].id).map((row) => row.title));
  });

  it('剧本不存在 → 400', async () => {
    const { service } = makeService();
    await expect(service.generateStoryDraft(9999)).rejects.toMatchObject({ code: 400 });
  });

  it('剧本所属分类被停用 → 400', async () => {
    const { service, prisma, scripts } = makeService();
    const category = prisma.sentenceCategory.findUnique;
    category.mockResolvedValueOnce({ name: '日常生活', status: 0 });
    await expect(service.generateStoryDraft(Number(scripts[0].id))).rejects.toMatchObject({ code: 400 });
  });
});

describe('种子覆盖度', () => {
  it('STAGE_STORIES 的 14 关都挂在各自分类的默认剧本下', () => {
    expect(STAGE_STORIES).toHaveLength(14);
  });
});
