/**
 * 成长体系接口（「短句」运营后台）。
 * 对应后端 `GamifyAdminController`（/api/gamify）。
 */
import { get, post, put } from './request';
import type { AchievementAdminItem, GamifyAdminStats, PageResult, XpLogAdminItem } from '@/types/api';

/** 成就列表（全部，含解锁人数） */
export function getAchievementListApi(): Promise<AchievementAdminItem[]> {
  return get<AchievementAdminItem[]>('/gamify/achievements');
}

/** 编辑成就展示字段（code 不可改） */
export function updateAchievementApi(
  code: string,
  data: {
    name?: string;
    description?: string;
    icon?: string;
    /** AI 大图 URL；空字符串 = 清空回落 lucide */
    artUrl?: string;
    category?: string;
    rewardXp?: number;
    sort?: number;
  },
): Promise<null> {
  return put<null>(`/gamify/achievements/${encodeURIComponent(code)}`, data);
}

/** XP 账本分页审计 */
export function getXpLogListApi(params: {
  page: number;
  pageSize: number;
  keyword?: string;
  eventType?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<PageResult<XpLogAdminItem>> {
  return get<PageResult<XpLogAdminItem>>('/gamify/xp-logs', params);
}

/** 手动补偿 XP（只加不减：amount 恒为正） */
export function grantXpApi(data: {
  email: string;
  amount: number;
  reason: string;
}): Promise<{ granted: boolean; balance: number }> {
  return post<{ granted: boolean; balance: number }>('/gamify/xp/grant', data);
}

/** 成长统计总览 */
export function getGamifyStatsApi(): Promise<GamifyAdminStats> {
  return get<GamifyAdminStats>('/gamify/stats');
}
