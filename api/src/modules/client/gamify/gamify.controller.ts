/**
 * 微游戏化控制器（/api/client/gamify）。
 * 权限口径：需登录（client 令牌）；数据按 userId 隔离。
 */
import { Controller, Get } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import type { ClientUserContext } from '../../../common/types.js';
import { GamifyService, type GamifyOverview } from './gamify.service.js';

@Controller('client/gamify')
export class GamifyController {
  constructor(private readonly gamify: GamifyService) {}

  /** 成长概览（XP / 等级 / 成就 / 场景地图）。 */
  @Get('overview')
  async overview(@CurrentClientUser() user: ClientUserContext): Promise<GamifyOverview> {
    return this.gamify.overview(user.userId);
  }
}
