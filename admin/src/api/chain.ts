/**
 * 句子接龙接口（「短句」运营后台）。
 * 对应后端 `ChainAdminController`（/api/chains）。
 */
import { del, get, put } from './request';
import type { ChainEntryAdminItem, ChainEntryQuery, ChainTopicOption, PageResult } from '@/types/api';

/** 接龙条目分页列表（按举报数倒序） */
export function getChainEntryListApi(params: ChainEntryQuery): Promise<PageResult<ChainEntryAdminItem>> {
  return get<PageResult<ChainEntryAdminItem>>('/chains', params);
}

/** 主题下拉选项 */
export function getChainTopicsApi(): Promise<ChainTopicOption[]> {
  return get<ChainTopicOption[]>('/chains/topics');
}

/** 通过 / 拒绝 / 隐藏一条接龙 */
export function setChainEntryStatusApi(id: number, status: 'visible' | 'hidden' | 'rejected'): Promise<null> {
  return put<null>(`/chains/${id}/status`, { status });
}

/** 删除一条接龙（级联清点赞与举报记录） */
export function deleteChainEntryApi(id: number): Promise<null> {
  return del<null>(`/chains/${id}`);
}
