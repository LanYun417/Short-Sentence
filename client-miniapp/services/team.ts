/**
 * 弱连接组队（小分队）。
 *
 * 改名 `PATCH /client/team/name` 未接入：`wx.request` 不支持 PATCH。
 */
import { request } from '../utils/request';
import type { TeamMessage, TeamView } from './types';

/** 我的小队（无队伍返回 null）。 */
export function fetchMyTeam(): Promise<TeamView | null> {
  return request<TeamView | null>('/client/team/my');
}

/** 自建队伍（创建者为队长）。 */
export function createTeam(name: string): Promise<TeamView> {
  return request<TeamView>('/client/team/create', { method: 'POST', data: { name } });
}

/** 凭组队码加入。 */
export function joinTeam(code: string): Promise<TeamView> {
  return request<TeamView>('/client/team/join', { method: 'POST', data: { code } });
}

/** 退出小队。 */
export function leaveTeam(): Promise<{ left: boolean }> {
  return request<{ left: boolean }>('/client/team/leave', { method: 'POST' });
}

/** 找队友（按近 7 天节奏随机匹配，或进等待池）。 */
export function matchTeam(): Promise<TeamView> {
  return request<TeamView>('/client/team/match', { method: 'POST' });
}

/** 群聊消息（游标分页：before = 上一页最老消息 id）。 */
export function fetchTeamMessages(before?: number): Promise<{ list: TeamMessage[]; hasMore: boolean }> {
  const data: Record<string, unknown> = { limit: 30 };
  if (before) {
    data.before = before;
  }
  return request<{ list: TeamMessage[]; hasMore: boolean }>('/client/team/messages', { data });
}

/** 发送群聊消息。 */
export function sendTeamMessage(content: string, quoteId?: number): Promise<TeamMessage> {
  const data: Record<string, unknown> = { content };
  if (quoteId) {
    data.quoteId = quoteId;
  }
  return request<TeamMessage>('/client/team/messages', { method: 'POST', data });
}

/** 撤回自己的消息（2 分钟内）。 */
export function recallTeamMessage(messageId: number): Promise<null> {
  return request<null>(`/client/team/messages/${messageId}/recall`, { method: 'POST' });
}
