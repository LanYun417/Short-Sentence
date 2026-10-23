/**
 * 微游戏化模块。
 * 模块职责：XP / 等级 / 成就 / 场景地图的查询与发放。
 * 服务导出给 ClientModule（答题 / 收藏时发 XP、解锁成就）。
 */
import { Module } from '@nestjs/common';
import { GamifyController } from './gamify.controller.js';
import { GamifyService } from './gamify.service.js';

@Module({
  controllers: [GamifyController],
  providers: [GamifyService],
  exports: [GamifyService],
})
export class GamifyModule {}
