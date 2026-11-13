/**
 * 音标管理接口（「短句」运营后台）。
 * 对应后端 `IpaAdminController`（/api/ipa）。
 */
import { get, post, put } from './request';
import type { IpaAdminPhoneme, IpaAdminStats, IpaLearningRecordItem, PageResult } from '@/types/api';

/** 音标分页列表（带学会人数） */
export function getIpaPhonemeListApi(params: {
  page: number;
  pageSize: number;
  keyword?: string;
  type?: string;
}): Promise<PageResult<IpaAdminPhoneme>> {
  return get<PageResult<IpaAdminPhoneme>>('/ipa/phonemes', params);
}

/** 编辑音标内容字段（symbol 不可改） */
export function updateIpaPhonemeApi(
  id: number,
  data: { type?: string; exampleWords?: string[]; tips?: string; sort?: number },
): Promise<null> {
  return put<null>(`/ipa/phonemes/${id}`, data);
}

/** 按内置种子重置全部音标内容 */
export function resetIpaSeedsApi(): Promise<{ updated: number }> {
  return post<{ updated: number }>('/ipa/phonemes/reset-seeds');
}

/** 学习统计总览 */
export function getIpaStatsApi(): Promise<IpaAdminStats> {
  return get<IpaAdminStats>('/ipa/stats');
}

/** 学习记录分页审计 */
export function getIpaRecordListApi(params: {
  page: number;
  pageSize: number;
  keyword?: string;
}): Promise<PageResult<IpaLearningRecordItem>> {
  return get<PageResult<IpaLearningRecordItem>>('/ipa/records', params);
}
