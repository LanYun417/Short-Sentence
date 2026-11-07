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
   * 今日排行榜：type=today_answered 今日答题数前100 / today_correct 今日答对数前100。
   * 响应附带当前用户名次 me（未上榜为 null）。
   */
  @Get()
  async today(
    @CurrentClientUser() user: ClientUserContext,
    @Query() query: LeaderboardQueryDto,
  ): Promise<LeaderboardResult> {
    return this.leaderboard.today(query.type, user.userId);
  }
}
