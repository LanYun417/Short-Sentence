/**
 * 排行榜控制器（/api/client/leaderboard）。
 * 权限口径：需登录（client 令牌）；数据为全站聚合的匿名榜单，仅暴露昵称/头像/题数。
 */
import { Controller, Get, Query } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import type { ClientUserContext } from '../../../common/types.js';
import { GamifyService } from '../gamify/gamify.service.js';
import { LeaderboardQueryDto } from './leaderboard.dto.js';
import { LeaderboardService, type LeaderboardResult } from './leaderboard.service.js';

@Controller('client/leaderboard')
export class LeaderboardController {
  constructor(
    private readonly leaderboard: LeaderboardService,
    private readonly gamify: GamifyService,
  ) {}

  /**
   * 排行榜：type=today_* / week_* / month_*（今日、近 7 天、近 30 天答题/答对前 100）、
   * checkin_total（累计打卡天数前 100）。响应附带当前用户名次 me（未上榜为 null）。
   *
   * 名次型成就（榜上有名 / 十强之列 / 三甲之列 / 榜首加冕）在这里旁路解锁：名次只有查榜单
   * 时才算得出来，答题路径不做全表聚合；仅进入前 100 才触发，且由 GamifyService 在勋章
   * 集齐后短路，避免每次看榜都白跑一遍。
   */
  @Get()
  async fetch(
    @CurrentClientUser() user: ClientUserContext,
    @Query() query: LeaderboardQueryDto,
  ): Promise<LeaderboardResult> {
    const result = await this.leaderboard.fetch(query.type, user.userId);
    const rank = result.me?.rank;
    if (rank && rank <= 100) {
      try {
        await this.gamify.checkRankAchievements(user.userId, rank);
      } catch {
        // 成就解锁是旁路：失败不影响榜单响应（下次进入榜单或答题会重试）
      }
    }
    return result;
  }
}
