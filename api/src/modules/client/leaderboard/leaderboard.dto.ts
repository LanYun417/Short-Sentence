/**
 * 排行榜查询 DTO（客户端）。
 */
import { IsIn } from 'class-validator';

/**
 * 榜单类型：
 * - today_answered 今日答题数榜
 * - today_correct  今日答对数榜
 */
export const LEADERBOARD_TYPES = ['today_answered', 'today_correct'] as const;
export type LeaderboardType = (typeof LEADERBOARD_TYPES)[number];

export class LeaderboardQueryDto {
  /** 榜单类型（必填）：today_answered / today_correct */
  @IsIn([...LEADERBOARD_TYPES], { message: 'type 只支持 today_answered / today_correct' })
  type!: LeaderboardType;
}
