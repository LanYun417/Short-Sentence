/**
 * 句签管理模块（运营后台）。
 * 模块职责：注册 /api/sentence-cards 路由；生成能力复用客户端域的 SentenceCardService。
 */
import { Module } from '@nestjs/common';
import { SentenceCardModule } from '../client/sentence-card/sentence-card.module.js';
import { SentenceCardsController } from './sentence-cards.controller.js';
import { SentenceCardsService } from './sentence-cards.service.js';

@Module({
  imports: [SentenceCardModule],
  controllers: [SentenceCardsController],
  providers: [SentenceCardsService],
})
export class SentenceCardsModule {}
