/**
 * IP 黑名单管理接口（后台 /ip-ban）。
 */
import { del, get, post } from './request';
import type { PageResult } from '@/types/api';

/** 封禁记录 */
export interface IpBanRecord {
  id: number;
  ip: string;
  reason: string;
  type: 'auto' | 'manual';
  scope: 'register' | 'login' | 'captcha' | 'manual';
  expiresAt: string | null;
  unbannedAt: string | null;
  operator: string | null;
  createdAt: string;
  updatedAt: string;
  active: boolean;
}

/** 概览统计 */
export interface IpBanStats {
  total: number;
  active: number;
  autoActive: number;
}

/** 列表查询参数 */
export interface IpBanQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  activeOnly?: boolean;
}

/** 分页列表 */
export function getIpBanListApi(params: IpBanQuery): Promise<PageResult<IpBanRecord>> {
  return get<PageResult<IpBanRecord>>('/ip-ban', params);
}

/** 概览统计 */
export function getIpBanStatsApi(): Promise<IpBanStats> {
  return get<IpBanStats>('/ip-ban/stats');
}

/** 人工封禁 */
export function addIpBanApi(data: { ip: string; reason?: string; hours?: number }): Promise<IpBanRecord> {
  return post<IpBanRecord>('/ip-ban', data);
}

/** 解封 */
export function removeIpBanApi(ip: string): Promise<null> {
  return del<null>(`/ip-ban/${encodeURIComponent(ip)}`);
}
