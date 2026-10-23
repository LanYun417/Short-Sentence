/**
 * 客户端用户管理接口（「短句」运营后台）。
 */
import { get, post, put } from './request';
import type { ClientUserDetail, ClientUserItem, ClientUserQuery, PageResult } from '@/types/api';

/** 分页查询客户端用户 */
export function getClientUserListApi(params: ClientUserQuery): Promise<PageResult<ClientUserItem>> {
  return get<PageResult<ClientUserItem>>('/client-users', params);
}

/** 用户详情（含学习数据与最近答题） */
export function getClientUserDetailApi(id: number): Promise<ClientUserDetail> {
  return get<ClientUserDetail>(`/client-users/${id}`);
}

/** 启用 / 禁用 */
export function setClientUserStatusApi(id: number, status: number): Promise<null> {
  return put<null>(`/client-users/${id}/status`, { status });
}

/** 重置密码（同时强制下线） */
export function resetClientUserPasswordApi(id: number, newPassword: string): Promise<null> {
  return put<null>(`/client-users/${id}/password`, { newPassword });
}

/** 强制下线（不改密码，仅令旧令牌失效） */
export function forceClientUserOfflineApi(id: number): Promise<null> {
  return post<null>(`/client-users/${id}/offline`);
}
