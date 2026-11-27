/**
 * 邮件设置模块。
 *
 * - `/api/mail-settings`：后台维护 SES 凭证/模板/发件人（MailSettingsController）；
 * - 发送能力本身在 CommonModule 的 MailService（全局）；
 * - 每日提醒的执行体 DailyReminderService 由 TaskModule 的「daily-reminder」任务调用，
 *   所以这里 exports 出去。
 */
import { Module } from '@nestjs/common';
import { MailSettingsController } from './mail-settings.controller.js';
import { DailyReminderService } from './daily-reminder.service.js';
import { WeeklyReportService } from './weekly-report.service.js';
import { ConfigModule } from '../config/config.module.js';
import { GamifyModule } from '../client/gamify/gamify.module.js';

@Module({
  // ConfigModule：读取每日提醒的发送小时（sys.mail.reminderHour），用于「到点才发」的闸门
  // GamifyModule：周报邮件复用 GamifyService.weeklyReport 的统计口径，避免邮件与站内数字漂移
  imports: [ConfigModule, GamifyModule],
  controllers: [MailSettingsController],
  providers: [DailyReminderService, WeeklyReportService],
  exports: [DailyReminderService, WeeklyReportService],
})
export class MailModule {}
