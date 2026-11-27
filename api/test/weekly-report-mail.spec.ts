/**
 * 每周学习报告邮件：订阅过滤、上一完整周口径、零作答跳过、按周幂等、失败隔离。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WeeklyReportService } from '../src/modules/mail/weekly-report.service.js';

interface Candidate {
  id: bigint;
  email: string;
  nickname: string;
}

function buildService(options: {
  candidates: Candidate[];
  templateWeekly?: number;
  ready?: boolean;
  alreadySent?: string[];
  report?: (userId: number) => {
    answered: number;
    correct: number;
    accuracy: number;
    activeDays: number;
    xpGained: number;
    newAchievements: number;
    streak: number;
    deltaAnswered: number;
    topCategory: { name: string; count: number } | null;
  };
  failFor?: string;
}) {
  const sendWeeklyReport = vi.fn(async (to: string) => {
    if (to === options.failFor) {
      throw new Error('SES 429');
    }
  });
  const findMany = vi.fn(async () => options.candidates);
  const fakePrisma = { clientUser: { findMany } };
  const fakeMail = {
    settings: vi.fn(async () => ({ templateWeekly: options.templateWeekly ?? 66224 })),
    status: vi.fn(async () => ({ enabled: true, ready: options.ready ?? true, missing: [] as string[] })),
    sendWeeklyReport,
  };
  const fakeRedis = {
    sMembers: vi.fn(async () => options.alreadySent ?? []),
    sAdd: vi.fn(async () => true),
    expire: vi.fn(async () => true),
  };
  const weeklyReport = vi.fn(async (userId: number) => {
    const fallback = {
      answered: 20,
      correct: 16,
      accuracy: 0.8,
      activeDays: 5,
      xpGained: 120,
      newAchievements: 1,
      streak: 5,
      deltaAnswered: 3,
      topCategory: { name: '咖啡店点单', count: 8 },
    };
    return options.report?.(userId) ?? fallback;
  });
  const service = new WeeklyReportService(
    fakePrisma as never,
    fakeMail as never,
    fakeRedis as never,
    { weeklyReport } as never,
  );
  return { service, sendWeeklyReport, findMany, weeklyReport, fakeRedis };
}

describe('WeeklyReportService', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // 固定到 2026-11-23 周一 09:30（上一完整周 = 11-16 ~ 11-22）
    vi.setSystemTime(new Date('2026-11-23T09:30:00+08:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('模板未配置直接跳过，不查用户', async () => {
    const { service, sendWeeklyReport, findMany } = buildService({
      candidates: [{ id: 1n, email: 'a@example.com', nickname: 'A' }],
      templateWeekly: 0,
    });

    await service.run();

    expect(findMany).not.toHaveBeenCalled();
    expect(sendWeeklyReport).not.toHaveBeenCalled();
  });

  it('订阅用户收到上一完整周的报告，带齐模板变量并记账', async () => {
    const { service, sendWeeklyReport, weeklyReport, fakeRedis } = buildService({
      candidates: [{ id: 1n, email: 'a@example.com', nickname: '小明' }],
    });

    await service.run();

    expect(weeklyReport).toHaveBeenCalledWith(1, new Date('2026-11-16T00:00:00+08:00'));
    expect(sendWeeklyReport).toHaveBeenCalledTimes(1);
    expect(sendWeeklyReport).toHaveBeenCalledWith(
      'a@example.com',
      '小明',
      expect.objectContaining({
        weekStart: '2026-11-16',
        weekEnd: '2026-11-22',
        answered: '20',
        correct: '16',
        accuracy: '80%',
        activeDays: '5',
        xpGained: '120',
        newAchievements: '1',
        streak: '5',
        topCategory: '咖啡店点单',
        deltaAnswered: '+3',
      }),
    );
    expect(fakeRedis.sAdd).toHaveBeenCalledWith('mail:weekly:sent:2026-11-16', '1');
    expect(fakeRedis.expire).toHaveBeenCalledWith('mail:weekly:sent:2026-11-16', 14 * 24 * 60 * 60 * 1000);
  });

  it('上一周零作答的用户不发，避免 0/0 打扰', async () => {
    const { service, sendWeeklyReport, fakeRedis } = buildService({
      candidates: [{ id: 1n, email: 'idle@example.com', nickname: '休眠' }],
      report: () => ({
        answered: 0,
        correct: 0,
        accuracy: 0,
        activeDays: 0,
        xpGained: 0,
        newAchievements: 0,
        streak: 0,
        deltaAnswered: -5,
        topCategory: null,
      }),
    });

    await service.run();

    expect(sendWeeklyReport).not.toHaveBeenCalled();
    expect(fakeRedis.sAdd).not.toHaveBeenCalled();
  });

  it('本周已发过的人从查询中排除（重启补跑不重复）', async () => {
    const { service, findMany } = buildService({
      candidates: [{ id: 2n, email: 'b@example.com', nickname: 'B' }],
      alreadySent: ['1'],
    });

    await service.run();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { notIn: [1n] } }) }),
    );
  });

  it('单人发送失败不影响下一位，且失败者不记账', async () => {
    const { service, sendWeeklyReport, fakeRedis } = buildService({
      candidates: [
        { id: 1n, email: 'bad@example.com', nickname: '失败' },
        { id: 2n, email: 'good@example.com', nickname: '成功' },
      ],
      failFor: 'bad@example.com',
    });

    await service.run();

    expect(sendWeeklyReport).toHaveBeenCalledTimes(2);
    expect(fakeRedis.sAdd).toHaveBeenCalledTimes(1);
    expect(fakeRedis.sAdd).toHaveBeenCalledWith('mail:weekly:sent:2026-11-16', '2');
  });
});
