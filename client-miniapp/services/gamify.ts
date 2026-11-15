/**
 * 成长激励接口。
 */
import { request } from '../utils/request';
import type { GamifyOverview } from './types';

/** 成长概览（XP / 等级 / 成就 / 场景地图）。 */
export function fetchGamifyOverview(): Promise<GamifyOverview> {
  return request<GamifyOverview>('/client/gamify/overview');
}
