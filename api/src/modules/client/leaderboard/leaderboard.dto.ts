/**
 * 排行榜查询 DTO（客户端）。
 */
import { IsIn } from 'class-validator';

/**
 * 榜单类型：
 * - today_answered / today_correct  今日答题数 / 答对数
 * - week_answered  / week_correct   近 7 天答题数 / 答对数（滚动窗口）
 * - month_answered / month_correct  近 30 天答题数 / 答对数（滚动窗口）
 * - checkin_total                   打卡榜（累计打卡天数，全历史；打卡记录不受答题保留期清理）
 *
 * 周/月榜刻意采用「最近 N 个自然日」而非自然周/月：答题记录默认保留 30 天
 * （SENTENCE_RECORD_RETENTION_DAYS，每日 00:20 清理 createdAt < now-30d 的行），
 * 滚动 30 天窗口的起点距当前不足 30 天，数据完整；自然月会跨过清理边界而残缺。
 */
export const LEADERBOARD_TYPES = [
  'today_answered',
  'today_correct',
  'week_answered',
  'week_correct',
  'month_answered',
  'month_correct',
  'checkin_total',
] as const;
export type LeaderboardType = (typeof LEADERBOARD_TYPES)[number];

/** 榜单展示单位：打卡榜是「天」，其余是「题」。 */
export function leaderboardUnit(type: LeaderboardType): string {
  return type === 'checkin_total' ? '天' : '题';
}

/** 是否为「答对数」口径（其余为记录数口径）。 */
export function isCorrectLeaderboard(type: LeaderboardType): boolean {
  return type.endsWith('_correct');
}

/** 统计窗口天数：打卡榜 0 表示全历史不过滤；今日 1 / 周 7 / 月 30。 */
export function leaderboardDays(type: LeaderboardType): number {
  if (type === 'checkin_total') return 0;
  if (type.startsWith('week_')) return 7;
  if (type.startsWith('month_')) return 30;
  return 1;
}

export class LeaderboardQueryDto {
  /** 榜单类型（必填） */
  @IsIn([...LEADERBOARD_TYPES], { message: `type 只支持 ${LEADERBOARD_TYPES.join(' / ')}` })
  type!: LeaderboardType;
}
