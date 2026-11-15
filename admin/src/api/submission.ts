/**
 * 用户投稿审核接口（「短句」运营后台）。
 *
 * 投稿是用户自己写的句子与译法，审核通过后进「投稿精选」（展示位）；
 * **不进刷题池**——刷题题必须过 AI 生成与配图审核，口径不同。
 */
import { get, post } from './request';
import type { ClientSubmissionItem, ClientSubmissionQuery, PageResult, ReviewSubmissionPayload } from '@/types/api';

/** 投稿分页列表（按状态 / 关键词筛选） */
export function getSubmissionListApi(params: ClientSubmissionQuery): Promise<PageResult<ClientSubmissionItem>> {
  return get<PageResult<ClientSubmissionItem>>('/submissions', params);
}

/** 审核投稿：approve 进精选 / reject 驳回（可带原因，下发给投稿人） */
export function reviewSubmissionApi(id: number, payload: ReviewSubmissionPayload): Promise<null> {
  return post<null>(`/submissions/${id}/review`, payload);
}
