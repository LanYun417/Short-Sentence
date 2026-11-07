import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RedisService } from '../src/common/redis/redis.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { LeaderboardService } from '../src/modules/client/leaderboard/leaderboard.service.js';

/**
 * 排行榜 60 秒缓存：钉住两件事
 * 1. 同一张榜在 TTL 内只聚合一次（Redis 优先、进程内兜底均生效）；
 * 2. 缓存里存的是「整榜快照」，me 按当前用户现取，**绝不能把上一个用户的名次串给别人**。
 */

function makePrisma() {
  const groupBy = vi.fn(async () => [
    { userId: 1n, _count: { _all: 10 }, _sum: { isCorrect: 8 } },
    { userId: 2n, _count: { _all: 6 }, _sum: { isCorrect: 6 } },
  ]);
  const prisma = {
    sentenceRecord: { groupBy },
    userCheckin: { groupBy },
    clientUser: {
      findMany: vi.fn(async () => [
        { id: 1n, nickname: 'Alice', avatarFileId: 0n },
        { id: 2n, nickname: 'Bob', avatarFileId: 0n },
      ]),
    },
    file: { findMany: vi.fn(async () => []) },
  };
  return { prisma: prisma as unknown as PrismaService, groupBy };
}

function makeRedis(ready = true) {
  const store = new Map<string, { value: string; expireAt: number }>();
  const redis = {
    isReady: () => ready,
    get: vi.fn(async (key: string) => {
      const hit = store.get(key);
      if (!hit) return null;
      if (hit.expireAt <= Date.now()) {
        store.delete(key);
        return null;
      }
      return hit.value;
    }),
    set: vi.fn(async (key: string, value: string, ttlMs?: number) => {
      store.set(key, { value, expireAt: Date.now() + (ttlMs ?? 0) });
      return true;
    }),
    store,
  };
  return { redis: redis as unknown as RedisService, typed: redis };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('LeaderboardService 缓存', () => {
  it('Redis 命中时只聚合一次，且 TTL 为 60 秒', async () => {
    const { prisma, groupBy } = makePrisma();
    const { redis, typed } = makeRedis();
    const service = new LeaderboardService(prisma, redis);

    const first = await service.fetch('today_answered', 2);
    expect(first.top.map((r) => [r.userId, r.rank, r.count])).toEqual([
      [1, 1, 10],
      [2, 2, 6],
    ]);
    expect(first.me).toEqual({ rank: 2, count: 6 });
    expect(groupBy).toHaveBeenCalledTimes(1);
    expect(typed.set.mock.calls[0][2]).toBe(60_000);

    const second = await service.fetch('today_answered', 2);
    expect(second.top).toEqual(first.top);
    expect(groupBy).toHaveBeenCalledTimes(1);
  });

  it('缓存命中也不串名次：不同用户拿到各自的 me，榜外用户为 null', async () => {
    const { prisma, groupBy } = makePrisma();
    const { redis } = makeRedis();
    const service = new LeaderboardService(prisma, redis);

    await service.fetch('today_answered', 1);
    const alice = await service.fetch('today_answered', 1);
    const bob = await service.fetch('today_answered', 2);
    const outsider = await service.fetch('today_answered', 999);

    expect(alice.me).toEqual({ rank: 1, count: 10 });
    expect(bob.me).toEqual({ rank: 2, count: 6 });
    expect(outsider.me).toBeNull();
    expect(groupBy).toHaveBeenCalledTimes(1);
  });

  it('60 秒后缓存失效，重新聚合', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T10:00:00'));
    const { prisma, groupBy } = makePrisma();
    const { redis } = makeRedis();
    const service = new LeaderboardService(prisma, redis);

    await service.fetch('week_correct', 1);
    await vi.advanceTimersByTimeAsync(59_000);
    await service.fetch('week_correct', 1);
    expect(groupBy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2_000);
    const fresh = await service.fetch('week_correct', 1);
    expect(fresh.me).toEqual({ rank: 1, count: 8 }); // 答对口径取 sumCorrect
    expect(groupBy).toHaveBeenCalledTimes(2);
  });

  it('Redis 内容损坏时进程内缓存兜底；两级都坏则按 miss 重建', async () => {
    const { prisma, groupBy } = makePrisma();
    const { redis, typed } = makeRedis();
    const service = new LeaderboardService(prisma, redis);

    await service.fetch('month_answered', 1);
    const key = typed.set.mock.calls[0][0];
    typed.store.set(key, { value: '{not json', expireAt: Date.now() + 60_000 });

    // 同一个实例：Redis 坏了但进程内副本是好的，不必回源
    const fallback = await service.fetch('month_answered', 1);
    expect(fallback.top).toHaveLength(2);
    expect(groupBy).toHaveBeenCalledTimes(1);

    // 新实例（进程内缓存为空）+ Redis 仍坏：两级都 miss，回源重建并重写缓存
    const restarted = new LeaderboardService(prisma, redis);
    const result = await restarted.fetch('month_answered', 1);
    expect(result.top).toHaveLength(2);
    expect(groupBy).toHaveBeenCalledTimes(2);
    expect(typed.store.get(key)?.value).toContain('"ranks"');
  });

  it('Redis 未启用时进程内缓存仍生效', async () => {
    const { prisma, groupBy } = makePrisma();
    const { redis } = makeRedis(false);
    const service = new LeaderboardService(prisma, redis);

    await service.fetch('checkin_total', 2);
    const second = await service.fetch('checkin_total', 1);
    expect(second.unit).toBe('天');
    expect(second.me).toEqual({ rank: 1, count: 10 });
    expect(groupBy).toHaveBeenCalledTimes(1);
  });
});
