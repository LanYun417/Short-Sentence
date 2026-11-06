/**
 * IP 黑名单服务（Redis 缓存 + MySQL 持久化）。
 * 模块职责：判定 IP 是否被封禁，以及三类触发源——单 IP 单日注册超限、单 IP 短时登录失败超限、
 * 单 IP 短时验证码失败超限——达到阈值后自动封禁；并提供人工封禁 / 解封 / 分页查询 / 概览统计。
 *
 * 设计原则（与安全强相关）：
 * - **fail-open（降级放行）**：任何异常（Redis 抖动 / 序列化失败）都视为「未封禁」，绝不因安全增强
 *   故障导致全站不可访问；与令牌黑名单 / 限流的降级口径一致。
 * - **默认关闭**：是否启用由 `config.ipBan.enabled` 控制，本服务仅在开启后才写入自动封禁；
 *   关闭时触发方法直接 return，不落任何记录，也不影响主流程。
 * - **带到期时间**：自动封禁默认 24 小时到期，到期由 `isBanned` 自然判否（Redis 缓存与 DB 双重保证），
 *   避免「一次误封永久生效」。
 * - **缓存**：热点判定走 Redis（`sec:ipban:<ip>` = 1/0 哨兵），未封禁 IP 也有负缓存，避免每次请求打库。
 */
import { Injectable, Logger } from '@nestjs/common';
import { config } from '../config/config.js';
import { RedisService } from '../redis/redis.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** 封禁键前缀（Redis 哨兵缓存）。 */
const BAN_CACHE_PREFIX = 'sec:ipban:';
/** 单 IP 单日注册尝试计数键前缀：`sec:ipreg:<date>:<ip>`。 */
const REG_ATTEMPT_PREFIX = 'sec:ipreg:';
/** 单 IP 攻击计数键前缀：`sec:ipattack:<scope>:<window>:<ip>`。 */
const ATTACK_PREFIX = 'sec:ipattack:';
/** 未封禁 IP 的负缓存时长（ms）：避免每次请求都查库。 */
const NEG_CACHE_TTL_MS = 60_000;
/** 正缓存上限（ms）：永久封禁也只缓存一年，库里仍是唯一事实源。 */
const POS_CACHE_MAX_TTL_MS = 365 * 24 * 60 * 60 * 1000;

/** 封禁触发来源。 */
export type IpBanScope = 'register' | 'login' | 'captcha' | 'manual';
/** 封禁类型。 */
export type IpBanType = 'auto' | 'manual';

/** 封禁 / 解封入参。 */
export interface BanOptions {
  reason: string;
  type?: IpBanType;
  scope?: IpBanScope;
  operator?: string;
  /** 封禁时长（小时）；0 表示永久。 */
  hours?: number;
}

/** 对外返回的封禁记录（含衍生字段 `active`）。 */
export interface IpBanRecord {
  id: number;
  ip: string;
  reason: string;
  type: string;
  scope: string;
  expiresAt: string | null;
  unbannedAt: string | null;
  operator: string | null;
  createdAt: string;
  updatedAt: string;
  /** 衍生：未解封且未过期。 */
  active: boolean;
}

/** 数据库行形态（BigInt 未转换前）。 */
type IpBanRow = {
  id: bigint;
  ip: string;
  reason: string;
  type: string;
  scope: string;
  expiresAt: Date | null;
  unbannedAt: Date | null;
  operator: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class IpBanService {
  private readonly logger = new Logger(IpBanService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 判定 IP 是否被封禁（fail-open：任何异常都视为未封禁）。
   * @param ip 客户端 IP
   * @returns `true`=已封禁（应拦截）；异常时返回 `false`
   */
  async isBanned(ip: string): Promise<boolean> {
    if (!ip) {
      return false;
    }
    try {
      // 1) 命中缓存哨兵（1=封禁 / 0=未封禁）
      const cache = await this.redis.get(BAN_CACHE_PREFIX + ip);
      if (cache === '1') {
        return true;
      }
      if (cache === '0') {
        return false;
      }
      // 2) 查库（库是唯一事实源）
      const row = await this.prisma.ipBan.findUnique({ where: { ip } });
      const active = IpBanService.isActive(row);
      // 3) 回填缓存
      if (active) {
        const ttl = row!.expiresAt
          ? Math.max(1000, new Date(row!.expiresAt).getTime() - Date.now())
          : POS_CACHE_MAX_TTL_MS;
        await this.redis.set(BAN_CACHE_PREFIX + ip, '1', Math.min(ttl, POS_CACHE_MAX_TTL_MS));
      } else {
        await this.redis.set(BAN_CACHE_PREFIX + ip, '0', NEG_CACHE_TTL_MS);
      }
      return active;
    } catch (err) {
      this.logger.warn(`[IpBan] 封禁判定异常，降级放行: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  /**
   * 计算一行记录是否处于生效状态（未解封且未过期）。
   * @param row 数据库行（可能为 null）
   */
  private static isActive(row: IpBanRow | null): boolean {
    if (!row) {
      return false;
    }
    if (row.unbannedAt) {
      return false;
    }
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
      return false;
    }
    return true;
  }

  /**
   * 封禁（upsert：已存在的 IP 更新原因 / 类型 / 到期，不清空历史）。
   * @returns 最新的封禁记录
   */
  async ban(ip: string, opts: BanOptions): Promise<IpBanRecord> {
    const type = opts.type ?? 'manual';
    const scope = opts.scope ?? 'manual';
    const operator = opts.operator ?? 'system';
    const hours = opts.hours ?? 0;
    const expiresAt = hours > 0 ? new Date(Date.now() + hours * 60 * 60 * 1000) : null;

    const row = await this.prisma.ipBan.upsert({
      where: { ip },
      create: { ip, reason: opts.reason, type, scope, operator, expiresAt, unbannedAt: null },
      update: { reason: opts.reason, type, scope, operator, expiresAt, unbannedAt: null, updatedAt: new Date() },
    });

    const ttl = expiresAt ? Math.max(1000, expiresAt.getTime() - Date.now()) : POS_CACHE_MAX_TTL_MS;
    await this.redis.set(BAN_CACHE_PREFIX + ip, '1', Math.min(ttl, POS_CACHE_MAX_TTL_MS));
    return IpBanService.toRecord(row);
  }

  /**
   * 解封（仅解除当前生效的封禁；已解封的 IP 不受影响）。
   * @param ip 被解封 IP
   * @param operator 操作人
   */
  async unban(ip: string, operator = 'system'): Promise<void> {
    await this.prisma.ipBan.updateMany({
      where: { ip, unbannedAt: null },
      data: { unbannedAt: new Date(), operator },
    });
    // 回填负缓存，避免立刻又被判定为封禁
    await this.redis.set(BAN_CACHE_PREFIX + ip, '0', NEG_CACHE_TTL_MS);
  }

  /**
   * 记录一次注册接口调用（按自然日计数）。超过 `dailyRegisterLimit` 自动封禁。
   * 覆盖「一个 IP 一天注册多个用户」与「脚本狂刷注册接口」两类场景。
   * @param ip 客户端 IP
   */
  async recordRegisterAttempt(ip: string | undefined): Promise<void> {
    if (!config.ipBan.enabled || !ip) {
      return;
    }
    try {
      const key = `${REG_ATTEMPT_PREFIX}${this.todayStr()}:${ip}`;
      const count = await this.redis.incrWithTtl(key, 24 * 60 * 60 * 1000);
      if (count === 0) {
        return; // Redis 不可用：降级，不封禁
      }
      if (count > config.ipBan.dailyRegisterLimit) {
        await this.ban(ip, {
          reason: `单日注册尝试超过 ${config.ipBan.dailyRegisterLimit} 次（当前 ${count}）`,
          type: 'auto',
          scope: 'register',
          operator: 'system',
          hours: config.ipBan.autoBanHours,
        });
        this.logger.warn(`[IpBan] IP ${ip} 因单日注册尝试过多被自动封禁（${count} 次）`);
      }
    } catch (err) {
      this.logger.warn(`[IpBan] 注册尝试计数异常: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * 记录一次攻击信号（登录失败 / 验证码失败）。超过对应阈值的自动封禁。
   * @param ip 客户端 IP
   * @param scope 攻击来源
   */
  async recordAttack(ip: string | undefined, scope: IpBanScope): Promise<void> {
    if (!config.ipBan.enabled || !ip) {
      return;
    }
    const limit = scope === 'login' ? config.ipBan.loginFailLimit : config.ipBan.captchaFailLimit;
    try {
      const window = Math.floor(Date.now() / config.ipBan.attackWindowMs);
      const key = `${ATTACK_PREFIX}${scope}:${window}:${ip}`;
      const count = await this.redis.incrWithTtl(key, config.ipBan.attackWindowMs);
      if (count === 0) {
        return; // Redis 不可用：降级，不封禁
      }
      if (count > limit) {
        await this.ban(ip, {
          reason: `短时间内 ${scope} 失败次数超过 ${limit} 次（当前 ${count}）`,
          type: 'auto',
          scope,
          operator: 'system',
          hours: config.ipBan.autoBanHours,
        });
        this.logger.warn(`[IpBan] IP ${ip} 因 ${scope} 失败过多被自动封禁（${count} 次）`);
      }
    } catch (err) {
      this.logger.warn(`[IpBan] 攻击计数异常: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * 成功后清除该 IP 的某类攻击计数（避免误伤共享 IP 的正常用户：
   * 正常用户偶尔输错密码、登录成功后清空计数，不会被累积判为攻击）。
   * @param ip 客户端 IP
   * @param scope 攻击来源
   */
  async clearAttack(ip: string | undefined, scope: IpBanScope): Promise<void> {
    if (!ip) {
      return;
    }
    try {
      const window = Math.floor(Date.now() / config.ipBan.attackWindowMs);
      await this.redis.del(`${ATTACK_PREFIX}${scope}:${window}:${ip}`);
    } catch {
      // 忽略：缓存清理失败不影响主流程
    }
  }

  /**
   * 分页查询封禁记录（后台管理用）。
   * @param params 分页 / 关键词 / 仅生效过滤
   */
  async list(params: {
    page: number;
    pageSize: number;
    keyword?: string;
    activeOnly?: boolean;
  }): Promise<{ list: IpBanRecord[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (params.keyword) {
      where.ip = { contains: params.keyword };
    }
    if (params.activeOnly) {
      where.unbannedAt = null;
      where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];
    }
    const [rows, total] = await Promise.all([
      this.prisma.ipBan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.ipBan.count({ where }),
    ]);
    return { list: rows.map((r) => IpBanService.toRecord(r)), total };
  }

  /**
   * 概览统计（后台卡片用）。
   * @returns 总条数 / 生效中 / 其中自动封禁
   */
  async stats(): Promise<{ total: number; active: number; autoActive: number }> {
    const now = new Date();
    const [total, activeRows] = await Promise.all([
      this.prisma.ipBan.count(),
      this.prisma.ipBan.findMany({
        where: { unbannedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        select: { type: true },
      }),
    ]);
    return {
      total,
      active: activeRows.length,
      autoActive: activeRows.filter((r) => r.type === 'auto').length,
    };
  }

  /** 自然日字符串（本地时区，YYYY-MM-DD）。 */
  private todayStr(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** 数据库行 → 对外记录（BigInt→Number，衍生 active）。 */
  private static toRecord(row: IpBanRow): IpBanRecord {
    return {
      id: Number(row.id),
      ip: row.ip,
      reason: row.reason,
      type: row.type,
      scope: row.scope,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      unbannedAt: row.unbannedAt ? row.unbannedAt.toISOString() : null,
      operator: row.operator,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      active: IpBanService.isActive(row),
    };
  }
}
