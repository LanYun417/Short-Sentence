/**
 * 句子接龙接口（「短句」运营后台）。
 * 对应后端 `ChainAdminController`（/api/chains）。
 */
import { del, get, put } from './request';
import type {
  ChainEntryAdminItem,
  ChainEntryQuery,
  ChainTopicAdminItem,
  ChainTopicOption,
  PageResult,
} from '@/types/api';

/** 接龙条目分页列表（按举报数倒序） */
export function getChainEntryListApi(params: ChainEntryQuery): Promise<PageResult<ChainEntryAdminItem>> {
  return get<PageResult<ChainEntryAdminItem>>('/chains', params);
}

/** 主题下拉选项 */
export function getChainTopicsApi(): Promise<ChainTopicOption[]> {
  return get<ChainTopicOption[]>('/chains/topics');
}

/** 主题管理列表：全部主题（含往期已停用批次） */
export function getChainTopicsAllApi(): Promise<ChainTopicAdminItem[]> {
  return get<ChainTopicAdminItem[]>('/chains/topics/all');
}

/** 启用 / 停用一个主题（停用后客户端不再展示，仅后台可见） */
export function setChainTopicStatusApi(id: number, status: 0 | 1): Promise<null> {
  return put<null>(`/chains/topics/${id}/status`, { status });
}

/** 通过 / 拒绝 / 隐藏一条接龙 */
export function setChainEntryStatusApi(id: number, status: 'visible' | 'hidden' | 'rejected'): Promise<null> {
  return put<null>(`/chains/${id}/status`, { status });
}

/** 删除一条接龙（级联清点赞与举报记录） */
export function deleteChainEntryApi(id: number): Promise<null> {
  return del<null>(`/chains/${id}`);
}
