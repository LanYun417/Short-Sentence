/**
 * 情景闯关「AI 生成关卡草稿」单测。
 *
 * 分两层：
 * 1. parseStageStoryDraft（纯函数）：围栏容忍、坏 JSON/缺字段 → null、开场白 speaker 落地、数值夹取；
 * 2. StageService.generateStoryDraft：章节/分类校验 + 已绑定 409，草稿带 chapterKey/category 回传、
 *    把同章已有标题喂给 provider 做去重。
 */
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { GamifyService } from '../src/modules/client/gamify/gamify.service.js';
import type { AgnesSentenceProvider } from '../src/common/ai/agnes-sentence.provider.js';
import { parseStageStoryDraft } from '../src/common/ai/agnes-sentence.provider.js';
import type { AgnesImageProvider } from '../src/common/ai/agnes-image.provider.js';
import type { FileService } from '../src/common/file/file.service.js';
import type { StageStoryDraft } from '../src/common/ai/ai.types.js';
import { StageService } from '../src/modules/client/stage/stage.service.js';
import { STAGE_CHAPTERS, STAGE_STORIES } from '../src/modules/client/stage/stage-stories.js';
import { makeStageStoryMock } from './helpers/stage-story-mock.js';

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
    const noGoal = { ...VALID_DRAFT, goal: '' };
    expect(parseStageStoryDraft(JSON.stringify(noGoal))).toBeNull();
    const noRoles = { ...VALID_DRAFT, roles: [] };
    expect(parseStageStoryDraft(JSON.stringify(noRoles))).toBeNull();
  });

  it('开场白 speaker 不在角色里的行被丢弃；候选短句非英文被丢弃，全清则 null', () => {
    const withGhost = {
      ...VALID_DRAFT,
      opening: [...VALID_DRAFT.opening, { speaker: 'Ghost', contentEn: 'Boo', contentZh: ' uh' }],
    };
    const draft = parseStageStoryDraft(JSON.stringify(withGhost));
    expect(draft?.opening).toHaveLength(1);
    expect(draft?.opening[0].speaker).toBe('Leo');

    const noHints = { ...VALID_DRAFT, starterHints: [{ en: '中文没有英文', zh: 'x' }] };
    expect(parseStageStoryDraft(JSON.stringify(noHints))).toBeNull();
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
    expect(draft?.maxTurns).toBe(50); // maxTurns 被夹到 [minTurns,100]
    expect(draft?.rewardXp).toBe(10000);
    expect(draft?.roles[0].emoji).toBe('🧑');
  });
});

/* ------------------------------ service 层 ------------------------------ */

const EXTRA_CATEGORY = '全新场景';

function makeService() {
  const categoryNames = [...new Set([...STAGE_STORIES.map((item) => item.category), EXTRA_CATEGORY])];
  const categories = categoryNames.map((name, index) => ({
    id: BigInt(index + 1),
    name,
    nameEn: null,
    icon: null,
    status: 1,
    sort: index,
  }));
  const stageStory = makeStageStoryMock();

  const prisma: any = {
    sentenceCategory: {
      findMany: vi.fn(async () => categories),
      findUnique: vi.fn(async (args: any) => categories.find((c) => c.id === args.where.id) ?? null),
      findFirst: vi.fn(async (args: any) => categories.find((c) => c.name === args.where.name) ?? null),
    },
    studyStageProgress: {
      findMany: vi.fn(async () => []),
      groupBy: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    clientXpLog: { findMany: vi.fn(async () => []) },
    stageDialogueSession: {
      findMany: vi.fn(async () => []),
      groupBy: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    sentence: { groupBy: vi.fn(async () => []) },
    stageChapterCover: { findMany: vi.fn(async () => []) },
    stageStory,
    $queryRaw: vi.fn(async () => []),
    $transaction: async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => Promise<unknown>)(prisma);
      return Promise.all(arg as Promise<unknown>[]);
    },
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
    ai as unknown as AgnesSentenceProvider,
    imageGen as unknown as AgnesImageProvider,
    fileService as unknown as FileService,
  );
  return { service, prisma, stageStory, ai };
}

describe('generateStoryDraft：校验 + 草稿回传', () => {
  it('正常生成：草稿带 chapterKey/category，provider 收到章节名与同章已有标题', async () => {
    const { service, ai } = makeService();
    const result = await service.generateStoryDraft('arrive', EXTRA_CATEGORY);
    expect(result.chapterKey).toBe('arrive');
    expect(result.category).toBe(EXTRA_CATEGORY);
    expect(result.title).toBe(VALID_DRAFT.title);
    expect(ai.generateStageStory).toHaveBeenCalledTimes(1);
    const [chapterName, categoryName, existingTitles] = ai.generateStageStory.mock.calls[0];
    expect(chapterName).toBe(STAGE_CHAPTERS.find((c) => c.key === 'arrive')!.name);
    expect(categoryName).toBe(EXTRA_CATEGORY);
    // 同章已有标题喂给模型做去重
    expect(existingTitles).toEqual(STAGE_STORIES.filter((s) => s.chapter === 'arrive').map((s) => s.title));
  });

  it('章节不存在 → 400；分类不存在 → 400；分类已绑定关卡 → 409', async () => {
    const { service } = makeService();
    await expect(service.generateStoryDraft('nope', EXTRA_CATEGORY)).rejects.toMatchObject({ code: 400 });
    await expect(service.generateStoryDraft('arrive', '不存在的分类')).rejects.toMatchObject({ code: 400 });
    await expect(service.generateStoryDraft('arrive', '日常生活')).rejects.toMatchObject({ code: 409 });
  });
});
