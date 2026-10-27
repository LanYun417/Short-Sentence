/**
 * 客户端产品反馈接口（「短句」运营后台）。
 *
 * 与 `report.ts`（题目举报）区分：举报面向某一道题，反馈面向产品本身。
 */
import { get, put } from './request';
import type { ClientFeedbackItem, ClientFeedbackQuery, HandleFeedbackPayload, PageResult } from '@/types/api';

/** 反馈分页列表（筛选 status / type / platform / keyword） */
export function getFeedbackListApi(params: ClientFeedbackQuery): Promise<PageResult<ClientFeedbackItem>> {
  return get<PageResult<ClientFeedbackItem>>('/client-feedbacks', params);
}

/** 处理反馈（标记已处理 / 驳回 + 给用户的回复 + 内部备注） */
export function handleFeedbackApi(id: number, payload: HandleFeedbackPayload): Promise<null> {
  return put<null>(`/client-feedbacks/${id}`, payload);
}
