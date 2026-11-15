/**
 * 每日句签：领取 / 我的 / 未拥有。
 */
import { request } from '../utils/request';
import type { MissingSentenceCards, SentenceCard } from './types';

/** 领取今日句签（完成每日目标且今日句签就绪才返回，否则 null）。 */
export function claimTodayCard(): Promise<SentenceCard | null> {
  return request<SentenceCard | null>('/client/sentence-card/claim', { method: 'POST' });
}

/** 我的句签（按获得时间倒序）。 */
export function fetchMyCards(): Promise<SentenceCard[]> {
  return request<SentenceCard[]>('/client/sentence-card/mine');
}

/** 未拥有的句签（总数 + 最近一批）。 */
export function fetchMissingCards(): Promise<MissingSentenceCards> {
  return request<MissingSentenceCards>('/client/sentence-card/missing');
}
