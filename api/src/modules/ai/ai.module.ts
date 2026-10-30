/**
 * AI 设置模块。
 * - `/api/ai-settings`：后台维护 Agnes 的 key / 地址 / 模型（AiSettingsController）；
 * - 运行时配置快照与调用能力在 CommonModule（全局），本模块只提供管理入口。
 */
import { Module } from '@nestjs/common';
import { AiSettingsController } from './ai-settings.controller.js';

@Module({
  controllers: [AiSettingsController],
})
export class AiModule {}
