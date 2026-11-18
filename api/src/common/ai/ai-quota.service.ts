/**
 * 客户端 AI 额度服务（每日免费次数）。
 *
 * 为什么用 Redis 而不是加表：额度是「当天用完即弃」的计数，Redis 的原子自增 + 过期天然贴合；
 * 项目已在用 Redis（令牌黑名单），不引入新的基础设施。
 *
 * 键设计：`ai:quota:{userId}:{yyyyMMdd}`
 * - **日期写进键里**，跨天自动换键 → 每日重置不需要任何定时任务；
 * - TTL 设 30 天而不是当天过期，是为了**保留用量历史**（后续按真实分布定档、做运营报表）；
 * - 时区固定按东八区算，**不读请求头里的时区**——否则用户改设备时区就能刷额度。
 *
 * 降级口径：Redis 不可用时**放行**（fail-open）并打 warn——额度服务挂掉不该让 AI 功能整体
 * 不可用，代价是这段时间不计数（成本风险有限，且 Redis 异常本身有健康检查兜底）。
 */
import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../exception/app.exception.js';
import { config } from '../config/config.js';
import { RedisService } from '../redis/redis.service.js';
import { EntitlementService } from '../pay/entitlement.service.js';

/** 额度键前缀。 */
const QUOTA_KEY_PREFIX = 'ai:quota:';

/** 用量键保留时长（同时是「历史保留期」）。 */
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** 东八区偏移（Asia/Shanghai 无夏令时，固定 +8 即可）。 */
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 今日用量。 */
export interface AiQuotaUsage {
  /** 今日已用次数 */
  used: number;
  /** 每日上限 */
  limit: number;
  /** 剩余次数 */
  remaining: number;
  /** 额度重置时间（次日 0 点，ISO） */
  resetAt: string;
}

@Injectable()
export class AiQuotaService {
  private readonly logger = new Logger(AiQuotaService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly entitlements: EntitlementService,
  ) {}

  /**
   * 扣一次额度；超限抛 429。
   *
   * 先查后加而不是「先加再判超」：后者会把被拒绝的请求也计进用量，
   * 用量数据就被污染了（后续按真实分布定档时会失真）。并发下可能多放几个，可接受。
   *
   * @param feature 触发特征（expand / word_root / word_lookup），仅用于日志与后续分池
   */
  async consume(userId: number, feature: string): Promise<void> {
    const limit = await this.resolveLimit(userId);
    const key = this.keyOf(userId);
    const used = await this.currentUsed(key);
    if (used >= limit) {
      const isVip = await this.entitlements.isVip(userId);
      throw AppException.tooManyRequests(
        isVip
          ? `今日 AI 次数已用完（会员每天 ${limit} 次），明天 0 点恢复`
          : `今日 AI 次数已用完（每天 ${limit} 次，开通会员可提升至 ${config.pay.vipAiDailyQuota} 次），明天 0 点恢复`,
      );
    }
    const ok = await this.redis.incrWithTtl(key, RETENTION_MS);
    if (!ok) {
      // Redis 不可用：放行但留痕，便于排查「额度突然不限了」
      this.logger.warn(`[AiQuota] Redis 不可用，本次 ${feature} 未计数（已放行）userId=${userId}`);
    }
  }

  /**
   * 退还一次额度（上游失败、没有产出时调用）。
   * 上游抖动不该白扣用户次数。
   */
  async refund(userId: number): Promise<void> {
    await this.redis.decr(this.keyOf(userId));
  }

  /** 今日用量（给客户端展示「剩余 N 次」）。 */
  async usage(userId: number): Promise<AiQuotaUsage> {
    const limit = await this.resolveLimit(userId);
    const used = await this.currentUsed(this.keyOf(userId));
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      resetAt: this.nextResetIso(),
    };
  }

  /**
   * 额度来源：会员与免费用户分档（会员默认 200 次/日，免费 50 次/日）。
   * 用量计数不区分档位——用户当天升级，剩余额度自然变大（键仍是同一个）。
   */
  private async resolveLimit(userId: number): Promise<number> {
    const vip = await this.entitlements.isVip(userId);
    if (!vip) {
      return config.ai.dailyQuota;
    }
    return Math.max(config.ai.dailyQuota, config.pay.vipAiDailyQuota);
  }

  /** 读取今日已用次数（Redis 不可用按 0 处理 = 放行）。 */
  private async currentUsed(key: string): Promise<number> {
    const raw = await this.redis.get(key);
    const used = Number(raw ?? 0);
    return Number.isFinite(used) && used > 0 ? used : 0;
  }

  /** 今日键（东八区自然日）。 */
  private keyOf(userId: number): string {
    const shifted = new Date(Date.now() + SHANGHAI_OFFSET_MS);
    const date = shifted.toISOString().slice(0, 10).replace(/-/g, '');
    return `${QUOTA_KEY_PREFIX}${userId}:${date}`;
  }

  /** 次日 0 点（东八区）的 ISO 时间。 */
  private nextResetIso(): string {
    const shifted = new Date(Date.now() + SHANGHAI_OFFSET_MS);
    const nextMidnightUtc = Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    );
    return new Date(nextMidnightUtc - SHANGHAI_OFFSET_MS).toISOString();
  }
}
