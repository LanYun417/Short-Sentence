/**
 * 语句库：收藏夹 / 学习记录 / 复习池。
 */
import { request } from '../utils/request';
import type { PageResult, SentenceLibraryItem } from './types';

/** 分页参数（统一 20 条一页）。 */
export interface PagedQuery {
  page?: number;
  pageSize?: number;
}

/** 学习记录筛选类型。 */
export type HistoryKind = 'all' | 'wrong' | 'right';

/** 收藏夹。 */
export function fetchFavorites(query: PagedQuery = {}): Promise<PageResult<SentenceLibraryItem>> {
  return request<PageResult<SentenceLibraryItem>>('/client/favorites', {
    data: { page: query.page ?? 1, pageSize: query.pageSize ?? 20 },
  });
}

/** 学习记录（全部 / 错题 / 对题）。 */
export function fetchHistory(kind: HistoryKind, query: PagedQuery = {}): Promise<PageResult<SentenceLibraryItem>> {
  return request<PageResult<SentenceLibraryItem>>('/client/history', {
    data: { kind, page: query.page ?? 1, pageSize: query.pageSize ?? 20 },
  });
}

/** 复习池（答错且到期的题）。 */
export function fetchReview(query: PagedQuery = {}): Promise<PageResult<SentenceLibraryItem>> {
  return request<PageResult<SentenceLibraryItem>>('/client/review', {
    data: { page: query.page ?? 1, pageSize: query.pageSize ?? 20 },
  });
}
