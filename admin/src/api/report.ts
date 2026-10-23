/**
 * 题目举报接口（「短句」运营后台）。
 */
import { get, put } from './request';
import type { HandleReportPayload, PageResult, SentenceReportItem, SentenceReportQuery } from '@/types/api';

/** 举报分页列表 */
export function getReportListApi(params: SentenceReportQuery): Promise<PageResult<SentenceReportItem>> {
  return get<PageResult<SentenceReportItem>>('/reports', params);
}

/** 处理举报（标记已处理 / 驳回 + 备注） */
export function handleReportApi(id: number, payload: HandleReportPayload): Promise<null> {
  return put<null>(`/reports/${id}`, payload);
}
