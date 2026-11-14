import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { GamifyService } from '../src/modules/client/gamify/gamify.service.js';

/**
 * 周学习报告（/client/gamify/weekly-report）的聚合口径。
 *
 * 要守住的三条：
 * 1. **周界固定为周一 00:00（东八区）**——用户心智里的「本周」，
 *    不能因为今天是周日就把昨天算到上周；
 * 2. 正确率/活跃天数/每日明细互相自洽（明细之和 == 总答题数）；
 * 3. 本周没作答时全为 0 且不崩（新用户首次打开周报）。
 */

const DAY = 24 * 60 * 60 * 1000;
const OFFSET = 8 * 60 * 60 * 1000;

/** 东八区「本周一 00:00」的毫秒数（测试内独立实现，避免与被测代码同源而失去校验意义）。 */
function weekStartMs(now = Date.now()): number {
  const shanghai = new Date(now + OFFSET);
  const dayStart = Date.UTC(shanghai.getUTCFullYear(), shanghai.getUTCMonth(), shanghai.getUTCDate()) - OFFSET;
  const weekday = new Date(dayStart + OFFSET).getUTCDay(); // 0=周日
  return dayStart - ((weekday + 6) % 7) * DAY;
}

function makeService(records: Array<{ isCorrect: number; createdAt: Date; category?: string }>, prevAnswered = 0) {
  const prisma: any = {
    sentenceRecord: {
      findMany: vi.fn(async () =>
        records.map((r) => ({
          isCorrect: r.isCorrect,
          createdAt: r.createdAt,
          sentence: r.category ? { category: { name: r.category } } : null,
        })),
      ),
      count: vi.fn(async () => prevAnswered),
    },
    clientXpLog: { aggregate: vi.fn(async () => ({ _sum: { amount: 42 } })) },
    userAchievement: { count: vi.fn(async () => 2) },
    userCheckin: { findFirst: vi.fn(async () => ({ streak: 5 })) },
  };
  return new GamifyService(prisma as unknown as PrismaService);
}

describe('GamifyService.weeklyReport', () => {
  it('本周无作答时全为 0，且 daily 固定 7 天', async () => {
    const service = makeService([], 0);
    const report = await service.weeklyReport(1);

    expect(report.answered).toBe(0);
    expect(report.correct).toBe(0);
    expect(report.accuracy).toBe(0);
    expect(report.activeDays).toBe(0);
    expect(report.topCategory).toBeNull();
    expect(report.daily).toHaveLength(7);
    expect(report.daily.every((d) => d.answered === 0)).toBe(true);
    // 未作答也应有连续打卡与经验（打卡独立于答题）
    expect(report.streak).toBe(5);
    expect(report.xpGained).toBe(42);
  });

  it('正确率、活跃天数与每日明细自洽', async () => {
    const start = weekStartMs();
    const service = makeService(
      [
        { isCorrect: 1, createdAt: new Date(start + 1 * 60 * 60 * 1000), category: '餐饮美食' },
        { isCorrect: 0, createdAt: new Date(start + 2 * 60 * 60 * 1000), category: '餐饮美食' },
        { isCorrect: 1, createdAt: new Date(start + 3 * DAY), category: '旅行出行' },
      ],
      4,
    );
    const report = await service.weeklyReport(1);

    expect(report.answered).toBe(3);
    expect(report.correct).toBe(2);
    expect(report.accuracy).toBeCloseTo(0.667, 3);
    expect(report.activeDays).toBe(2);
    expect(report.daily.reduce((sum, d) => sum + d.answered, 0)).toBe(3);
    // 练得最多的场景
    expect(report.topCategory).toEqual({ name: '餐饮美食', count: 2 });
    // 与上周对比
    expect(report.prevAnswered).toBe(4);
    expect(report.deltaAnswered).toBe(-1);
  });

  it('周界是周一 00:00（东八区），周日属于本周而非下周', async () => {
    const start = weekStartMs();
    // 周日 23:59 的记录必须落在本周最后一天
    const sundayLate = new Date(start + 7 * DAY - 60 * 1000);
    const service = makeService([{ isCorrect: 1, createdAt: sundayLate }], 0);
    const report = await service.weeklyReport(1);

    expect(report.daily[6]!.answered).toBe(1);
    expect(report.daily[6]!.weekday).toBe('周日');
  });

  it('daily 的 date 从周一开始连续 7 天', async () => {
    const service = makeService([], 0);
    const report = await service.weeklyReport(1);
    const first = new Date(report.daily[0]!.date + 'T00:00:00Z').getTime();
    for (let i = 1; i < 7; i++) {
      const current = new Date(report.daily[i]!.date + 'T00:00:00Z').getTime();
      expect(current - first).toBe(i * DAY);
    }
    expect(report.daily.map((d) => d.weekday)).toEqual(['周一', '周二', '周三', '周四', '周五', '周六', '周日']);
  });
});
