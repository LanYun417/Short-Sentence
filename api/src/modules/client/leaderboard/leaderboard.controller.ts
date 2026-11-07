/**
 * 排行榜控制器（/api/client/leaderboard）。
 * 权限口径：需登录（client 令牌）；数据为全站聚合的匿名榜单，仅暴露昵称/头像/题数。
 */
import { Controller, Get, Query } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import type { ClientUserContext } from '../../../common/types.js';
import { LeaderboardQueryDto } from './leaderboard.dto.js';
import { LeaderboardService, type LeaderboardResult } from './leaderboard.service.js';

@Controller('client/leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  /**
   * 排行榜：type=today_answered/today_correct（今日答题/答对前100）、checkin_total（累计打卡天数前100）。
   * 响应附带当前用户名次 me（未上榜为 null）。
   */
  @Get()
  async fetch(
    @CurrentClientUser() user: ClientUserContext,
    @Query() query: LeaderboardQueryDto,
  ): Promise<LeaderboardResult> {
    return this.leaderboard.fetch(query.type, user.userId);
  }
}
