/**
 * 系统参数模块。
 * 模块职责：聚合参数管理接口与业务取数接口。
 *
 * `exports: [ConfigService]`：业务侧（如 TaskService 读取提醒时间、DailyReminderService
 * 读取发送小时）需要注入它取值，故对外暴露。
 */
import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller.js';
import { ConfigService } from './config.service.js';

@Module({
  controllers: [ConfigController],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
