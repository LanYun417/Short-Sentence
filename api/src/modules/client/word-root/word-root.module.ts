/**
 * 词根词典模块。
 * 模块职责：提供词根搜索/查词/每日入库服务；同时被 TaskModule 引入以注册每日入库任务。
 */
import { Module } from '@nestjs/common';
import { WordRootController } from './word-root.controller.js';
import { WordRootService } from './word-root.service.js';

@Module({
  controllers: [WordRootController],
  providers: [WordRootService],
  exports: [WordRootService],
})
export class WordRootModule {}
