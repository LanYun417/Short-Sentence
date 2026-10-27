/**
 * 数据分析接口（「短句」运营后台）。
 */
import { get } from './request';
import type {
  ActiveTrend,
  AiCallLogItem,
  AiCallLogQuery,
  AiCallLogSummary,
  AiCallStat,
  AnalyticsOverview,
  AnswerTrend,
  CategoryStat,
  CheckinStat,
  FunnelResult,
  NameValue,
  PageResult,
  RetentionResult,
} from '@/types/api';

/** 总览指标 */
export function getAnalyticsOverviewApi(): Promise<AnalyticsOverview> {
  return get<AnalyticsOverview>('/analytics/overview');
}

/** 近 N 日答题趋势 */
export function getAnswerTrendApi(days = 7): Promise<AnswerTrend> {
  return get<AnswerTrend>('/analytics/answer-trend', { days });
}

/** 题目难度分布 */
export function getDifficultyApi(): Promise<NameValue[]> {
  return get<NameValue[]>('/analytics/difficulty');
}

/** 分类运营数据 */
export function getCategoryStatsApi(): Promise<CategoryStat[]> {
  return get<CategoryStat[]>('/analytics/category');
}

/** 近 N 日 AI 调用统计 */
export function getAiCallStatsApi(days = 7): Promise<AiCallStat[]> {
  return get<AiCallStat[]>('/analytics/ai-calls', { days });
}

/** AI 调用日志（分页） */
export function getAiLogListApi(params: AiCallLogQuery): Promise<PageResult<AiCallLogItem>> {
  return get<PageResult<AiCallLogItem>>('/analytics/ai-logs', params);
}

/** AI 调用日志汇总（与列表同一套筛选，用于「当前范围」统计卡） */
export function getAiLogSummaryApi(params: AiCallLogQuery): Promise<AiCallLogSummary> {
  return get<AiCallLogSummary>('/analytics/ai-logs/summary', params);
}

/** 打卡统计 */
export function getCheckinStatApi(): Promise<CheckinStat> {
  return get<CheckinStat>('/analytics/checkin');
}

/** 留存漏斗（窗口内注册用户：注册 → 激活 → 打卡 → 领句签） */
export function getFunnelApi(days = 30): Promise<FunnelResult> {
  return get<FunnelResult>('/analytics/funnel', { days });
}

/** 队列留存（按注册日的 D0/D1/D3/D7） */
export function getRetentionApi(days = 14): Promise<RetentionResult> {
  return get<RetentionResult>('/analytics/retention', { days });
}

/** 新增 / 日活趋势 */
export function getActiveTrendApi(days = 14): Promise<ActiveTrend> {
  return get<ActiveTrend>('/analytics/active-trend', { days });
}
