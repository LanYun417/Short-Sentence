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

@Module({
  controllers: [MailSettingsController],
  providers: [DailyReminderService],
  exports: [DailyReminderService],
})
export class MailModule {}
