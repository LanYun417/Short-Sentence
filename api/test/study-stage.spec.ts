/**
 * 情景闯关单测（对话玩法）。
 *
 * 钉住四条不变量：
 * 1. **章内顺序解锁**：前一关没通关，后一关不解锁；每章首关默认开。
 * 2. **通关双条件**：聊够 minTurns 且 AI 判定目标达成；撞到 maxTurns 没达成也不能通关。
 * 3. **旧版答对不再通关**：correctCount 只作历史统计，不写 dialogueClearedAt。
 * 4. **奖励幂等**：重复领取不重复发经验。
 */
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { GamifyService } from '../src/modules/client/gamify/gamify.service.js';
import type { AgnesSentenceProvider } from '../src/common/ai/agnes-sentence.provider.js';
import type { AgnesImageProvider } from '../src/common/ai/agnes-image.provider.js';
import type { FileService } from '../src/common/file/file.service.js';
import { StageService } from '../src/modules/client/stage/stage.service.js';
import { STAGE_STORIES } from '../src/modules/client/stage/stage-stories.js';
import { makeStageStoryMock } from './helpers/stage-story-mock.js';

interface ProgressRow {
  userId: bigint;
  categoryId: bigint;
  correctCount: number;
  answerCount: number;
  clearedAt: Date | null;
  dialogueClearedAt: Date | null;
  dialogueTurns: number;
}

interface SessionRow {
  id: bigint;
  userId: bigint;
  categoryId: bigint;
  status: string;
  turnCount: number;
  goalReached: boolean;
  cleared: boolean;
  showTranslation: boolean;
  translationUsed: boolean;
  lastHints: string | null;
  summary: string | null;
  feedback: string | null;
  endedAt: Date | null;
}

interface MessageRow {
  id: bigint;
  sessionId: bigint;
  role: string;
  speaker: string | null;
  contentEn: string;
  contentZh: string | null;
  createdAt: Date;
}

/** 只实现被测方法所需的假 Prisma（内存表）。 */
function makePrisma(goalAtTurn: number | null = 6) {
  const categories = [
    { id: 1n, name: '日常生活', nameEn: 'Daily Life', icon: 'house' },
    { id: 2n, name: '居家生活', nameEn: 'Home & Living', icon: 'sofa' },
    { id: 3n, name: '购物消费', nameEn: 'Shopping', icon: 'shopping-bag' },
    { id: 4n, name: '职场办公', nameEn: 'Workplace', icon: 'briefcase' },
  ];
  const rows = new Map<string, ProgressRow>();
  const sessions: SessionRow[] = [];
  const messages: MessageRow[] = [];
  const claimKeys = new Set<string>();
  let nextSessionId = 1n;
  let nextMessageId = 1n;
  let xp = 0;

  const keyOf = (userId: bigint, categoryId: bigint): string => `${userId}:${categoryId}`;

  const prisma = {
    sentenceCategory: {
      findMany: vi.fn(async () => categories),
      findUnique: vi.fn(async (args: { where: { id: bigint } }) => {
        const hit = categories.find((item) => item.id === args.where.id);
        return hit ? { name: hit.name } : null;
      }),
    },
    // 章节封面表：默认无封面，coverUrlMapOf 返回空 map
    stageChapterCover: {
      findMany: vi.fn(async () => []),
    },
    // 关卡剧情表：从代码种子派生，行为与旧版一致
    stageStory: makeStageStoryMock(),
    studyStageProgress: {
      findMany: vi.fn(async (args: { where: { userId: bigint } }) =>
        [...rows.values()].filter((row) => row.userId === args.where.userId),
      ),
      findUnique: vi.fn(
        async (args: { where: { userId_categoryId: { userId: bigint; categoryId: bigint } } }) =>
          rows.get(keyOf(args.where.userId_categoryId.userId, args.where.userId_categoryId.categoryId)) ?? null,
      ),
      upsert: vi.fn(
        async (args: {
          where: { userId_categoryId: { userId: bigint; categoryId: bigint } };
          create: Partial<ProgressRow>;
          update: Record<string, unknown>;
        }) => {
          const { userId, categoryId } = args.where.userId_categoryId;
          const key = keyOf(userId, categoryId);
          let row = rows.get(key);
          if (!row) {
            row = {
              userId,
              categoryId,
              correctCount: Number(args.create.correctCount ?? 0),
              answerCount: Number(args.create.answerCount ?? 0),
              clearedAt: null,
              dialogueClearedAt: (args.create.dialogueClearedAt as Date | null) ?? null,
              dialogueTurns: Number(args.create.dialogueTurns ?? 0),
            };
            rows.set(key, row);
            return row;
          }
          for (const [field, value] of Object.entries(args.update)) {
            if (value && typeof value === 'object' && 'increment' in value) {
              const inc = Number((value as { increment: unknown }).increment);
              if (field === 'answerCount') row.answerCount += inc;
              if (field === 'correctCount') row.correctCount += inc;
            } else if (field === 'dialogueClearedAt') {
              row.dialogueClearedAt = value as Date | null;
            } else if (field === 'dialogueTurns') {
              row.dialogueTurns = Number(value);
            }
          }
          return row;
        },
      ),
      count: vi.fn(
        async (args: { where: { userId: bigint } }) =>
          [...rows.values()].filter((row) => row.userId === args.where.userId && row.dialogueClearedAt).length,
      ),
    },
    sentence: {
      groupBy: vi.fn(async () => [
        { categoryId: 1n, _count: { _all: 100 } },
        { categoryId: 2n, _count: { _all: 100 } },
      ]),
    },
    stageDialogueSession: {
      findMany: vi.fn(async (args: { where: { userId: bigint; status: string } }) =>
        sessions
          .filter((item) => item.userId === args.where.userId && item.status === args.where.status)
          .map((item) => ({ id: item.id, categoryId: item.categoryId, turnCount: item.turnCount })),
      ),
      findFirst: vi.fn(
        async (args: {
          where: {
            userId: bigint;
            categoryId?: bigint;
            status?: string;
            cleared?: boolean;
          };
          orderBy?: { endedAt?: 'asc' | 'desc' };
        }) => {
          const w = args.where;
          const hit = sessions.filter(
            (item) =>
              item.userId === w.userId &&
              (w.categoryId === undefined || item.categoryId === w.categoryId) &&
              (w.status === undefined || item.status === w.status) &&
              (w.cleared === undefined || item.cleared === w.cleared),
          );
          if (args.orderBy?.endedAt === 'desc') {
            hit.sort((a, b) => (b.endedAt?.getTime() ?? 0) - (a.endedAt?.getTime() ?? 0));
          }
          return hit[0] ?? null;
        },
      ),
      findUnique: vi.fn(
        async (args: { where: { id: bigint } }) => sessions.find((item) => item.id === args.where.id) ?? null,
      ),
      create: vi.fn(
        async (args: {
          data: {
            userId: bigint;
            categoryId: bigint;
            showTranslation?: boolean;
            translationUsed?: boolean;
            lastHints?: string | null;
          };
        }) => {
          const row: SessionRow = {
            id: nextSessionId,
            userId: args.data.userId,
            categoryId: args.data.categoryId,
            status: 'active',
            turnCount: 0,
            goalReached: false,
            cleared: false,
            showTranslation: args.data.showTranslation ?? true,
            translationUsed: args.data.translationUsed ?? false,
            lastHints: args.data.lastHints ?? null,
            summary: null,
            feedback: null,
            endedAt: null,
          };
          nextSessionId += 1n;
          sessions.push(row);
          return { id: row.id };
        },
      ),
      update: vi.fn(async (args: { where: { id: bigint }; data: Record<string, unknown> }) => {
        const row = sessions.find((item) => item.id === args.where.id);
        if (row) Object.assign(row, args.data);
        return row;
      }),
    },
    stageDialogueMessage: {
      createMany: vi.fn(
        async (args: {
          data: Array<{
            sessionId: bigint;
            role: string;
            speaker: string | null;
            contentEn: string;
            contentZh: string | null;
          }>;
        }) => {
          for (const item of args.data) {
            messages.push({ id: nextMessageId, ...item, createdAt: new Date('2026-11-09T00:00:00Z') });
            nextMessageId += 1n;
          }
          return { count: args.data.length };
        },
      ),
      findMany: vi.fn(async (args: { where: { sessionId: bigint } }) =>
        messages.filter((item) => item.sessionId === args.where.sessionId),
      ),
    },
    clientXpLog: {
      findMany: vi.fn(async (args: { where: { eventKey: { startsWith: string } } }) =>
        [...claimKeys]
          .filter((item) => item.startsWith(args.where.eventKey.startsWith))
          .map((eventKey) => ({ eventKey })),
      ),
      findUnique: vi.fn(async (args: { where: { eventKey: string } }) =>
        claimKeys.has(args.where.eventKey) ? { id: 1n } : null,
      ),
    },
    clientUser: {
      findUnique: vi.fn(async () => ({ xp })),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };

  const gamify = {
    awardXp: vi.fn(async (_userId: number, _type: string, eventKey: string, amount: number) => {
      if (claimKeys.has(eventKey)) return false;
      claimKeys.add(eventKey);
      xp += amount;
      return true;
    }),
  };

  const ai = {
    stageDialogueTurn: vi.fn(async ({ turnCount }: { turnCount: number }) => ({
      replies: [{ speaker: 'Maya', contentEn: 'Sure, here you go.', contentZh: '好的，给你。' }],
      goalReached: goalAtTurn !== null && turnCount >= goalAtTurn,
      ended: false,
      hints: [
        { en: 'One coffee, please.', zh: '一杯咖啡。' },
        { en: 'Any food today?', zh: '今天要吃点什么吗？' },
        { en: 'What do you recommend?', zh: '你有什么推荐？' },
      ],
    })),
    stageDialogueSummary: vi.fn(async () => ({
      summary: '这一场聊得很自然。',
      highlights: ['你把需求说清楚了'],
      improvements: ['可以再展开一两句'],
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
  return { service, prisma, gamify, ai, rows, sessions, messages, claimKeys };
}

/** 连发 n 句（每句内容不同，避免任何潜在去重干扰）。showTranslation 透传翻译开关。 */
async function talk(service: StageService, categoryId: number, count: number, showTranslation = true): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await service.sendMessage(1, categoryId, `Could you help me with this, please? ${i}`, showTranslation);
  }
}

describe('情景闯关（对话玩法）', () => {
  it('每章首关默认解锁，章内后一关锁住', async () => {
    const { service } = makePrisma();
    const overview = await service.getStages(1);
    const arrive = overview.chapters.find((item) => item.key === 'arrive')!;

    expect(arrive.stages.map((item) => item.name)).toEqual(['日常生活', '居家生活', '购物消费']);
    expect(arrive.stages[0].unlocked).toBe(true);
    expect(arrive.stages[1].unlocked).toBe(false);
    expect(arrive.stages[2].unlocked).toBe(false);
    expect(overview.clearedStages).toBe(0);
    expect(overview.recommendedId).toBe(1);
  });

  it('进入关卡会带上开场白，角色与目标一并下发', async () => {
    const { service } = makePrisma();
    const view = await service.startDialogue(1, 1);
    expect(view.title).toBe(STAGE_STORIES[0].title);
    expect(view.goal).toBe(STAGE_STORIES[0].goal);
    expect(view.roles.length).toBeGreaterThanOrEqual(1);
    expect(view.messages.length).toBe(STAGE_STORIES[0].opening.length);
    expect(view.messages[0].role).toBe('npc');
  });

  it('聊够轮数且达成目标 → 通关、解锁下一关、可领奖', async () => {
    const { service } = makePrisma();
    await service.startDialogue(1, 1);
    await talk(service, 1, STAGE_STORIES[0].minTurns);

    const overview = await service.getStages(1);
    const arrive = overview.chapters.find((item) => item.key === 'arrive')!;
    expect(arrive.stages[0].cleared).toBe(true);
    expect(arrive.stages[0].progress).toBe(100);
    expect(arrive.stages[1].unlocked).toBe(true);
    expect(overview.clearedStages).toBe(1);
    expect(overview.claimable).toBe(1);
    expect(overview.recommendedId).toBe(2);
  });

  it('纯中文输入被拒，不落库也不占轮数', async () => {
    const { service, messages } = makePrisma();
    await service.startDialogue(1, 1);
    const before = messages.length;
    await expect(service.sendMessage(1, 1, '不知道')).rejects.toThrow(/英语/);
    expect(messages.length).toBe(before);
  });

  it('只蹦一个英文词时，模型说目标达成也不算', async () => {
    const { service } = makePrisma(1);
    await service.startDialogue(1, 1);
    const result = await service.sendMessage(1, 1, 'ok');
    expect(result.goalReached).toBe(false);
  });

  it('目标达成太早不算通关，必须聊够 minTurns', async () => {
    const { service } = makePrisma(1);
    await service.startDialogue(1, 1);
    const first = await service.sendMessage(1, 1, 'I would like a coffee please.');
    expect(first.goalReached).toBe(true);
    expect(first.ended).toBe(false);
    expect(first.cleared).toBe(false);
  });

  it('撞到 maxTurns 仍未达成目标 → 结束但不清关', async () => {
    const { service } = makePrisma(null);
    await service.startDialogue(1, 1);
    await talk(service, 1, STAGE_STORIES[0].maxTurns);

    const overview = await service.getStages(1);
    const arrive = overview.chapters.find((item) => item.key === 'arrive')!;
    expect(arrive.stages[0].cleared).toBe(false);
    expect(arrive.stages[1].unlocked).toBe(false);
  });

  it('旧版答对只累计历史统计，不再通关', async () => {
    const { service, rows } = makePrisma();
    for (let i = 0; i < STAGE_STORIES[0].target; i += 1) {
      await service.recordAnswer(1, 1, '日常生活', true);
    }
    const row = rows.get('1:1')!;
    expect(row.correctCount).toBe(STAGE_STORIES[0].target);
    expect(row.dialogueClearedAt).toBeNull();

    const overview = await service.getStages(1);
    expect(overview.clearedStages).toBe(0);
  });

  it('通关奖励幂等：重复领取不重复发经验', async () => {
    const { service, gamify } = makePrisma();
    await service.startDialogue(1, 1);
    await talk(service, 1, STAGE_STORIES[0].minTurns);

    const first = await service.claim(1, 1);
    expect(first.awarded).toBe(true);
    expect(first.rewardXp).toBe(STAGE_STORIES[0].rewardXp);

    const second = await service.claim(1, 1);
    expect(second.alreadyClaimed).toBe(true);
    expect(second.rewardXp).toBe(0);
    expect(gamify.awardXp).toHaveBeenCalledTimes(1);
  });

  it('未通关不能领奖', async () => {
    const { service } = makePrisma();
    await expect(service.claim(1, 1)).rejects.toThrow();
  });

  it('重新开始会废弃旧会话并新建一局', async () => {
    const { service, sessions } = makePrisma();
    const first = await service.startDialogue(1, 1);
    const second = await service.startDialogue(1, 1, true);
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(sessions[0].status).toBe('abandoned');
    expect(second.turnCount).toBe(0);
  });

  it('数字输入（如手机号）允许，不被当成纯中文拒绝', async () => {
    const { service, messages } = makePrisma();
    await service.startDialogue(1, 1);
    const before = messages.length;
    await expect(service.sendMessage(1, 1, '13000000000')).resolves.toBeTruthy();
    expect(messages.length).toBe(before + 2); // 用户 1 句 + NPC 1 句
  });

  it('每轮返回动态候选短句，续聊视图回显 hints 与翻译开关', async () => {
    const { service } = makePrisma();
    await service.startDialogue(1, 1);
    const result = await service.sendMessage(1, 1, 'Could you help me please?', false);
    expect(result.hints).toEqual([
      { en: 'One coffee, please.', zh: '一杯咖啡。' },
      { en: 'Any food today?', zh: '今天要吃点什么吗？' },
      { en: 'What do you recommend?', zh: '你有什么推荐？' },
    ]);
    const view = await service.getDialogue(1, 1);
    expect(view?.hints).toEqual(result.hints);
    expect(view?.showTranslation).toBe(false);
  });

  it('进入场景即带回带翻译的候选短句（starterHints）', async () => {
    const { service } = makePrisma();
    const view = await service.startDialogue(1, 1);
    expect(view.hints).toEqual(STAGE_STORIES[0].starterHints);
    expect(view.hints.every((h) => h.en.length > 0 && h.zh.length > 0)).toBe(true);
    expect(view.showTranslation).toBe(true);
  });

  it('全程开着翻译、最后一句才关 → translationUsed 粘住，拿不到无翻译加成', async () => {
    const { service, sessions } = makePrisma();
    await service.startDialogue(1, 1);
    for (let i = 0; i < STAGE_STORIES[0].minTurns - 1; i += 1) {
      await service.sendMessage(1, 1, `Could you help me with this, please? ${i}`, true);
    }
    // 最后一句临时把翻译关掉
    await service.sendMessage(1, 1, 'I would like a coffee, please.', false);
    expect(sessions[0].translationUsed).toBe(true);
    const result = await service.claim(1, 1);
    expect(result.rewardXp).toBe(STAGE_STORIES[0].rewardXp);
    expect(result.bonusXp).toBe(0);
  });

  it('全程关闭翻译通关 → 给无翻译加成（基础 50%）', async () => {
    const { service } = makePrisma();
    await service.startDialogue(1, 1);
    await talk(service, 1, STAGE_STORIES[0].minTurns, false);
    const result = await service.claim(1, 1);
    expect(result.bonusXp).toBe(Math.round(STAGE_STORIES[0].rewardXp * 0.5));
  });

  it('开关翻译的 PATCH：开启即把 translationUsed 置位（粘性）', async () => {
    const { service, sessions } = makePrisma();
    await service.startDialogue(1, 1);
    expect(sessions[0].translationUsed).toBe(false);
    await service.setTranslation(1, 1, true);
    expect(sessions[0].translationUsed).toBe(true);
    // 再关掉也不清空
    await service.setTranslation(1, 1, false);
    expect(sessions[0].showTranslation).toBe(false);
    expect(sessions[0].translationUsed).toBe(true);
  });
});
