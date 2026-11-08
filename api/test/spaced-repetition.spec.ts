import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { QuestionsService } from '../src/modules/client/questions/questions.service.js';

/**
 * 间隔重复升级后的核心不变量：
 * 1. 答对累计达到毕业阈值（默认 20）后，复习间隔跳到「长期维护」量级（默认 90 天起），
 *    而非固定 5 档梯度上限（30 天）——证明「毕业语义」生效。
 * 2. 不再有「答对 N 次就硬禁抽」的副作用（该逻辑已从代码移除，由拉长间隔自然淡出）。
 * 3. getMemoryStats 能给出未来 30 天分布与遗忘曲线，供前端可视化。
 */

const DAY = 24 * 60 * 60 * 1000;

/** 内存模拟：sentenceRecord 的 create / count / findFirst 形成闭环，便于连续答对多次。 */
function makeService() {
  const records: Array<Record<string, unknown>> = [];
  let correctCount = 0;

  const prisma: any = {
    sentence: {
      findFirst: vi.fn(async () => ({
        id: 1n,
        sentenceEn: 'go',
        alternateAnswers: null,
        translationZh: '走',
        ipa: null,
        explanation: null,
        imageFileId: 5n,
        categoryId: 4n,
        category: { name: '餐饮美食' },
      })),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => []),
    },
    sentenceRecord: {
      // 最近一条记录，但把 nextReviewAt 强制成过去，确保每次作答都「已到期可答」
      findFirst: vi.fn(async () => {
        if (records.length === 0) return null;
        const r = { ...records[records.length - 1] };
        r.nextReviewAt = new Date(0);
        return r;
      }),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => correctCount),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        records.push(args.data);
        if (args.data.isCorrect === 1) correctCount += 1;
        return { id: records.length };
      }),
      groupBy: vi.fn(async () => []),
    },
    sentenceFavorite: { findUnique: vi.fn(async () => null) },
  };

  const fileService = { findById: vi.fn(async () => ({ fileUrl: 'http://x/y.webp' })) };
  const checkinService = {
    getToday: vi.fn(async () => null),
    recordAnswer: vi.fn(async () => {}),
  };
  const gamify = {
    awardXp: vi.fn(async () => 0),
    checkAchievements: vi.fn(async () => []),
    awardBadge: vi.fn(async () => {}),
  };

  const service = new QuestionsService(
    prisma as unknown as PrismaService,
    fileService as never,
    checkinService as never,
    gamify as never,
    { recordAnswer: vi.fn(async () => {}) } as never,
  );
  return { service, records };
}

describe('间隔重复：毕业维护间隔', () => {
  it('第 1 次答对走固定梯度（≈3 天），第 20 次答对进入长期维护（≥60 天）', async () => {
    const { service, records } = makeService();
    const dto = { userAnswer: 'go' } as never;

    for (let i = 0; i < 20; i++) {
      await service.answer(1, 1, dto);
    }

    const firstGap = (records[0].nextReviewAt as Date).getTime() - Date.now();
    const lastGap = (records[19].nextReviewAt as Date).getTime() - Date.now();

    // 第 1 次：level=1 → REVIEW_INTERVAL_DAYS[1] = 3 天
    expect(firstGap).toBeGreaterThan(0);
    expect(firstGap).toBeLessThanOrEqual(3 * DAY + 1000);
    // 第 20 次：累计答对达毕业阈值 → 维护基线 90 天起，远超出普通梯度上限 30 天
    expect(lastGap).toBeGreaterThan(60 * DAY);
  });
});

describe('getMemoryStats 聚合', () => {
  it('返回已复习/已毕业数、30 天分布与遗忘曲线', async () => {
    const prisma: any = {
      sentence: { findFirst: vi.fn(), findMany: vi.fn(async () => []), count: vi.fn(), groupBy: vi.fn() },
      sentenceRecord: {
        findMany: vi.fn(async () => [
          { sentenceId: 1n, nextReviewAt: new Date() },
          { sentenceId: 2n, nextReviewAt: new Date(Date.now() + 5 * DAY) },
        ]),
        groupBy: vi.fn(async () => [
          { sentenceId: 1n, _count: { _all: 25 } },
          { sentenceId: 2n, _count: { _all: 3 } },
        ]),
      },
    };
    const service = new QuestionsService(
      prisma as unknown as PrismaService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const stats = await service.getMemoryStats(1);
    expect(stats.reviewed).toBe(2);
    expect(stats.graduated).toBe(1); // 25 >= 20
    expect(stats.dueToday).toBeGreaterThanOrEqual(1);
    expect(stats.distribution).toHaveLength(30);
    expect(stats.retentionCurve).toHaveLength(31);
    expect(stats.retentionCurve[0].retention).toBeCloseTo(1, 2);
  });
});
