/**
 * 排行榜接口（「短句」运营后台）。
 * 对应后端 `LeaderboardAdminController`（/api/leaderboards）。
 */
import { get } from './request';
import type { LeaderboardAdminBoard, LeaderboardType, LeaderboardUserRanks } from '@/types/api';

/** 榜单类型枚举 */
export function getLeaderboardTypesApi(): Promise<LeaderboardType[]> {
  return get<LeaderboardType[]>('/leaderboards/types');
}

/** 实时榜单（带用户邮箱，不走客户端缓存） */
export function getLeaderboardBoardApi(params: { type: string; topN?: number }): Promise<LeaderboardAdminBoard> {
  return get<LeaderboardAdminBoard>('/leaderboards/board', params);
}

/** 按邮箱/昵称查用户在全部榜上的名次 */
export function getLeaderboardUserRanksApi(params: { keyword: string }): Promise<LeaderboardUserRanks> {
  return get<LeaderboardUserRanks>('/leaderboards/user', params);
}
