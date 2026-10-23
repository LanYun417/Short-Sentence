/**
 * 每日句签控制器（/api/client/sentence-card）。
 * 权限口径：需登录（client 令牌）；数据按 userId 隔离。
 */
import { Controller, Get, Post } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import type { ClientUserContext } from '../../../common/types.js';
import { SentenceCardService, type SentenceCardView } from './sentence-card.service.js';

@Controller('client/sentence-card')
export class SentenceCardController {
  constructor(private readonly sentenceCard: SentenceCardService) {}

  /** 领取今日句签（完成每日目标且今日句签就绪时返回；否则 null）。 */
  @Post('claim')
  async claim(@CurrentClientUser() user: ClientUserContext): Promise<SentenceCardView | null> {
    return this.sentenceCard.claimToday(user.userId);
  }

  /** 我的句签列表（按获得时间倒序）。 */
  @Get('mine')
  async mine(@CurrentClientUser() user: ClientUserContext): Promise<SentenceCardView[]> {
    return this.sentenceCard.listMine(user.userId);
  }
}
