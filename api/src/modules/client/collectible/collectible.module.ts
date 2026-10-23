/**
 * 每日藏品模块。
 * 模块职责：提供藏品生成（定时任务）/ 领取 / 列表能力。
 * 服务导出给 TaskModule 挂「每日藏品生成」定时任务；控制器由 ClientModule 引入以注册客户端路由。
 */
import { Module } from '@nestjs/common';
import { CollectibleController } from './collectible.controller.js';
import { CollectibleService } from './collectible.service.js';

@Module({
  controllers: [CollectibleController],
  providers: [CollectibleService],
  exports: [CollectibleService],
})
export class CollectibleModule {}
