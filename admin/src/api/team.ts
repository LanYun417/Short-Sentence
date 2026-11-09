/**
 * 学习小队接口（「短句」运营后台）。
 * 对应后端 `TeamAdminController`（/api/teams）。
 */
import { get, post, put } from './request';
import type { PageResult, TeamAdminDetail, TeamAdminItem, TeamAdminStats, TeamQuery } from '@/types/api';

/** 小队概览统计 */
export function getTeamStatsApi(): Promise<TeamAdminStats> {
  return get<TeamAdminStats>('/teams/stats');
}

/** 小队分页列表 */
export function getTeamListApi(params: TeamQuery): Promise<PageResult<TeamAdminItem>> {
  return get<PageResult<TeamAdminItem>>('/teams', params);
}

/** 小队详情（成员 + 今日打卡） */
export function getTeamDetailApi(id: number): Promise<TeamAdminDetail> {
  return get<TeamAdminDetail>(`/teams/${id}`);
}

/** 解散小队（清空成员，可重新匹配） */
export function dissolveTeamApi(id: number): Promise<null> {
  return post<null>(`/teams/${id}/dissolve`);
}

/** 运营改名 */
export function renameTeamApi(id: number, name: string): Promise<null> {
  return put<null>(`/teams/${id}/name`, { name });
}
