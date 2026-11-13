/**
 * 音标学习模块。
 * 模块职责：音标库分发、学习进度、测验判分发奖。
 */
import { Module } from '@nestjs/common';
import { IpaController } from './ipa.controller.js';
import { IpaService } from './ipa.service.js';

@Module({
  controllers: [IpaController],
  providers: [IpaService],
  exports: [IpaService],
})
export class IpaModule {}
