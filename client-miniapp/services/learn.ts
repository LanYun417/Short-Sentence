/**
 * 学习增值能力：题库、每日 Boss、音标、词根、周报、AI 私教。
 */
import { request } from '../utils/request';
import type {
  BossAnswerResult,
  BossToday,
  CategoryBank,
  CoachAdvice,
  CoachProfile,
  FestivalBank,
  IpaLearnedResult,
  IpaPhonemeGroup,
  IpaProgressItem,
  WeeklyReport,
  WordRootItem,
} from './types';

/** 每日 AI 额度（与后端 AiQuotaUsage 同构）。 */
export interface AiQuotaUsageLike {
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

/** 场景题库（排除节日）。 */
export function fetchCategoryBanks(): Promise<CategoryBank[]> {
  return request<CategoryBank[]>('/client/categories');
}

/** 节日题库。 */
export function fetchFestivalBanks(): Promise<FestivalBank[]> {
  return request<FestivalBank[]>('/client/questions/festivals');
}

/* ------------------------------ 每日 Boss ------------------------------ */

/** 今日 Boss（当天固定一道）。 */
export function fetchBoss(): Promise<BossToday> {
  return request<BossToday>('/client/questions/boss');
}

/** 提交 Boss 答案（判分复用刷题口径，额外发通关经验）。 */
export function answerBoss(sentenceId: number, userAnswer: string, elapsedMs: number): Promise<BossAnswerResult> {
  return request<BossAnswerResult>('/client/questions/boss/answer', {
    method: 'POST',
    data: { sentenceId, userAnswer, elapsedMs },
  });
}

/* ------------------------------ 音标 ------------------------------ */

/** 音标库（分组下发）。 */
export function fetchIpaPhonemes(): Promise<{ groups: IpaPhonemeGroup[]; total: number }> {
  return request<{ groups: IpaPhonemeGroup[]; total: number }>('/client/ipa/phonemes');
}

/** 我的音标进度。 */
export function fetchIpaProgress(): Promise<{ learnedCount: number; items: IpaProgressItem[] }> {
  return request<{ learnedCount: number; items: IpaProgressItem[] }>('/client/ipa/progress');
}

/** 标记某个音标「学会了」（首次发 XP）。 */
export function markIpaLearned(symbol: string): Promise<IpaLearnedResult> {
  return request<IpaLearnedResult>('/client/ipa/learned', { method: 'POST', data: { symbol } });
}

/* ------------------------------ 词根 ------------------------------ */

/** 搜索词根（q 为空返回热门词）。 */
export function searchWordRoots(q: string): Promise<WordRootItem[]> {
  const data: Record<string, unknown> = {};
  if (q.trim()) {
    data.q = q.trim();
  }
  return request<WordRootItem[]>('/client/word-roots', { data });
}

/** 查词：命中缓存直接返回，未命中实时 AI 解析并入库（会计一次 AI 额度）。 */
export function fetchWordRoot(word: string): Promise<WordRootItem> {
  return request<WordRootItem>(`/client/word-roots/${encodeURIComponent(word)}`);
}

/* ------------------------------ 周报 ------------------------------ */

/** 周学习报告。 */
export function fetchWeeklyReport(): Promise<WeeklyReport> {
  return request<WeeklyReport>('/client/gamify/weekly-report');
}

/* ------------------------------ AI 私教 ------------------------------ */

/** 薄弱点画像 + 今日计划（纯计算，始终可用）。 */
export function fetchCoachProfile(): Promise<CoachProfile> {
  return request<CoachProfile>('/client/ai/coach/profile');
}

/** 私教点评（AI 不可用时自动降级为规则文案，始终 200）。 */
export function requestCoachAdvice(): Promise<CoachAdvice> {
  return request<CoachAdvice>('/client/ai/coach/advice', { method: 'POST' });
}

/** 今日 AI 额度。 */
export function fetchAiQuota(): Promise<AiQuotaUsageLike> {
  return request<AiQuotaUsageLike>('/client/ai/quota');
}
