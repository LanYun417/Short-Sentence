/**
 * 定时任务模块。
 * 模块职责：提供定时任务的注册、调度、执行与执行记录查询。
 *
 * 依赖说明：
 * - ScheduleModule 已在 AppModule 里 `forRoot()`（全局模块），SchedulerRegistry 随处可注入；
 * - FileLoggerService / ImageScaleService 由 CommonModule（全局）提供；
 * - PrismaService 由 PrismaModule（全局）提供。
 */
import { Module } from '@nestjs/common';
import { TaskController } from './task.controller.js';
import { TaskService } from './task.service.js';
import { SentenceModule } from '../sentence/sentence.module.js';
import { WordRootModule } from '../client/word-root/word-root.module.js';
import { SentenceCardModule } from '../client/sentence-card/sentence-card.module.js';
import { MailModule } from '../mail/mail.module.js';
import { ConfigModule } from '../config/config.module.js';
import { ClientModule } from '../client/client.module.js';

@Module({
  // SentenceModule：把「短句题库生成」并入本模块的任务注册表，
  // 使其出现在管理端定时任务页并记录执行日志（此前它在 SentenceGenService 里自建 cron，页面上看不到）
  // WordRootModule：词根词典每日入库
  // SentenceCardModule：每日句签 AI 生成
  // MailModule：每日学习提醒邮件（DailyReminderService.run）
  // ConfigModule：读取/热更新每日提醒的发送时间与开关（sys_config）
  // ClientModule：接龙主题周更（ChainService.generateWeeklyTopics；ClientModule 不依赖 TaskModule，无循环）
  imports: [SentenceModule, WordRootModule, SentenceCardModule, MailModule, ConfigModule, ClientModule],
  controllers: [TaskController],
  providers: [TaskService],
})
export class TaskModule {}
