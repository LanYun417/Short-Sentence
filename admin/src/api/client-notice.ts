/**
 * 客户端公告接口（「短句」运营后台）。
 *
 * 与 `@/api/notice`（后台站内信收件箱）是**两套东西**：
 * 这里发的是用户端（Web / App）全员可见的广播公告。
 */
import { del, get, post, put } from './request';
import type { ClientNoticeItem, ClientNoticePayload, ClientNoticeQuery, PageResult } from '@/types/api';

/** 公告列表（含草稿与已撤回，带已读人数） */
export function getClientNoticeListApi(params: ClientNoticeQuery): Promise<PageResult<ClientNoticeItem>> {
  return get<PageResult<ClientNoticeItem>>('/client-notices', params);
}

/** 发布公告（payload.publish=false 时存草稿） */
export function createClientNoticeApi(payload: ClientNoticePayload): Promise<{ id: number }> {
  return post<{ id: number }>('/client-notices', payload);
}

/** 编辑公告 */
export function updateClientNoticeApi(id: number, payload: ClientNoticePayload): Promise<null> {
  return put<null>(`/client-notices/${id}`, payload);
}

/** 发布(1) / 撤回(2)。撤回后客户端立刻不可见，但保留数据与已读记录。 */
export function setClientNoticeStatusApi(id: number, status: 1 | 2): Promise<null> {
  return put<null>(`/client-notices/${id}/status`, { status });
}

/** 删除公告（已读记录随外键级联删除） */
export function deleteClientNoticeApi(id: number): Promise<null> {
  return del<null>(`/client-notices/${id}`);
}
