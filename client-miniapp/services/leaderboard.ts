/**
 * 排行榜接口。
 */
import { request } from '../utils/request';
import type { LeaderboardResult, LeaderboardType } from './types';

/** 拉取某个榜单（后端 60s 快照缓存，`me` 按当前用户现取）。 */
export function fetchLeaderboard(type: LeaderboardType): Promise<LeaderboardResult> {
  return request<LeaderboardResult>('/client/leaderboard', { data: { type } });
}
