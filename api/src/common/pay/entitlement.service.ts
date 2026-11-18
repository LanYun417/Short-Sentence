/**
 * 会员权益服务（统一权益口径的唯一入口）。
 *
 * 为什么单独一张表 + 一个服务：
 * - 「是不是会员」会被 AI 配额、购买页、三端个人中心同时问，判断必须只有一处实现——
 *   散落在各业务里迟早出现「A 端认、B 端不认」；
 * - 权益与订单解耦：多笔订单叠加只认「有效期最晚的一条」，退款撤销也只影响对应那笔。
 *
 * 缓存：内存 60 秒（key = userId）。AI 每次调用都要判会员，打库太浪费；
 * 发权益/撤销时主动失效，保证升级后立刻生效。
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/** 会员状态（对外视图）。 */
export interface VipStatus {
  /** 是否有效会员 */
  vip: boolean;
  /** 是否终身（expiresAt 为 null 且 vip=true） */
  lifetime: boolean;
  /** 到期时间（ISO；终身或未开通为 null） */
  expiresAt: string | null;
  /** 当前生效的 SKU code（未开通为 null） */
  skuCode: string | null;
}

/** 权益行视图（我的权益列表）。 */
export interface EntitlementItem {
  kind: string;
  source: string;
  skuCode: string | null;
  status: string;
  startedAt: string;
  expiresAt: string | null;
}

/** 授予权益入参。 */
export interface GrantInput {
  userId: number;
  orderId: number;
  skuCode: string;
  /** 有效天数（0 = 终身） */
  durationDays: number;
}

/** 缓存 TTL（ms）。 */
const CACHE_TTL_MS = 60_000;

/** 权益缓存项。 */
interface CacheEntry {
  status: VipStatus;
  at: number;
}

/** 事务内可用到的最小 Prisma 能力（只依赖 userEntitlement）。 */
type EntitlementTx = Pick<PrismaService, 'userEntitlement'>;

@Injectable()
export class EntitlementService {
  private readonly cache = new Map<number, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  /** 是否有效会员（AI 配额等热路径用）。 */
  async isVip(userId: number): Promise<boolean> {
    return (await this.status(userId)).vip;
  }

  /** 会员状态（带 60 秒内存缓存）。 */
  async status(userId: number): Promise<VipStatus> {
    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.status;
    }
    const status = await this.queryStatus(userId);
    this.cache.set(userId, { status, at: Date.now() });
    return status;
  }

  /** 我的权益明细（含已撤销历史，倒序）。 */
  async listMine(userId: number): Promise<EntitlementItem[]> {
    const rows = await this.prisma.userEntitlement.findMany({
      where: { userId: BigInt(userId) },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
    return rows.map((row) => ({
      kind: row.kind,
      source: row.source,
      skuCode: row.skuCode,
      status: row.status,
      startedAt: row.startedAt.toISOString(),
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    }));
  }

  /**
   * 支付成功后授予权益（在订单服务的**同一事务**内调用，保证「订单已付」与「权益到账」原子）。
   * - 已有终身会员：直接返回（终身不再叠加）；
   * - 非终身：从「当前有效期最晚一条」的到期时间续期（未到期续在后面，已过期从现在起算）；
   * - 终身卡：expires_at 置 NULL。
   */
  async grantForPaidOrder(tx: EntitlementTx, input: GrantInput): Promise<void> {
    const now = new Date();
    const active = await tx.userEntitlement.findMany({
      where: {
        userId: BigInt(input.userId),
        kind: 'vip',
        status: 'active',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { expiresAt: 'desc' },
      select: { expiresAt: true },
    });

    // 已有终身会员：无需再发（避免无意义的行）
    if (active.some((row) => row.expiresAt === null)) {
      this.invalidate(input.userId);
      return;
    }

    // 续期基线：当前最晚到期时间（未到期才叠加；已过期从今天重新起算）
    let base = now;
    for (const row of active) {
      if (row.expiresAt && row.expiresAt > base) {
        base = row.expiresAt;
      }
    }
    const expiresAt =
      input.durationDays === 0 ? null : new Date(base.getTime() + input.durationDays * 24 * 60 * 60 * 1000);

    await tx.userEntitlement.create({
      data: {
        userId: BigInt(input.userId),
        kind: 'vip',
        source: 'order',
        orderId: BigInt(input.orderId),
        skuCode: input.skuCode,
        status: 'active',
        startedAt: now,
        expiresAt,
      },
    });
    this.invalidate(input.userId);
  }

  /** 退款：撤销该订单发放的权益（其他订单叠加出来的权益不受影响）。 */
  async revokeForOrder(orderId: number, userId: number): Promise<void> {
    await this.prisma.userEntitlement.updateMany({
      where: { orderId: BigInt(orderId), source: 'order', status: 'active' },
      data: { status: 'revoked' },
    });
    this.invalidate(userId);
  }

  /** 手动失效缓存（发权益 / 撤销 / 后台改权益后调用）。 */
  invalidate(userId: number): void {
    this.cache.delete(userId);
  }

  /** 直接查库（不走缓存）。 */
  private async queryStatus(userId: number): Promise<VipStatus> {
    const now = new Date();
    const rows = await this.prisma.userEntitlement.findMany({
      where: {
        userId: BigInt(userId),
        kind: 'vip',
        status: 'active',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: 20,
    });
    if (rows.length === 0) {
      return { vip: false, lifetime: false, expiresAt: null, skuCode: null };
    }
    // 终身优先；否则取最晚到期的一条
    const lifetime = rows.find((row) => row.expiresAt === null);
    if (lifetime) {
      return { vip: true, lifetime: true, expiresAt: null, skuCode: lifetime.skuCode };
    }
    let best = rows[0];
    for (const row of rows) {
      if (row.expiresAt && (!best.expiresAt || row.expiresAt > best.expiresAt)) {
        best = row;
      }
    }
    return {
      vip: true,
      lifetime: false,
      expiresAt: best.expiresAt ? best.expiresAt.toISOString() : null,
      skuCode: best.skuCode,
    };
  }
}
