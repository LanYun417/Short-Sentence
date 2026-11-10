/**
 * 情景闯关单测（场景 → 剧本 → 关卡，玩法主键 = storyId）。
 *
 * 钉住五条不变量：
 * 1. **层级组装**：getStages 输出 scenes（场景）+ chapters（剧本，兼容旧客户端），
 *    每个剧本第一关默认解锁，剧本内顺序解锁，剧本之间互不阻塞；
 * 2. **通关双条件**：聊够 minTurns 且 AI 判定目标达成；撞到 maxTurns 没达成也不能通关；
 * 3. **进度按关卡**：dialogueClearedAt 写 (userId, storyId)，与分类解耦；
 * 4. **奖励幂等**：重复领取不重复发经验，key 为 stage:{userId}:{storyId}；
 * 5. **停用剧本不下发**。
 */
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { GamifyService } from '../src/modules/client/gamify/gamify.service.js';
import type { AgnesSentenceProvider } from '../src/common/ai/agnes-sentence.provider.js';
import type { AgnesImageProvider } from '../src/common/ai/agnes-image.provider.js';
import type { FileService } from '../src/common/file/file.service.js';
import { StageService } from '../src/modules/client/stage/stage.service.js';
import { STAGE_STORIES } from '../src/modules/client/stage/stage-stories.js';
import { makeStageScriptMock, makeStageStoryMock, seedScriptRows, seedStoryRows } from './helpers/stage-story-mock.js';

const FIRST_STORY = STAGE_STORIES[0]; // 便利店的清晨（日常生活）
const SECOND_STORY = STAGE_STORIES[1]; // 空房间的第一晚（居家生活，另一个剧本）

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

  const progressRows: Array<Record<string, any>> = [];
  const sessions: Array<Record<string, any>> = [];
  const messages: Array<Record<string, any>> = [];
  const xpLogs: Array<{ eventKey: string }> = [];

  const prisma: any = {
    sentenceCategory: {
      findMany: vi.fn(async () => categories),
      findUnique: vi.fn(async (args: any) => categories.find((c) => c.id === args.where.id) ?? null),
      findFirst: vi.fn(async (args: any) => categories.find((c) => c.name === args.where.name) ?? null),
    },
    stageScript,
    stageStory,
    studyStageProgress: {
      findMany: vi.fn(async (args: any) => {
        const where = args.where ?? {};
        return progressRows.filter((row) => {
          if (where.userId !== undefined && row.userId !== where.userId) return false;
          // 对话进度查询：storyId: { not: null }
          if (where.storyId?.not === null && row.storyId === null) return false;
          // 旧版统计查询：storyId: null
          if (where.storyId === null && row.storyId !== null) return false;
          return true;
        });
      }),
      findUnique: vi.fn(async (args: any) => {
        const { userId, storyId } = args.where.userId_storyId;
        return progressRows.find((row) => row.userId === userId && row.storyId === storyId) ?? null;
      }),
      findFirst: vi.fn(async (args: any) => {
        const where = args.where ?? {};
        return (
          progressRows.find(
            (row) =>
              (where.userId === undefined || row.userId === where.userId) &&
              (where.categoryId === undefined || row.categoryId === where.categoryId) &&
              (where.storyId !== null || row.storyId === null),
          ) ?? null
        );
      }),
      upsert: vi.fn(async (args: any) => {
        const { userId, storyId } = args.where.userId_storyId;
        const found = progressRows.find((item) => item.userId === userId && item.storyId === storyId);
        if (!found) {
          const row: Record<string, any> = { id: BigInt(progressRows.length + 1), ...args.create };
          progressRows.push(row);
          return row;
        }
        Object.assign(found, args.update);
        return found;
      }),
      create: vi.fn(async (args: any) => {
        const row = { id: BigInt(progressRows.length + 1), storyId: null, ...args.data };
        progressRows.push(row);
        return row;
      }),
      update: vi.fn(async (args: any) => {
        const row = progressRows.find((item) => item.id === args.where.id);
        for (const [key, value] of Object.entries(args.data)) {
          if (value !== null && typeof value === 'object' && 'increment' in (value as object)) {
            (row as Record<string, any>)[key] += (value as { increment: number }).increment;
          } else {
            (row as Record<string, any>)[key] = value;
          }
        }
        return row;
      }),
      groupBy: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    stageDialogueSession: {
      findFirst: vi.fn(async (args: any) => {
        const where = args.where ?? {};
        const rows = sessions.filter(
          (row) =>
            (where.userId === undefined || row.userId === where.userId) &&
            (where.storyId === undefined || row.storyId === where.storyId) &&
            (where.status === undefined || row.status === where.status) &&
            (where.cleared === undefined || row.cleared === where.cleared),
        );
        return rows.at(-1) ?? null;
      }),
      findUnique: vi.fn(async (args: any) => sessions.find((row) => row.id === args.where.id) ?? null),
      findMany: vi.fn(async () => []),
      create: vi.fn(async (args: any) => {
        const row = { id: BigInt(sessions.length + 1), turnCount: 0, status: 'active', ...args.data };
        sessions.push(row);
        return row;
      }),
      update: vi.fn(async (args: any) => {
        const row = sessions.find((item) => item.id === args.where.id);
        Object.assign(row!, args.data);
        return row;
      }),
      groupBy: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    stageDialogueMessage: {
      createMany: vi.fn(async (args: any) => {
        for (const item of args.data)
          messages.push({ id: BigInt(messages.length + 1), createdAt: new Date(), ...item });
        return { count: args.data.length };
      }),
      findMany: vi.fn(async (args: any) => messages.filter((row) => row.sessionId === args.where.sessionId)),
    },
    clientXpLog: {
      findMany: vi.fn(async () => xpLogs),
      findUnique: vi.fn(async (args: any) => xpLogs.find((row) => row.eventKey === args.where.eventKey) ?? null),
    },
    clientUser: {
      findUnique: vi.fn(async () => ({ xp: 100, nickname: '小明' })),
    },
    sentence: {
      groupBy: vi.fn(async () => []),
    },
    $queryRaw: vi.fn(async () => []),
    $transaction: async (arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg)),
  };

  const gamify = {
    awardXp: vi.fn(async (_userId: number, _type: string, eventKey: string) => {
      if (xpLogs.some((row) => row.eventKey === eventKey)) return false;
      xpLogs.push({ eventKey });
      return true;
    }),
    checkAchievements: vi.fn(),
  };
  const ai = {
    stageDialogueTurn: vi.fn(async (input: any) => ({
      replies: [{ speaker: 'Maya', contentEn: 'Sure, anything else?', contentZh: '好的，还要别的吗？' }],
      goalReached: input.turnCount >= 2,
      hints: [{ en: 'That’s all, thanks.', zh: '就这些，谢谢。' }],
      ended: input.turnCount >= 2,
    })),
    stageDialogueSummary: vi.fn(async () => ({
      summary: '这一场聊得很自然。',
      highlights: ['你把需求说清楚了'],
      improvements: ['可以再展开一两句'],
    })),
    generateStageStory: vi.fn(),
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
  return { service, prisma, scripts, stories, stageScript, stageStory, sessions, messages, progressRows, xpLogs, ai };
}

describe('getStages：场景 → 剧本 → 关卡 组装与解锁', () => {
  it('scenes 按场景分组；每个剧本第一关解锁、后续关卡锁住', async () => {
    const { service } = makeService();
    const overview = await service.getStages(1);
    expect(overview.scenes.length).toBeGreaterThan(0);
    for (const scene of overview.scenes) {
      expect(scene.scriptCount).toBeGreaterThan(0);
      expect(scene.stageCount).toBeGreaterThan(0);
    }
    for (const chapter of overview.chapters) {
      expect(chapter.stages[0]?.unlocked).toBe(true);
      for (const stage of chapter.stages.slice(1)) {
        expect(stage.unlocked).toBe(false);
      }
    }
  });

  it('关卡 id = storyId（不是分类 id），且带 scriptId/categoryId', async () => {
    const { service, stories, scripts } = makeService();
    const overview = await service.getStages(1);
    const first = overview.chapters.flatMap((c) => c.stages)[0];
    expect(first.id).toBe(Number(stories[0].id));
    expect(first.scriptId).toBe(Number(scripts[0].id));
    expect(first.categoryId).toBe(Number(scripts[0].categoryId));
  });

  it('停用的剧本整条线不下发', async () => {
    const { service, scripts, stories } = makeService();
    scripts[0].status = 0;
    const overview = await service.getStages(1);
    expect(overview.chapters.some((c) => c.stages.some((s) => s.id === Number(stories[0].id)))).toBe(false);
  });

  it('getScript / getScene 返回单剧本/单场景详情；不存在 404', async () => {
    const { service, scripts } = makeService();
    const detail = await service.getScript(1, Number(scripts[0].id));
    expect(detail.script.id).toBe(Number(scripts[0].id));
    expect(detail.stages.length).toBeGreaterThan(0);
    expect(detail.scene.id).toBe(Number(scripts[0].categoryId));

    const scene = await service.getScene(1, Number(scripts[0].categoryId));
    expect(scene.scripts.some((s) => s.id === Number(scripts[0].id))).toBe(true);
    await expect(service.getScript(1, 9999)).rejects.toMatchObject({ code: 404 });
    await expect(service.getScene(1, 9999)).rejects.toMatchObject({ code: 404 });
  });
});

describe('对话与通关：主键 storyId，进度按关卡记', () => {
  it('startDialogue 建会话写 storyId/categoryId 与开场白；再次进入续聊同一会话', async () => {
    const { service, sessions, messages, stories, scripts } = makeService();
    const storyId = Number(stories[0].id);
    const view = await service.startDialogue(1, storyId);
    expect(view.sessionId).toBeTruthy();
    expect(sessions[0].storyId).toBe(stories[0].id);
    expect(sessions[0].categoryId).toBe(scripts[0].categoryId);
    expect(messages.length).toBe(FIRST_STORY.opening.length);

    const again = await service.startDialogue(1, storyId);
    expect(sessions).toHaveLength(1);
    expect(again.sessionId).toBe(view.sessionId);
  });

  it('聊够 minTurns 且目标达成 → 通关，进度写 (userId, storyId)', async () => {
    const { service, progressRows, stories, ai } = makeService();
    const storyId = Number(stories[0].id);
    await service.startDialogue(1, storyId);
    for (let i = 0; i < FIRST_STORY.minTurns - 1; i += 1) {
      const result = await service.sendMessage(1, storyId, `Could I get a coffee, please? ${i}`);
      expect(result.cleared).toBe(false);
    }
    const last = await service.sendMessage(1, storyId, 'That’s all, thanks a lot.');
    expect(last.cleared).toBe(true);
    const row = progressRows.find((item) => item.storyId === stories[0].id);
    expect(row?.dialogueClearedAt).toBeTruthy();
    expect(ai.stageDialogueTurn).toHaveBeenCalled();
  });

  it('目标一直没达成 → 撞 maxTurns 结束也不通关', async () => {
    const { service, stories, ai, progressRows } = makeService();
    ai.stageDialogueTurn.mockImplementation(async () => ({
      replies: [{ speaker: 'Maya', contentEn: 'Hmm?', contentZh: '嗯？' }],
      goalReached: false,
      hints: [],
      ended: false,
    }));
    const storyId = Number(stories[0].id);
    await service.startDialogue(1, storyId);
    let result = await service.sendMessage(1, storyId, 'Hello there.');
    for (let i = 0; i < FIRST_STORY.maxTurns; i += 1) {
      result = await service.sendMessage(1, storyId, `Still here ${i}`);
      if (result.ended) break;
    }
    expect(result.ended).toBe(true);
    expect(result.cleared).toBe(false);
    expect(progressRows.find((item) => item.storyId === stories[0].id)).toBeUndefined();
  });

  it('通关后同剧本下一关解锁', async () => {
    const { service, stories } = makeService();
    const storyId = Number(stories[0].id);
    await service.startDialogue(1, storyId);
    for (let i = 0; i < FIRST_STORY.minTurns - 1; i += 1) await service.sendMessage(1, storyId, `Coffee please ${i}`);
    await service.sendMessage(1, storyId, 'That’s all, thanks.');

    const overview = await service.getStages(1);
    const chapter = overview.chapters.find((c) => c.stages.some((s) => s.id === storyId))!;
    const index = chapter.stages.findIndex((s) => s.id === storyId);
    expect(chapter.stages[index].cleared).toBe(true);
    if (chapter.stages[index + 1]) expect(chapter.stages[index + 1].unlocked).toBe(true);
  });

  it('claim 幂等：key = stage:{userId}:{storyId}，重复领取不重复发 XP', async () => {
    const { service, stories, xpLogs } = makeService();
    const storyId = Number(stories[0].id);
    await service.startDialogue(1, storyId);
    for (let i = 0; i < FIRST_STORY.minTurns - 1; i += 1) await service.sendMessage(1, storyId, `Coffee please ${i}`);
    await service.sendMessage(1, storyId, 'That’s all, thanks.');

    const first = await service.claim(1, storyId);
    expect(first.awarded).toBe(true);
    expect(xpLogs.some((row) => row.eventKey === `stage:1:${storyId}`)).toBe(true);

    const second = await service.claim(1, storyId);
    expect(second.alreadyClaimed).toBe(true);
    expect(second.awarded).toBe(false);
  });

  it('未通关领取 → 400；关卡不存在 → 404', async () => {
    const { service, stories } = makeService();
    await expect(service.claim(1, Number(stories[0].id))).rejects.toMatchObject({ code: 400 });
    await expect(service.claim(1, 9999)).rejects.toMatchObject({ code: 404 });
  });
});

describe('recordAnswer：旧版答题统计按分类记一行（storyId 为空）', () => {
  it('有剧本归属的分类写入/累加分类级统计行', async () => {
    const { service, progressRows } = makeService();
    const categoryId = 1; // 日常生活（seedScriptRows 里第一个分类）
    await service.recordAnswer(1, categoryId, '日常生活', true);
    await service.recordAnswer(1, categoryId, '日常生活', false);
    const row = progressRows.find((item) => item.categoryId === BigInt(categoryId) && item.storyId === null);
    expect(row?.correctCount).toBe(1);
    expect(row?.answerCount).toBe(2);
  });

  it('没有剧本归属的分类直接跳过', async () => {
    const { service, progressRows } = makeService();
    await service.recordAnswer(1, 999, '不存在的场景', true);
    expect(progressRows).toHaveLength(0);
  });
});

describe('剧本之间互不阻塞', () => {
  it('不同剧本的第一关都默认解锁', async () => {
    const { service, stories } = makeService();
    const overview = await service.getStages(1);
    const flat = overview.chapters.flatMap((c) => c.stages);
    expect(flat.find((s) => s.id === Number(stories[0].id))?.unlocked).toBe(true);
    expect(flat.find((s) => s.id === Number(stories[1].id))?.unlocked).toBe(true);
    expect(SECOND_STORY.category).toBe('居家生活');
  });
});
