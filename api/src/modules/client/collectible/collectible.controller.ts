/**
 * 每日藏品控制器（/api/client/collectible）。
 * 权限口径：需登录（client 令牌）；数据按 userId 隔离。
 */
import { Controller, Get, Post } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import type { ClientUserContext } from '../../../common/types.js';
import { CollectibleService, type CollectibleView } from './collectible.service.js';

@Controller('client/collectible')
export class CollectibleController {
  constructor(private readonly collectible: CollectibleService) {}

  /** 领取今日藏品（完成每日目标且今日藏品就绪时返回；否则 null）。 */
  @Post('claim')
  async claim(@CurrentClientUser() user: ClientUserContext): Promise<CollectibleView | null> {
    return this.collectible.claimToday(user.userId);
  }

  /** 我的藏品列表（按获得时间倒序）。 */
  @Get('mine')
  async mine(@CurrentClientUser() user: ClientUserContext): Promise<CollectibleView[]> {
    return this.collectible.listMine(user.userId);
  }
}
