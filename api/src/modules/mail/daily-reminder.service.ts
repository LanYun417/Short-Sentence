/**
 * 每日学习提醒邮件（定时任务执行体）。
 *
 * 只发给**主动开启**「每日提醒」且账号启用的用户（`client_user.email_reminder=1`）——
 * 开关本身就是同意，不做「默认全量群发」；模板 66223 的变量是 nickname。
 *
 * 两个节流：单次最多 500 封（SES 免费额度有限，超出的明天再发）、相邻邮件间隔 200ms
 * （串行发送，避免被上游按 QPS 限流）。单封失败只记日志，不中断整批。
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MailService } from '../../common/mail/mail.service.js';

@Injectable()
export class DailyReminderService {
  private readonly logger = new Logger(DailyReminderService.name);

  /** 单次最多发送封数（超出的留给下一次） */
  private static readonly MAX_PER_RUN = 500;
  /** 相邻两封的间隔（毫秒） */
  private static readonly GAP_MS = 200;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** 执行一次提醒群发。 */
  async run(): Promise<void> {
    const status = await this.mail.status();
    if (!status.enabled || !status.ready) {
      // 未启用 / 缺配置是常见状态（还没配 SES 时），用 log 而不是 warn，避免每天刷警告
      this.logger.log(`[DailyReminder] 邮件服务未就绪（enabled=${status.enabled}），本次跳过`);
      return;
    }

    const users = await this.prisma.clientUser.findMany({
      where: { emailReminder: 1, status: 1 },
      orderBy: { id: 'asc' },
      take: DailyReminderService.MAX_PER_RUN,
      select: { email: true, nickname: true },
    });
    if (users.length === 0) {
      this.logger.log('[DailyReminder] 没有开启提醒的用户，本次跳过');
      return;
    }

    let sent = 0;
    let failed = 0;
    for (const user of users) {
      try {
        await this.mail.sendDailyReminder(user.email, user.nickname);
        sent += 1;
      } catch (error) {
        failed += 1;
        this.logger.warn(
          `[DailyReminder] ${user.email} 发送失败：${error instanceof Error ? error.message : String(error)}`,
        );
      }
      // 串行 + 固定间隔：邮件服务按 QPS 限流，并发发送只会换来一片 429
      await new Promise((resolve) => setTimeout(resolve, DailyReminderService.GAP_MS));
    }
    this.logger.log(`[DailyReminder] 完成：成功 ${sent} / 失败 ${failed}（候选 ${users.length}）`);
  }
}
