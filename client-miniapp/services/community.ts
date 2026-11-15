/**
 * 社区与运营：接龙 / 公告 / 反馈 / 投稿。
 */
import { request } from '../utils/request';
import type {
  ChainEntry,
  ChainTopic,
  ChainTopicDetail,
  ClientNoticeItem,
  MyFeedbackItem,
  PageResult,
  SubmissionFeatured,
  SubmissionMine,
} from './types';

/* ------------------------------ 接龙 ------------------------------ */

/** 主题列表。 */
export function fetchChainTopics(): Promise<ChainTopic[]> {
  return request<ChainTopic[]>('/client/chains');
}

/** 主题详情 + 接龙内容。 */
export function fetchChainDetail(topicId: number): Promise<ChainTopicDetail> {
  return request<ChainTopicDetail>(`/client/chains/${topicId}`);
}

/** 提交一条续写。 */
export function createChainEntry(topicId: number, contentEn: string, contentZh: string): Promise<ChainEntry> {
  return request<ChainEntry>(`/client/chains/${topicId}/entries`, {
    method: 'POST',
    data: { contentEn, contentZh },
  });
}

/** 点赞 / 取消点赞（同一入口，幂等）。 */
export function likeChainEntry(entryId: number): Promise<{ liked: boolean; likeCount: number }> {
  return request<{ liked: boolean; likeCount: number }>(`/client/chains/entries/${entryId}/like`, {
    method: 'POST',
  });
}

/** 举报（一人一条一次）。 */
export function reportChainEntry(entryId: number, reason: string): Promise<null> {
  return request<null>(`/client/chains/entries/${entryId}/report`, {
    method: 'POST',
    data: { reason },
  });
}

/* ------------------------------ 公告 ------------------------------ */

/** 我的通知（已发布；置顶优先）。 */
export function fetchNotices(page = 1, pageSize = 20): Promise<PageResult<ClientNoticeItem>> {
  return request<PageResult<ClientNoticeItem>>('/client/notices', { data: { page, pageSize } });
}

/** 未读数（红点）。 */
export function fetchUnreadCount(): Promise<{ count: number }> {
  return request<{ count: number }>('/client/notices/unread-count');
}

/** 标记单条已读（幂等）。 */
export function markNoticeRead(id: number): Promise<null> {
  return request<null>(`/client/notices/${id}/read`, { method: 'POST' });
}

/** 全部标记已读。 */
export function markAllNoticesRead(): Promise<{ count: number }> {
  return request<{ count: number }>('/client/notices/read-all', { method: 'POST' });
}

/* ------------------------------ 反馈 ------------------------------ */

/** 反馈类型（与后端 FEEDBACK_TYPES 对齐）。 */
export type FeedbackType = 'feature' | 'bug' | 'content' | 'ux' | 'other';

/**
 * 提交产品反馈。
 *
 * 注意：`platform` 后端只接受 web / android，小程序侧**不传**（走默认），
 * 且 `wx.uploadFile` 一次只能带一个文件，故小程序反馈**只支持纯文本**。
 */
export function createFeedback(type: FeedbackType, content: string, contact: string): Promise<{ id: number }> {
  const data: Record<string, unknown> = { type, content };
  if (contact.trim()) {
    data.contact = contact.trim();
  }
  return request<{ id: number }>('/client/feedback', { method: 'POST', data });
}

/** 我的反馈（含处理状态与运营回复）。 */
export function fetchMyFeedback(page = 1, pageSize = 20): Promise<PageResult<MyFeedbackItem>> {
  return request<PageResult<MyFeedbackItem>>('/client/feedback/mine', { data: { page, pageSize } });
}

/* ------------------------------ 投稿 ------------------------------ */

/** 投稿精选（审核通过）。 */
export function fetchFeaturedSubmissions(page = 1, pageSize = 20): Promise<PageResult<SubmissionFeatured>> {
  return request<PageResult<SubmissionFeatured>>('/client/submissions/featured', { data: { page, pageSize } });
}

/** 我的投稿。 */
export function fetchMySubmissions(page = 1, pageSize = 20): Promise<PageResult<SubmissionMine>> {
  return request<PageResult<SubmissionMine>>('/client/submissions/mine', { data: { page, pageSize } });
}

/** 提交一条投稿。 */
export function createSubmission(sentenceEn: string, translationZh: string, note: string): Promise<{ id: number }> {
  const data: Record<string, unknown> = { sentenceEn, translationZh };
  if (note.trim()) {
    data.note = note.trim();
  }
  return request<{ id: number }>('/client/submissions', { method: 'POST', data });
}
