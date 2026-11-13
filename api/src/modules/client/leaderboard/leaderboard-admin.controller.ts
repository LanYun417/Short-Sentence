/**
 * 排行榜管理控制器（/api/leaderboards）——运营后台用。
 *
 * 只读查询：实时榜单（不走客户端 60s 缓存，带用户邮箱）+ 按用户查全部榜单名次。
 * 客户端榜单走 /api/client/leaderboard，二者共用同一个 LeaderboardService 的聚合口径。
 *
 * 权限码 sentence:leaderboard（超管直通）。
 */
import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../../../common/auth/permission.guard.js';
import { readNumber, readString } from '../../../common/utils/utils.js';
import { LEADERBOARD_TYPES, type LeaderboardType } from './leaderboard.dto.js';
import { LeaderboardService } from './leaderboard.service.js';
import { AppException } from '../../../common/exception/app.exception.js';

@Controller('leaderboards')
export class LeaderboardAdminController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  /** 榜单类型枚举（前端下拉用）。 */
  @Get('types')
  @RequirePermissions('sentence:leaderboard')
  types() {
    return [...LEADERBOARD_TYPES];
  }

  /** 实时榜单：type 必填，topN 可选（1~500，默认 100）。 */
  @Get('board')
  @RequirePermissions('sentence:leaderboard')
  async board(@Query() query: Record<string, unknown>) {
    const type = readString(query.type);
    if (!type || !LEADERBOARD_TYPES.includes(type as LeaderboardType)) {
      throw AppException.badRequest(`type 只支持 ${LEADERBOARD_TYPES.join(' / ')}`);
    }
    return this.leaderboard.adminBoard(type as LeaderboardType, readNumber(query.topN) ?? LeaderboardService.TOP_N);
  }

  /** 按邮箱/昵称查用户在全部榜上的名次。 */
  @Get('user')
  @RequirePermissions('sentence:leaderboard')
  user(@Query() query: Record<string, unknown>) {
    const keyword = readString(query.keyword);
    if (!keyword) {
      throw AppException.badRequest('keyword 不能为空');
    }
    return this.leaderboard.adminUserRanks(keyword);
  }
}
