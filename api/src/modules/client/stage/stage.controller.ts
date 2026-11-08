/**
 * 情景闯关控制器（/api/client/stages）。
 * 权限口径：需登录（client 令牌），进度按 userId 隔离。
 */
import { Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import type { ClientUserContext } from '../../../common/types.js';
import { StageService, type ClaimResult, type StageOverview } from './stage.service.js';

@Controller('client/stages')
export class StageController {
  constructor(private readonly stages: StageService) {}

  /** 闯关地图（章节 + 关卡 + 我的进度 + 可领取数）。 */
  @Get()
  list(@CurrentClientUser() user: ClientUserContext): Promise<StageOverview> {
    return this.stages.getStages(user.userId);
  }

  /** 领取某关通关奖励（幂等）。 */
  @Post(':id/claim')
  claim(@CurrentClientUser() user: ClientUserContext, @Param('id') id: string): Promise<ClaimResult> {
    return this.stages.claim(user.userId, Number(id));
  }
}
