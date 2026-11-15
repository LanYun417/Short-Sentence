/**
 * 刷题接口。
 */
import type { AnswerMode } from '../utils/storage';
import { request } from '../utils/request';
import type { AnswerResult, MemoryStats, NextQuestion } from './types';

/** 抽题范围参数（undefined 项会被剔除，避免序列化成 "undefined"）。 */
export interface NextQuestionParams {
  /** 难度 1/2/3；纯复习不给难度 */
  difficulty?: number;
  /** new 新题 / review 复习 */
  source?: 'new' | 'review';
  categoryId?: number;
  /** 节日名 */
  festival?: string;
}

/** 剔除空值，避免 GET query 出现 `difficulty=undefined`。 */
function compact(params: NextQuestionParams): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Object.keys(params).forEach((key) => {
    const value = params[key as keyof NextQuestionParams];
    if (value !== undefined && value !== null && value !== '') {
      out[key] = value;
    }
  });
  return out;
}

/** 抽下一张卡（8:2 新题/复习混抽，不含答案）。 */
export function fetchNextQuestion(params: NextQuestionParams = {}): Promise<NextQuestion> {
  return request<NextQuestion>('/client/questions/next', { data: compact(params) });
}

/** 提交答案（服务端权威判分，返回翻转面所需信息）。 */
export function submitAnswer(
  sentenceId: number,
  userAnswer: string,
  mode: AnswerMode,
  elapsedMs: number,
): Promise<AnswerResult> {
  return request<AnswerResult>(`/client/questions/${sentenceId}/answer`, {
    method: 'POST',
    data: { userAnswer, mode, elapsedMs },
  });
}

/** 收藏 / 取消收藏（同一入口，幂等）。 */
export function toggleFavorite(sentenceId: number): Promise<{ favorited: boolean }> {
  return request<{ favorited: boolean }>(`/client/questions/${sentenceId}/favorite`, { method: 'POST' });
}

/**
 * 题目反馈类型。与后端 `CreateReportDto` 的 `@IsIn` 一一对应，
 * **不要自造第五个值**：多一个会被 400 拒掉。
 */
export type ReportReason = 'wrong' | 'inappropriate' | 'image' | 'other';

/** 举报/反馈入参。用 type 而非 interface：才有隐式索引签名，能直接传给 request 的 data。 */
export type ReportSentencePayload = {
  sentenceId: number;
  reason: ReportReason;
  description?: string;
};

/**
 * 反馈某句（题目/翻译/配图有问题）。
 * 注意：这是 `sentence_report`，与 UGC 接龙的举报（`reportChainEntry`）是两套接口。
 */
export function reportSentence(payload: ReportSentencePayload): Promise<{ id: number }> {
  return request<{ id: number }>('/client/report', { method: 'POST', data: payload });
}

/** 记忆巩固统计：未来 30 天复习分布 + 理论遗忘曲线。 */
export function fetchMemoryStats(): Promise<MemoryStats> {
  return request<MemoryStats>('/client/questions/memory-stats');
}
