/**
 * 每日学习提醒邮件（定时任务执行体）：**只提醒「今天还没完成目标」的人**。
 *
 * 触发时间：每天 18:30（见 task.registry）。
 * 为什么是傍晚：早上群发等于给所有人发广告；傍晚才真正「有用」——这时还没做完的人
 * 还有时间补，已经做完的人不该再被打扰。
 *
 * 判定口径与 CheckinService 完全一致（`doneCount >= goalCount` 即完成）：
 * - 今天没有打卡记录（一道题都没做）→ 未完成，要提醒；
 * - 有记录但 doneCount < goalCount → 未完成，要提醒；
 * - doneCount >= goalCount → 已完成，**跳过**。
 *
 * 只发给「我的 → 每日提醒」主动开启（`client_user.email_reminder=1`）且账号启用的用户。
 *
 * 三个节流：
 * 1. 单次最多 500 封；
 * 2. 相邻邮件间隔 200ms（串行，避免被上游按 QPS 限流）；
 * 3. **按用户幂等**：今天已经收到过提醒的人跳过——500 封要发 100 秒左右，
 *    中途部署重启会触发「启动补跑」，没有这层保护同一批人就会收到两封。
 */
import { Injectable, Logger } from '@nestjs/common';
import { config } from '../../common/config/config.js';
import { MailService } from '../../common/mail/mail.service.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class DailyReminderService {
  private readonly logger = new Logger(DailyReminderService.name);

  /** 单次最多发送封数（超出的留给下一次） */
  private static readonly MAX_PER_RUN = 500;
  /** 相邻两封的间隔（毫秒） */
  private static readonly GAP_MS = 200;
  /**
   * 最早可发送的小时（18 点）。
   *
   * 为什么要有这个闸门：TaskService 对「本周期尚未成功」的任务会在启动时补跑，
   * 若服务凌晨重启，补跑会在深夜给用户发提醒——那是打扰而不是提醒。
   * 18 点前一律跳过（当天后续的补跑也不会再来，宁可不发）。
   */
  private static readonly EARLIEST_HOUR = 18;
  /** 当天已发集合的保留时长（跨天后自然失效） */
  private static readonly SENT_TTL_MS = 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly redis: RedisService,
  ) {}

  /** 本地时区的今天（YYYY-MM-DD），与 CheckinService 同口径。 */
  private today(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  /** 执行一次提醒群发。 */
  async run(): Promise<void> {
    // 深夜补跑直接跳过（见 EARLIEST_HOUR 的说明）
    const hour = new Date().getHours();
    if (hour < DailyReminderService.EARLIEST_HOUR) {
      this.logger.log(`[DailyReminder] 当前 ${hour} 点不在发送时段（18 点后），本次跳过`);
      return;
    }

    const status = await this.mail.status();
    if (!status.enabled || !status.ready) {
      // 未启用 / 缺配置是常见状态（还没配 SES 时），用 log 而不是 warn，避免每天刷警告
      this.logger.log(`[DailyReminder] 邮件服务未就绪（enabled=${status.enabled}），本次跳过`);
      return;
    }

    const today = this.today();
    const candidates = await this.prisma.clientUser.findMany({
      where: { emailReminder: 1, status: 1 },
      orderBy: { id: 'asc' },
      take: DailyReminderService.MAX_PER_RUN,
      select: { id: true, email: true, nickname: true },
    });
    if (candidates.length === 0) {
      this.logger.log('[DailyReminder] 没有开启提醒的用户，本次跳过');
      return;
    }

    // 一次性把今天这些人的打卡记录取出来（避免逐个用户查库）
    const checkins = await this.prisma.userCheckin.findMany({
      where: { userId: { in: candidates.map((user) => user.id) }, checkinDate: today },
      select: { userId: true, doneCount: true, goalCount: true },
    });
    const checkinMap = new Map(checkins.map((row) => [Number(row.userId), row]));

    // 只留「今天还没完成」的人：没有记录 = 一道题没做，也算未完成
    const unfinished = candidates.filter((user) => {
      const record = checkinMap.get(Number(user.id));
      if (!record) {
        return true;
      }
      const goal = record.goalCount > 0 ? record.goalCount : config.sentence.dailyGoal;
      return record.doneCount < goal;
    });

    const finished = candidates.length - unfinished.length;
    if (unfinished.length === 0) {
      this.logger.log(`[DailyReminder] 今日候选 ${candidates.length} 人已完成目标，无需提醒`);
      return;
    }

    // 幂等：跳过今天已经收到过提醒的人（重启补跑不会造成重复投递）
    const sentKey = `mail:reminder:sent:${today}`;
    const alreadySent = new Set((await this.redis.sMembers(sentKey)).map((id) => Number(id)));
    const pending = unfinished.filter((user) => !alreadySent.has(Number(user.id)));
    const skipped = unfinished.length - pending.length;
    if (pending.length === 0) {
      this.logger.log(`[DailyReminder] 未完成 ${unfinished.length} 人今日均已提醒过，本次跳过`);
      return;
    }

    let sent = 0;
    let failed = 0;
    for (const user of pending) {
      try {
        await this.mail.sendDailyReminder(user.email, user.nickname);
        sent += 1;
        // 逐人记账：中途失败/重启后重跑只补发没发过的人
        await this.redis.sAdd(sentKey, String(user.id));
      } catch (error) {
        failed += 1;
        this.logger.warn(
          `[DailyReminder] ${user.email} 发送失败：${error instanceof Error ? error.message : String(error)}`,
        );
      }
      // 串行 + 固定间隔：邮件服务按 QPS 限流，并发发送只会换来一片 429
      await new Promise((resolve) => setTimeout(resolve, DailyReminderService.GAP_MS));
    }
    // 集合留 24 小时（跨天后新的一天重新计）
    await this.redis.expire(sentKey, DailyReminderService.SENT_TTL_MS);

    this.logger.log(
      `[DailyReminder] 完成：未完成 ${unfinished.length} 人（已完成跳过 ${finished} 人，今日已提醒跳过 ${skipped} 人），` +
        `成功 ${sent} / 失败 ${failed}`,
    );
  }
}
