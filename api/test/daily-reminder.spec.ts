/**
 * 每日学习提醒：**只提醒「今天还没完成目标」的人**（核心业务规则，容易被改坏）。
 *
 * 守住五件事：
 * 1. 今天没有打卡记录（一道题没做）→ 要发；
 * 2. doneCount < goalCount（做了没达标）→ 要发；
 * 3. doneCount >= goalCount（已完成）→ 不发；
 * 4. 18 点前（深夜补跑）一律不发；
 * 5. 今天已经收到过提醒的人 → 不重复发（重启补跑也不重复）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyReminderService } from '../src/modules/mail/daily-reminder.service.js';

interface Candidate {
  id: bigint;
  email: string;
  nickname: string;
}

/** 构造「只暴露 run() 用到的方法」的假依赖。 */
function buildService(options: {
  candidates: Candidate[];
  checkins: Array<{ userId: bigint; doneCount: number; goalCount: number }>;
  /** 今天已发过提醒的用户 id（模拟重启后重跑） */
  alreadySent?: string[];
}) {
  const sendDailyReminder = vi.fn(async () => undefined);
  const fakePrisma = {
    clientUser: { findMany: vi.fn(async () => options.candidates) },
    userCheckin: { findMany: vi.fn(async () => options.checkins) },
  };
  const fakeMail = {
    status: vi.fn(async () => ({ enabled: true, ready: true, missing: [] as string[] })),
    sendDailyReminder,
  };
  const fakeRedis = {
    sMembers: vi.fn(async () => options.alreadySent ?? []),
    sAdd: vi.fn(async () => true),
    expire: vi.fn(async () => true),
  };
  const service = new DailyReminderService(fakePrisma as never, fakeMail as never, fakeRedis as never);
  return { service, sendDailyReminder, fakeMail, fakeRedis };
}

describe('DailyReminderService', () => {
  beforeEach(() => {
    // 固定到傍晚 19:00（在发送时段内）。
    // shouldAdvanceTime：run() 里每封之间有 200ms 节流等待，纯 fake timers 会把它冻住
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 9, 29, 19, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('今天没有任何打卡记录 → 提醒，并记账（供重启后幂等）', async () => {
    const { service, sendDailyReminder, fakeRedis } = buildService({
      candidates: [{ id: 1n, email: 'idle@example.com', nickname: '没做题' }],
      checkins: [],
    });

    await service.run();

    expect(sendDailyReminder).toHaveBeenCalledTimes(1);
    expect(sendDailyReminder).toHaveBeenCalledWith('idle@example.com', '没做题');
    expect(fakeRedis.sAdd).toHaveBeenCalledWith(expect.stringContaining('mail:reminder:sent:'), '1');
  });

  it('做了但没达标 → 提醒；已达标的跳过', async () => {
    const { service, sendDailyReminder } = buildService({
      candidates: [
        { id: 1n, email: 'half@example.com', nickname: '做一半' },
        { id: 2n, email: 'done@example.com', nickname: '已完成' },
      ],
      checkins: [
        { userId: 1n, doneCount: 12, goalCount: 20 },
        { userId: 2n, doneCount: 20, goalCount: 20 },
      ],
    });

    await service.run();

    expect(sendDailyReminder).toHaveBeenCalledTimes(1);
    expect(sendDailyReminder).toHaveBeenCalledWith('half@example.com', '做一半');
  });

  it('超过目标（多做了几题）同样视为已完成', async () => {
    const { service, sendDailyReminder } = buildService({
      candidates: [{ id: 1n, email: 'over@example.com', nickname: '超额' }],
      checkins: [{ userId: 1n, doneCount: 25, goalCount: 20 }],
    });

    await service.run();

    expect(sendDailyReminder).not.toHaveBeenCalled();
  });

  it('18 点前（深夜补跑）不发', async () => {
    vi.setSystemTime(new Date(2026, 9, 30, 2, 0, 0));
    const { service, sendDailyReminder } = buildService({
      candidates: [{ id: 1n, email: 'late@example.com', nickname: '深夜' }],
      checkins: [],
    });

    await service.run();

    expect(sendDailyReminder).not.toHaveBeenCalled();
  });

  it('今天已提醒过的人不再重复发（重启补跑幂等）', async () => {
    const { service, sendDailyReminder } = buildService({
      candidates: [
        { id: 1n, email: 'sent@example.com', nickname: '已提醒' },
        { id: 2n, email: 'new@example.com', nickname: '待提醒' },
      ],
      checkins: [],
      alreadySent: ['1'],
    });

    await service.run();

    expect(sendDailyReminder).toHaveBeenCalledTimes(1);
    expect(sendDailyReminder).toHaveBeenCalledWith('new@example.com', '待提醒');
  });
});
