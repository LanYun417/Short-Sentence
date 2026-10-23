/**
 * 每日句签模块。
 * 模块职责：提供句签生成（定时任务）/ 领取 / 列表能力。
 * 服务导出给 TaskModule 挂「每日句签生成」定时任务；控制器由 ClientModule 引入以注册客户端路由。
 */
import { Module } from '@nestjs/common';
import { SentenceCardController } from './sentence-card.controller.js';
import { SentenceCardService } from './sentence-card.service.js';

@Module({
  controllers: [SentenceCardController],
  providers: [SentenceCardService],
  exports: [SentenceCardService],
})
export class SentenceCardModule {}
