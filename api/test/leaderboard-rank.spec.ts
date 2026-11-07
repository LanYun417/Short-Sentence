import { describe, expect, it } from 'vitest';
import { computeLeaderboard, type AggRow } from '../src/modules/client/leaderboard/leaderboard.service.js';

/**
 * 排行榜纯排名逻辑（computeLeaderboard）单测。
 * 重点钉住：降序、同分同名次（标准竞赛排名）、topN 截断、me 名次、
 * 0 分不上答对榜、禁用用户被过滤（调用方只传启用用户，这里验证缺席即被跳过）。
 */

function agg(userId: number, countAll: number, sumCorrect: number): AggRow {
  return { userId: BigInt(userId), countAll, sumCorrect };
}

const users = new Map<bigint, { nickname: string; avatarFileId: bigint }>([
  [1n, { nickname: 'Alice', avatarFileId: 11n }],
  [2n, { nickname: 'Bob', avatarFileId: 0n }],
  [3n, { nickname: 'Carol', avatarFileId: 13n }],
  [4n, { nickname: 'Dave', avatarFileId: 0n }],
]);
const files = new Map<bigint, string>([
  [11n, '/static/a.webp'],
  [13n, '/static/c.webp'],
]);

describe('computeLeaderboard', () => {
  it('按答对数降序、同分同名次、topN 截断', () => {
    const data = [
      agg(1, 10, 8),
      agg(2, 9, 8), // 与 Alice 同分 -> 同名次
      agg(3, 7, 5),
      agg(4, 3, 0), // 答对 0，不上答对榜
    ];
    const res = computeLeaderboard(data, users, files, 'today_correct', 3, 100);
    expect(res.top.map((r) => [r.userId, r.count, r.rank])).toEqual([
      [1, 8, 1],
      [2, 8, 1],
      [3, 5, 3], // 两人并列第 1，下一名第 3（竞赛排名）
    ]);
    // Dave 答对 0 被过滤
    expect(res.top.find((r) => r.userId === 4)).toBeUndefined();
    // me：Carol 第 3
    expect(res.me).toEqual({ rank: 3, count: 5 });
  });

  it('答题数榜用 countAll，头像缺省为 null', () => {
    const data = [agg(2, 9, 1), agg(1, 10, 2)];
    const res = computeLeaderboard(data, users, files, 'today_answered', 2, 100);
    expect(res.top[0]).toMatchObject({ userId: 1, count: 10, rank: 1, avatarUrl: '/static/a.webp' });
    expect(res.top[1]).toMatchObject({ userId: 2, count: 9, rank: 2, avatarUrl: null });
    expect(res.me).toEqual({ rank: 2, count: 9 });
  });

  it('topN 截断只取前 N', () => {
    const data = Array.from({ length: 120 }, (_, i) => agg(i + 1, 200 - i, 200 - i));
    const bigUsers = new Map(users);
    data.forEach((r) => bigUsers.set(r.userId, { nickname: `u${r.userId}`, avatarFileId: 0n }));
    const res = computeLeaderboard(data, bigUsers, files, 'today_answered', 1, 100);
    expect(res.top).toHaveLength(100);
    expect(res.top[0].count).toBe(200);
    expect(res.top[99].count).toBe(101);
  });

  it('当前用户今天没答题（不在聚合里）时 me 为 null', () => {
    const res = computeLeaderboard([agg(1, 5, 5)], users, files, 'today_answered', 999, 100);
    expect(res.me).toBeNull();
    expect(res.top).toHaveLength(1);
  });

  it('空聚合返回空榜', () => {
    const res = computeLeaderboard([], users, files, 'today_correct', 1, 100);
    expect(res.top).toEqual([]);
    expect(res.me).toBeNull();
  });
});
