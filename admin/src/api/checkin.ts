/**
 * 打卡管理接口（「短句」运营后台）。
 * 对应后端 `CheckinAdminController`（/api/checkins）。
 */
import { get, post } from './request';
import type { CheckinAdminStats, CheckinBackfillResult, CheckinRecordItem, PageResult } from '@/types/api';

/** 近 N 天打卡日历统计 + 今日汇总 */
export function getCheckinStatsApi(days = 30): Promise<CheckinAdminStats> {
  return get<CheckinAdminStats>('/checkins/stats', { days });
}

/** 打卡记录分页审计 */
export function getCheckinRecordListApi(params: {
  page: number;
  pageSize: number;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
  completed?: string;
}): Promise<PageResult<CheckinRecordItem>> {
  return get<PageResult<CheckinRecordItem>>('/checkins/records', params);
}

/** 补签（幂等；重算 streak） */
export function backfillCheckinApi(data: {
  email: string;
  date: string;
  reason: string;
}): Promise<CheckinBackfillResult> {
  return post<CheckinBackfillResult>('/checkins/backfill', data);
}

/** 撤销某天打卡（幂等；重算 streak） */
export function revokeCheckinApi(data: {
  email: string;
  date: string;
  reason: string;
}): Promise<{ revoked: boolean; date: string }> {
  return post<{ revoked: boolean; date: string }>('/checkins/revoke', data);
}
