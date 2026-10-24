/**
 * 首页仪表盘接口：统计卡片、登录趋势、操作类型分布与各角色用户数。
 */
import { get } from './request';
import type { AnalyticsOverview, DashboardStats, LoginTrend, NameValue, RoleUserCount } from '@/types/api';

/** 统计卡片 */
export function getDashboardStatsApi(): Promise<DashboardStats> {
  return get<DashboardStats>('/dashboard/stats');
}

/** 客户端内容总览（题库 / 用户 / 今日活跃 / AI / 句签） */
export function getAnalyticsOverviewApi(): Promise<AnalyticsOverview> {
  return get<AnalyticsOverview>('/analytics/overview');
}

/** 近 N 日登录趋势 */
export function getLoginTrendApi(days = 7): Promise<LoginTrend> {
  return get<LoginTrend>('/dashboard/login-trend', { days });
}

/** 操作类型分布 */
export function getOperationDistributionApi(): Promise<NameValue[]> {
  return get<NameValue[]>('/dashboard/operation-distribution');
}

/** 各角色用户数 */
export function getRoleUserCountApi(): Promise<RoleUserCount> {
  return get<RoleUserCount>('/dashboard/role-user-count');
}
