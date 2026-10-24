/**
 * 客户端用户管理接口（「短句」运营后台）。
 */
import { del, get, post, put } from './request';
import type {
  BackfillSentenceCardsResult,
  ClientUserDetail,
  ClientUserGrowth,
  ClientUserItem,
  ClientUserQuery,
  ClientUserSentenceCard,
  PageResult,
} from '@/types/api';

/** 分页查询客户端用户 */
export function getClientUserListApi(params: ClientUserQuery): Promise<PageResult<ClientUserItem>> {
  return get<PageResult<ClientUserItem>>('/client-users', params);
}

/** 用户详情（含学习数据与最近答题） */
export function getClientUserDetailApi(id: number): Promise<ClientUserDetail> {
  return get<ClientUserDetail>(`/client-users/${id}`);
}

/** 成长概览（XP / 等级 / 成就 / 场景地图） */
export function getClientUserGrowthApi(id: number): Promise<ClientUserGrowth> {
  return get<ClientUserGrowth>(`/client-users/${id}/growth`);
}

/** 已获得的句签列表 */
export function getClientUserSentenceCardsApi(id: number): Promise<ClientUserSentenceCard[]> {
  return get<ClientUserSentenceCard[]>(`/client-users/${id}/sentence-cards`);
}

/** 补发过往漏领的句签（幂等） */
export function backfillClientUserSentenceCardsApi(id: number): Promise<BackfillSentenceCardsResult> {
  return post<BackfillSentenceCardsResult>(`/client-users/${id}/sentence-cards/backfill`);
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

/** 删除用户（级联清理学习数据，日志类表保留） */
export function deleteClientUserApi(id: number): Promise<null> {
  return del<null>(`/client-users/${id}`);
}
