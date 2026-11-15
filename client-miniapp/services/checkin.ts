/**
 * 打卡接口。
 *
 * 说明：作答本身就会 upsert 今日打卡行（CheckinService.recordAnswer），
 * 因此小程序侧只需要读进度，不需要额外的「打卡」按钮调用。
 */
import { request } from '../utils/request';
import type { TodayCheckin } from './types';

/** 今日进度（doneCount / goalCount / streak）。 */
export function fetchTodayCheckin(): Promise<TodayCheckin> {
  return request<TodayCheckin>('/client/checkin/today');
}
