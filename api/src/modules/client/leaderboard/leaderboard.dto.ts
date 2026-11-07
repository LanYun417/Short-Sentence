/**
 * 排行榜查询 DTO（客户端）。
 */
import { IsIn } from 'class-validator';

/**
 * 榜单类型：
 * - today_answered 今日答题数榜
 * - today_correct  今日答对数榜
 * - checkin_total  打卡榜（累计打卡天数，全历史；打卡记录不受答题保留期清理，累计口径可靠）
 */
export const LEADERBOARD_TYPES = ['today_answered', 'today_correct', 'checkin_total'] as const;
export type LeaderboardType = (typeof LEADERBOARD_TYPES)[number];

/** 榜单展示单位：打卡榜是「天」，其余是「题」。 */
export function leaderboardUnit(type: LeaderboardType): string {
  return type === 'checkin_total' ? '天' : '题';
}

export class LeaderboardQueryDto {
  /** 榜单类型（必填）：today_answered / today_correct */
  @IsIn([...LEADERBOARD_TYPES], { message: 'type 只支持 today_answered / today_correct' })
  type!: LeaderboardType;
}
