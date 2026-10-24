/**
 * 客户端用户管理模块。
 * 引入 GamifyModule / SentenceCardModule：用户详情要同时展示客户端个人中心的
 * 「成长」与「句签」，并提供漏签补发，能力直接复用同一批 service（不另写一套）。
 */
import { Module } from '@nestjs/common';
import { ClientUsersController } from './client-users.controller.js';
import { ClientUsersService } from './client-users.service.js';
import { GamifyModule } from '../client/gamify/gamify.module.js';
import { SentenceCardModule } from '../client/sentence-card/sentence-card.module.js';

@Module({
  imports: [GamifyModule, SentenceCardModule],
  controllers: [ClientUsersController],
  providers: [ClientUsersService],
})
export class ClientUsersModule {}
