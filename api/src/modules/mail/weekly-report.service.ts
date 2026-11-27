/**
 * 每周学习报告邮件（定时任务执行体）：每周一上午给**上一完整自然周**有学习记录、
 * 且主动订阅了周报的用户发一封汇总邮件。
 *
 * 为什么不在周一发「本周」：本周一 00:00 刚开始，站内卡片显示的是「本周至今」，
 * 邮件再用同一口径就只剩几个小时的数据。邮件固定回看刚结束的周一~周日，
 * 与站内「本周」卡片互补（想看刚过去一周的完整数据，也可在卡片里对比上周）。
 *
 * 与 DailyReminderService 同款节流与幂等：
 * - 单次最多 500 封、串行 200ms 间隔（SES 按 QPS 限流）；
 * - Redis 按「周」记账，重跑/重启不会给同一批人重复发；
 * - 模板 ID 可空：未配置时整段跳过（站内周报不受影响），配好后下次自动生效；
 * - 零作答用户不发（周报 0/0 是打扰，不是激励）。
 */
import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../../common/mail/mail.service.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GamifyService } from '../client/gamify/gamify.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** 东八区偏移（与 GamifyService 的周报口径一致） */
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
/** 微信建号占位邮箱后缀（这类账号没有真实邮箱，不能发信） */
const WECHAT_EMAIL_SUFFIX = '@wx.local';

@Injectable()
export class WeeklyReportService {
  private readonly logger = new Logger(WeeklyReportService.name);

  /** 单次最多发送封数 */
  private static readonly MAX_PER_RUN = 500;
  /** 相邻两封的间隔（毫秒） */
  private static readonly GAP_MS = 200;
  /** 按周记账集合的保留时长（14 天，足够兜住补跑与跨周重入） */
  private static readonly SENT_TTL_MS = 14 * DAY_MS;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly redis: RedisService,
    private readonly gamify: GamifyService,
  ) {}

  /** 东八区日期键（YYYY-MM-DD）。 */
  private dateKey(date: Date): string {
    return new Date(date.getTime() + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
  }

  /** 上一完整周的周一零点（东八区），与 GamifyService.weeklyReport 的区间口径对齐。 */
  private lastWeekStart(): Date {
    const shanghai = new Date(Date.now() + SHANGHAI_OFFSET_MS);
    const dayStart = new Date(
      Date.UTC(shanghai.getUTCFullYear(), shanghai.getUTCMonth(), shanghai.getUTCDate()) - SHANGHAI_OFFSET_MS,
    );
    const sinceMonday = (shanghai.getUTCDay() + 6) % 7;
    return new Date(dayStart.getTime() - (sinceMonday + 7) * DAY_MS);
  }

  /** 执行一次周报群发。 */
  async run(): Promise<void> {
    // 模板未配置是常见的初始状态（运营还没在 SES 建模板），用 log 而不是 warn
    const settings = await this.mail.settings();
    if (settings.templateWeekly <= 0) {
      this.logger.log('[WeeklyReport] 周报模板 ID 未配置，本次跳过');
      return;
    }
    const status = await this.mail.status();
    if (!status.enabled || !status.ready) {
      this.logger.log(`[WeeklyReport] 邮件服务未就绪（enabled=${status.enabled}），本次跳过`);
      return;
    }

    const weekStart = this.lastWeekStart();
    const weekEnd = new Date(weekStart.getTime() + 6 * DAY_MS);
    const key = `mail:weekly:sent:${this.dateKey(weekStart)}`;
    const alreadySent = new Set((await this.redis.sMembers(key)).map(Number));

    const candidates = await this.prisma.clientUser.findMany({
      where: {
        weeklyReportEmail: 1,
        status: 1,
        deletedAt: null,
        email: { not: { endsWith: WECHAT_EMAIL_SUFFIX } },
        id: { notIn: [...alreadySent].map((id) => BigInt(id)) },
      },
      orderBy: { id: 'asc' },
      take: WeeklyReportService.MAX_PER_RUN,
      select: { id: true, email: true, nickname: true },
    });
    if (candidates.length === 0) {
      this.logger.log('[WeeklyReport] 没有待发送用户，本次跳过');
      return;
    }

    let sent = 0;
    let skippedEmpty = 0;
    let failed = 0;
    for (const user of candidates) {
      try {
        const report = await this.gamify.weeklyReport(Number(user.id), weekStart);
        if (report.answered === 0) {
          skippedEmpty += 1;
          continue;
        }
        const delta = report.deltaAnswered;
        await this.mail.sendWeeklyReport(user.email, user.nickname, {
          weekStart: this.dateKey(weekStart),
          weekEnd: this.dateKey(weekEnd),
          answered: String(report.answered),
          correct: String(report.correct),
          accuracy: `${Math.round(report.accuracy * 100)}%`,
          activeDays: String(report.activeDays),
          xpGained: String(report.xpGained),
          newAchievements: String(report.newAchievements),
          streak: String(report.streak),
          topCategory: report.topCategory?.name ?? '暂无',
          deltaAnswered: `${delta >= 0 ? '+' : ''}${delta}`,
        });
        sent += 1;
        await this.redis.sAdd(key, String(user.id));
      } catch (error) {
        failed += 1;
        this.logger.warn(
          `[WeeklyReport] ${user.email} 发送失败：${error instanceof Error ? error.message : String(error)}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, WeeklyReportService.GAP_MS));
    }
    await this.redis.expire(key, WeeklyReportService.SENT_TTL_MS);

    this.logger.log(
      `[WeeklyReport] 完成：候选 ${candidates.length} 人，成功 ${sent} / 空周跳过 ${skippedEmpty} / 失败 ${failed}`,
    );
  }
}
