import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { QuestionsService } from '../src/modules/client/questions/questions.service.js';

/**
 * 每日 Boss 的服务端口径。
 *
 * 守四条：
 * 1. 题面**不含英文原句**（与刷题同一套防偷看口径，答案只在提交后下发）；
 * 2. 选题目「同一天恒定」——同一日期两次调用命中同一句；
 * 3. 池子为空时返回 question: null，不抛错（页面给「还在准备中」）；
 * 4. 提交非今日 Boss 的 id 直接 400（防拿旧题刷通关奖励）。
 */

/** 固定的「今天」：避免跨日运行把用例打红（服务端按东八区日期选题目）。 */
const BOSS_ID = 11n;

function makeService(options?: { empty?: boolean }) {
  const prisma: any = {
    sentence: {
      count: vi.fn(async () => (options?.empty ? 0 : 5)),
      findMany: vi.fn(async () =>
        options?.empty
          ? []
          : [
              {
                id: BOSS_ID,
                translationZh: '愿新年带给你幸福。',
                ipa: '/x/',
                imageFileId: 0n,
                difficulty: 3,
                category: { name: '跨年夜' },
              },
            ],
      ),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      groupBy: vi.fn(async () => []),
    },
    clientXpLog: { findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []) },
    sentenceRecord: {
      findUnique: vi.fn(async () => null),
      findFirst: vi.fn(async () => null),
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: 1 })),
      groupBy: vi.fn(async () => []),
    },
    sentenceFavorite: { findUnique: vi.fn(async () => null) },
  };

  const service = new QuestionsService(
    prisma as unknown as PrismaService,
    { findById: vi.fn(async () => ({ fileUrl: 'http://x/y.webp' })) } as never,
    { getToday: vi.fn(async () => null), recordAnswer: vi.fn(async () => {}) } as never,
    {
      awardXp: vi.fn(async () => false),
      checkAchievements: vi.fn(async () => []),
      awardBadge: vi.fn(async () => {}),
    } as never,
    { recordAnswer: vi.fn(async () => {}) } as never,
  );
  return { service, prisma };
}

describe('每日 Boss', () => {
  it('题面不含英文原句，只给中文题干与元信息', async () => {
    const { service } = makeService();
    const boss = await service.getBoss(1);

    expect(boss.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(boss.bonusXp).toBeGreaterThan(0);
    expect(boss.cleared).toBe(false);
    expect(boss.question).toMatchObject({ sentenceId: Number(BOSS_ID), translationZh: '愿新年带给你幸福。' });
    // 关键：不得出现任何答案字段
    expect(JSON.stringify(boss.question)).not.toContain('sentenceEn');
  });

  it('同一天两次调用选到同一道题（确定性，便于分享「今天这道」）', async () => {
    const { service, prisma } = makeService();
    const first = await service.getBoss(1);
    const second = await service.getBoss(2);

    expect(first.question?.sentenceId).toBe(second.question?.sentenceId);
    // 两次都会按日期算同一个 skip 偏移
    const skips = prisma.sentence.findMany.mock.calls.map((call: any[]) => call[0].skip);
    expect(skips[0]).toBe(skips[1]);
  });

  it('题库为空时返回 question: null（页面给「还在准备中」），不抛错', async () => {
    const { service } = makeService({ empty: true });
    const boss = await service.getBoss(1);
    expect(boss.question).toBeNull();
  });

  it('提交非今日 Boss 的 id 直接 400，防止拿旧题刷通关奖励', async () => {
    const { service } = makeService();
    await expect(service.answerBoss(1, 999999, { sentenceId: 999999, userAnswer: 'whatever' })).rejects.toMatchObject({
      code: 400,
    });
  });
});
