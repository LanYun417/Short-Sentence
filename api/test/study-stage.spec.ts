/**
 * 情景闯关单测。
 *
 * 钉住三条不变量：
 * 1. **章内顺序解锁**：前一关没通关，后一关不解锁；每章首关默认开。
 * 2. **进度只增不减**：答错只累计作答数，不推进通关线；越过通关线只写一次 clearedAt。
 * 3. **奖励幂等**：重复领取不重复发经验（靠 XP 幂等键，不另建领取表）。
 */
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { GamifyService } from '../src/modules/client/gamify/gamify.service.js';
import { StageService } from '../src/modules/client/stage/stage.service.js';
import { STAGE_STORIES } from '../src/modules/client/stage/stage-stories.js';

interface ProgressRow {
  userId: bigint;
  categoryId: bigint;
  correctCount: number;
  answerCount: number;
  clearedAt: Date | null;
}

/** 只实现被测方法所需的假 Prisma（内存表）。 */
function makePrisma() {
  const categories = [
    { id: 1n, name: '日常生活', nameEn: 'Daily Life', icon: 'house' },
    { id: 2n, name: '居家生活', nameEn: 'Home & Living', icon: 'sofa' },
    { id: 3n, name: '购物消费', nameEn: 'Shopping', icon: 'shopping-bag' },
    { id: 4n, name: '职场办公', nameEn: 'Workplace', icon: 'briefcase' },
  ];
  const rows = new Map<string, ProgressRow>();
  const claimKeys = new Set<string>();
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
    studyStageProgress: {
      findMany: vi.fn(async (args: { where: { userId: bigint } }) =>
        [...rows.values()]
          .filter((row) => row.userId === args.where.userId)
          .map((row) => ({
            categoryId: row.categoryId,
            correctCount: row.correctCount,
            answerCount: row.answerCount,
            clearedAt: row.clearedAt,
          })),
      ),
      findUnique: vi.fn(async (args: { where: { userId_categoryId: { userId: bigint; categoryId: bigint } } }) => {
        const { userId, categoryId } = args.where.userId_categoryId;
        const row = rows.get(keyOf(userId, categoryId));
        return row ? { correctCount: row.correctCount, clearedAt: row.clearedAt } : null;
      }),
      upsert: vi.fn(
        async (args: {
          where: { userId_categoryId: { userId: bigint; categoryId: bigint } };
          create: { userId: bigint; categoryId: bigint; correctCount: number; answerCount: number };
          update: { answerCount: { increment: number }; correctCount?: { increment: number } };
        }) => {
          const { userId, categoryId } = args.where.userId_categoryId;
          const key = keyOf(userId, categoryId);
          const existing = rows.get(key);
          if (!existing) {
            rows.set(key, {
              userId,
              categoryId,
              correctCount: args.create.correctCount,
              answerCount: args.create.answerCount,
              clearedAt: null,
            });
          } else {
            existing.answerCount += args.update.answerCount.increment;
            if (args.update.correctCount) existing.correctCount += args.update.correctCount.increment;
          }
          const row = rows.get(key)!;
          return { correctCount: row.correctCount, clearedAt: row.clearedAt };
        },
      ),
      update: vi.fn(async (args: { where: { userId_categoryId: { userId: bigint; categoryId: bigint } } }) => {
        const { userId, categoryId } = args.where.userId_categoryId;
        const row = rows.get(keyOf(userId, categoryId));
        if (row && !row.clearedAt) row.clearedAt = new Date('2026-11-08T00:00:00Z');
        return row;
      }),
      count: vi.fn(
        async (args: { where: { userId: bigint } }) =>
          [...rows.values()].filter((row) => row.userId === args.where.userId && row.clearedAt).length,
      ),
    },
    sentence: {
      groupBy: vi.fn(async () => [
        { categoryId: 1n, _count: { _all: 100 } },
        { categoryId: 2n, _count: { _all: 100 } },
        { categoryId: 3n, _count: { _all: 100 } },
        { categoryId: 4n, _count: { _all: 100 } },
      ]),
    },
    clientXpLog: {
      findMany: vi.fn(async (args: { where: { userId: bigint; eventKey: { startsWith: string } } }) =>
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
  };

  const gamify = {
    awardXp: vi.fn(async (userId: number, _type: string, eventKey: string, amount: number) => {
      if (claimKeys.has(eventKey)) return false;
      claimKeys.add(eventKey);
      xp += amount;
      void userId;
      return true;
    }),
  };

  const service = new StageService(prisma as unknown as PrismaService, gamify as unknown as GamifyService);
  return { service, prisma, gamify, rows, claimKeys };
}

const TARGET = STAGE_STORIES[0].target; // 日常生活 5 句

describe('情景闯关', () => {
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

  it('答对累计到目标即通关，并解锁下一关', async () => {
    const { service } = makePrisma();
    for (let i = 0; i < TARGET; i += 1) {
      await service.recordAnswer(1, 1, '日常生活', true);
    }
    const overview = await service.getStages(1);
    const arrive = overview.chapters.find((item) => item.key === 'arrive')!;

    expect(arrive.stages[0].cleared).toBe(true);
    expect(arrive.stages[0].progress).toBe(100);
    expect(arrive.stages[0].correctCount).toBe(TARGET);
    expect(arrive.stages[1].unlocked).toBe(true);
    expect(overview.clearedStages).toBe(1);
    expect(overview.claimable).toBe(1);
    expect(overview.recommendedId).toBe(2);
  });

  it('答错只累计作答数，不推进通关线', async () => {
    const { service, rows } = makePrisma();
    await service.recordAnswer(1, 1, '日常生活', false);
    const row = rows.get('1:1')!;
    expect(row.correctCount).toBe(0);
    expect(row.answerCount).toBe(1);
    expect(row.clearedAt).toBeNull();
  });

  it('未配置剧情的场景不记进度（运营新加分类时不造空关卡）', async () => {
    const { service, rows } = makePrisma();
    await service.recordAnswer(1, 99, '新加场景', true);
    expect(rows.size).toBe(0);
  });

  it('通关奖励幂等：重复领取不重复发经验', async () => {
    const { service, gamify } = makePrisma();
    for (let i = 0; i < TARGET; i += 1) {
      await service.recordAnswer(1, 1, '日常生活', true);
    }

    const first = await service.claim(1, 1);
    expect(first.awarded).toBe(true);
    expect(first.alreadyClaimed).toBe(false);
    expect(first.rewardXp).toBe(STAGE_STORIES[0].rewardXp);

    const second = await service.claim(1, 1);
    expect(second.awarded).toBe(false);
    expect(second.alreadyClaimed).toBe(true);
    expect(second.rewardXp).toBe(0);
    expect(gamify.awardXp).toHaveBeenCalledTimes(1);
  });

  it('未通关不能领奖', async () => {
    const { service } = makePrisma();
    await expect(service.claim(1, 1)).rejects.toThrow();
  });

  it('未配置剧情的分类不能领奖（防止按 id 乱刷）', async () => {
    const { service } = makePrisma();
    await expect(service.claim(1, 999)).rejects.toThrow();
  });
});
