/**
 * 会员订单服务（下单 / 查单 / 回调入账 / 关单 / 退款）。
 *
 * 状态机：`pending → paid → refunded`，以及 `pending → closed`（30 分钟未付）。
 * 资金链路的三条铁律：
 * 1. **金额只信服务端**：下单只收 `skuCode`，金额从 pay_sku 查库；回调再核对 `amount.total`；
 * 2. **入账幂等**：`updateMany({ where: { status: 'pending' } })` 的受影响行数是唯一判据，
 *    重复回调/轮询补单只会成功一次，权益不会重复发放；
 * 3. **订单与权益同事务**：`paid` 与 `user_entitlement` 要么都成，要么都不成。
 *
 * 回调丢失的兜底：客户端轮询 `status` 时按节流（同一订单 5 秒一次）主动查微信支付，
 * 查到 SUCCESS 就补单——不依赖回调必达。
 */
import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppException } from '../exception/app.exception.js';
import { config } from '../config/config.js';
import type { PageResult } from '../types.js';
import { EntitlementService, type VipStatus } from './entitlement.service.js';
import { PaySkuService } from './pay-sku.service.js';
import { toQrDataUrl } from './qr.js';
import { WechatPayService, type JsapiPayParams } from './wechatpay.service.js';

/** 支付渠道。 */
export type PayChannel = 'web' | 'android' | 'miniapp';

/** 订单对外视图。 */
export interface PayOrderView {
  orderNo: string;
  userId: number;
  skuCode: string;
  title: string;
  amount: number;
  channel: string;
  status: string;
  transactionId: string | null;
  paidAt: string | null;
  refundAmount: number;
  refundedAt: string | null;
  refundReason: string | null;
  createdAt: string;
  expiredAt: string;
}

/** 下单结果。 */
export interface CreateOrderResult {
  orderNo: string;
  amount: number;
  channel: PayChannel;
  expiresAt: string;
  /** Native（web / android）：二维码内容 */
  codeUrl?: string;
  /** Native（web / android）：二维码 PNG data URL（前端直接 <img src> 渲染） */
  qrDataUrl?: string;
  /** 小程序：wx.requestPayment 参数 */
  payParams?: JsapiPayParams;
}

/** 订单状态查询结果。 */
export interface OrderStatusResult {
  orderNo: string;
  status: string;
  amount: number;
  channel: string;
  paidAt: string | null;
  expiresAt: string;
  vip: VipStatus;
}

/** 后台订单列表查询。 */
export interface PayOrderListQuery {
  page?: number | string;
  pageSize?: number | string;
  status?: string;
  channel?: string;
  userId?: number | string;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** 后台收入概览。 */
export interface PayStats {
  /** 累计支付笔数（含已退款） */
  paidCount: number;
  /** 累计支付金额（分，含已退款） */
  paidAmount: number;
  /** 累计退款金额（分） */
  refundAmount: number;
  /** 净收入（分）= 支付 - 退款 */
  netAmount: number;
  /** 今日支付笔数 */
  todayPaidCount: number;
  /** 今日净收入（分） */
  todayNetAmount: number;
  /** 当前有效会员数（含终身） */
  activeVipCount: number;
  /** 待支付订单数 */
  pendingCount: number;
}

/** 回调处理结果（控制器据此回微信）。 */
export interface NotifyResult {
  /** 回给微信的 HTTP 状态码（200 = ACK；4xx/5xx 会触发重试） */
  statusCode: number;
  /** 响应体（微信要求 {code,message}） */
  body: { code: 'SUCCESS' | 'FAIL'; message: string };
}

/** 订单号生成（SS + 年月日时分秒 + 8 位随机十六进制，24 字符）。 */
function newOrderNo(): string {
  const now = new Date();
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const stamp = shifted
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  return `SS${stamp}${randomBytes(4).toString('hex')}`;
}

/** 退款单号生成（RF + 时间 + 6 位随机）。 */
function newRefundNo(): string {
  const now = new Date();
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const stamp = shifted
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  return `RF${stamp}${randomBytes(3).toString('hex')}`;
}

/** 轮询补单的节流（同一订单 5 秒内最多查一次微信）。 */
const SYNC_MIN_INTERVAL_MS = 5_000;

@Injectable()
export class PayOrderService {
  private readonly logger = new Logger(PayOrderService.name);

  /** orderNo → 上次主动查微信的时间（ms）。 */
  private readonly lastSyncAt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly skus: PaySkuService,
    private readonly wechatPay: WechatPayService,
    private readonly entitlements: EntitlementService,
  ) {}

  /** 支付是否已配置可用（购买页据此显示「暂未开放」）。 */
  payEnabled(): boolean {
    return this.wechatPay.enabled;
  }

  /** 下单（服务端定价 + 调用微信预下单）。 */
  async create(userId: number, skuCode: string, channel: PayChannel): Promise<CreateOrderResult> {
    if (!this.wechatPay.enabled) {
      throw AppException.badRequest('支付功能尚未开通（后台「支付设置」补齐密钥后可用）');
    }
    const sku = await this.skus.requireEnabled(skuCode);
    const vip = await this.entitlements.status(userId);
    if (vip.lifetime) {
      throw AppException.badRequest('你已是终身会员，无需重复购买');
    }

    const ttlMinutes = config.pay.orderTtlMinutes;
    const now = new Date();
    const expiredAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
    const orderNo = newOrderNo();

    // 小程序 JSAPI 必须有 openid（邮箱注册用户没走过微信登录）
    let openid = '';
    if (channel === 'miniapp') {
      const user = await this.prisma.clientUser.findUnique({
        where: { id: BigInt(userId) },
        select: { wechatOpenid: true },
      });
      openid = user?.wechatOpenid ?? '';
      if (!openid) {
        throw AppException.badRequest('请先用微信登录后再购买（小程序支付需要微信身份）');
      }
    }

    const order = await this.prisma.payOrder.create({
      data: {
        orderNo,
        userId: BigInt(userId),
        skuId: sku.id,
        skuCode: sku.code,
        title: sku.name,
        amount: sku.price,
        channel,
        status: 'pending',
        expiredAt,
      },
    });

    try {
      if (channel === 'miniapp') {
        const payParams = await this.wechatPay.jsapiPrepay({
          orderNo,
          amount: sku.price,
          description: `短句·${sku.name}`,
          openid,
          attach: `vip:${sku.code}`,
        });
        await this.prisma.payOrder.update({
          where: { id: order.id },
          data: { prepayId: payParams.package.replace('prepay_id=', '') },
        });
        return { orderNo, amount: sku.price, channel, expiresAt: expiredAt.toISOString(), payParams };
      }
      const native = await this.wechatPay.nativePrepay({
        orderNo,
        amount: sku.price,
        description: `短句·${sku.name}`,
        attach: `vip:${sku.code}`,
      });
      return {
        orderNo,
        amount: sku.price,
        channel,
        expiresAt: expiredAt.toISOString(),
        codeUrl: native.codeUrl,
        qrDataUrl: toQrDataUrl(native.codeUrl),
      };
    } catch (error) {
      // 预下单失败：立即关单，避免留下永远不会支付的 pending 单
      await this.prisma.payOrder
        .update({
          where: { id: order.id },
          data: { status: 'closed' },
        })
        .catch(() => undefined);
      throw error;
    }
  }

  /**
   * 查询订单状态（客户端轮询）。
   * pending 且未过期时，按 5 秒节流主动查微信补单（回调丢失兜底）。
   */
  async status(userId: number, orderNo: string): Promise<OrderStatusResult> {
    const order = await this.prisma.payOrder.findUnique({ where: { orderNo } });
    if (!order || Number(order.userId) !== userId) {
      throw AppException.notFound('订单不存在');
    }
    if (order.status === 'pending') {
      if (order.expiredAt.getTime() <= Date.now()) {
        await this.closeLocal(order.id, 'expired');
      } else {
        await this.syncFromWechat(orderNo);
      }
    }
    const latest = await this.prisma.payOrder.findUnique({ where: { orderNo } });
    const vip = await this.entitlements.status(userId);
    return {
      orderNo: latest?.orderNo ?? orderNo,
      status: latest?.status ?? order.status,
      amount: latest?.amount ?? order.amount,
      channel: latest?.channel ?? order.channel,
      paidAt: latest?.paidAt ? latest.paidAt.toISOString() : null,
      expiresAt: (latest?.expiredAt ?? order.expiredAt).toISOString(),
      vip,
    };
  }

  /** 我的订单（分页）。 */
  async listMine(
    userId: number,
    query: { page?: number | string; pageSize?: number | string },
  ): Promise<PageResult<PayOrderView>> {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize ?? 10) || 10));
    const where = { userId: BigInt(userId) };
    const [rows, total] = await Promise.all([
      this.prisma.payOrder.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payOrder.count({ where }),
    ]);
    return { list: rows.map((row) => this.toView(row)), total, page, pageSize };
  }

  /**
   * 订单置为已支付并发权益（幂等）。
   * @returns changed=false 表示此前已入账（重复回调 / 重复补单）
   */
  async markPaid(input: {
    orderNo: string;
    transactionId: string;
    total: number;
    paidAt?: Date;
  }): Promise<{ changed: boolean; userId: number | null }> {
    const order = await this.prisma.payOrder.findUnique({ where: { orderNo: input.orderNo } });
    if (!order) {
      this.logger.warn(`[Pay] 收到未知订单的支付成功通知 orderNo=${input.orderNo}`);
      return { changed: false, userId: null };
    }
    if (order.status === 'paid' || order.status === 'refunded') {
      return { changed: false, userId: Number(order.userId) };
    }
    if (input.total !== order.amount) {
      // 金额不符：绝不入账（可能是伪造/串单），留痕交由人工核对
      this.logger.error(`[Pay] 回调金额与订单不符 orderNo=${input.orderNo} 订单=${order.amount} 回调=${input.total}`);
      throw AppException.badRequest('回调金额与订单金额不一致');
    }

    const changed = await this.prisma.$transaction(async (tx) => {
      // 条件更新是唯一幂等判据：并发回调只有一个能把 pending/closed 改成 paid
      const updated = await tx.payOrder.updateMany({
        where: { id: order.id, status: { in: ['pending', 'closed'] } },
        data: {
          status: 'paid',
          transactionId: input.transactionId,
          paidAt: input.paidAt ?? new Date(),
        },
      });
      if (updated.count === 0) {
        return false;
      }
      const sku = await tx.paySku.findUnique({ where: { id: order.skuId }, select: { durationDays: true } });
      await this.entitlements.grantForPaidOrder(tx, {
        userId: Number(order.userId),
        orderId: Number(order.id),
        skuCode: order.skuCode,
        durationDays: sku?.durationDays ?? 30,
      });
      return true;
    });
    if (changed) {
      this.logger.log(`[Pay] 订单已入账 orderNo=${input.orderNo} userId=${order.userId} amount=${order.amount}`);
    }
    return { changed, userId: Number(order.userId) };
  }

  /**
   * 处理微信支付回调（验签 → 解密 → 入账 → 落流水）。
   * 返回值直接决定回给微信的 HTTP 码与 body（控制器负责写出）。
   */
  async handleNotify(headers: Record<string, string | string[] | undefined>, rawBody: string): Promise<NotifyResult> {
    const verify = await this.wechatPay.verifyCallback(headers, rawBody);
    if (!verify.verified) {
      // 验签失败：落流水（不含明文），回 401 让微信重试并暴露配置问题
      await this.writeCallbackLog({
        orderNo: null,
        transactionId: null,
        eventType: 'UNKNOWN',
        serial: verify.serial,
        verified: 0,
        handled: 0,
        resultNote: verify.reason ?? '验签失败',
        plainText: null,
        responseCode: 401,
      });
      return { statusCode: 401, body: { code: 'FAIL', message: verify.reason ?? '验签失败' } };
    }

    // 解析 + 解密：放进闭包拿到确定的结果对象，避免「声明后再赋值」被 lint 判定为无效初值
    const parsed = (():
      { eventType: string; plainText: string; payload: Record<string, unknown> } | { error: string } => {
      try {
        const envelope = JSON.parse(rawBody) as {
          event_type?: string;
          resource?: { algorithm: string; ciphertext: string; nonce: string; associated_data?: string };
        };
        const plainText = this.wechatPay.decryptResource(envelope.resource ?? ({} as never));
        return {
          eventType: envelope.event_type ?? 'UNKNOWN',
          plainText,
          payload: JSON.parse(plainText) as Record<string, unknown>,
        };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    })();

    if ('error' in parsed) {
      const note = `回调报文解析失败：${parsed.error}`;
      await this.writeCallbackLog({
        orderNo: null,
        transactionId: null,
        eventType: 'UNKNOWN',
        serial: verify.serial,
        verified: 1,
        handled: 0,
        resultNote: note.slice(0, 200),
        plainText: null,
        responseCode: 400,
      });
      return { statusCode: 400, body: { code: 'FAIL', message: '报文解析失败' } };
    }

    const { eventType, plainText, payload } = parsed;

    const orderNo = typeof payload.out_trade_no === 'string' ? payload.out_trade_no : '';
    const transactionId = typeof payload.transaction_id === 'string' ? payload.transaction_id : '';

    try {
      let handled = 0;
      let note = '';
      if (eventType === 'TRANSACTION.SUCCESS') {
        const amount = (payload.amount ?? {}) as { total?: number };
        const successTime = typeof payload.success_time === 'string' ? new Date(payload.success_time) : undefined;
        const result = await this.markPaid({
          orderNo,
          transactionId,
          total: Number(amount.total ?? 0),
          paidAt: successTime && !Number.isNaN(successTime.getTime()) ? successTime : undefined,
        });
        handled = result.changed ? 1 : 0;
        note = result.changed ? 'order paid' : 'duplicate ignored';
      } else if (eventType.startsWith('REFUND.')) {
        const refundStatus = typeof payload.refund_status === 'string' ? payload.refund_status : '';
        if (refundStatus === 'SUCCESS') {
          await this.markRefundedByNotify(orderNo, typeof payload.refund_id === 'string' ? payload.refund_id : '');
          handled = 1;
          note = 'refund confirmed';
        } else {
          note = `refund status ${refundStatus}`;
        }
      } else {
        note = 'ignored event';
      }

      await this.writeCallbackLog({
        orderNo: orderNo || null,
        transactionId: transactionId || null,
        eventType,
        serial: verify.serial,
        verified: 1,
        handled,
        resultNote: note,
        plainText,
        responseCode: 200,
      });
      return { statusCode: 200, body: { code: 'SUCCESS', message: '成功' } };
    } catch (error) {
      const note = `入账失败：${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(`[Pay] 回调入账失败 orderNo=${orderNo} ${note}`);
      await this.writeCallbackLog({
        orderNo: orderNo || null,
        transactionId: transactionId || null,
        eventType,
        serial: verify.serial,
        verified: 1,
        handled: 0,
        resultNote: note.slice(0, 200),
        plainText,
        responseCode: 500,
      });
      // 5xx 让微信按策略重试；人工也可在后台「同步」补单
      return { statusCode: 500, body: { code: 'FAIL', message: '入账失败' } };
    }
  }

  /**
   * 后台退款（全额）。退款成功后订单置 refunded 并撤销该笔权益。
   * 微信受理即返回，最终结果以异步通知为准（这里同步落状态，通知重复到达时幂等）。
   */
  async refund(orderNo: string, reason: string): Promise<PayOrderView> {
    const order = await this.prisma.payOrder.findUnique({ where: { orderNo } });
    if (!order) {
      throw AppException.notFound('订单不存在');
    }
    if (order.status === 'refunded') {
      throw AppException.badRequest('该订单已退款');
    }
    if (order.status !== 'paid') {
      throw AppException.badRequest('只有已支付的订单可以退款');
    }
    const refundNo = newRefundNo();
    const result = await this.wechatPay.refund({
      orderNo,
      refundNo,
      total: order.amount,
      refund: order.amount,
      reason,
    });
    const updated = await this.prisma.payOrder.update({
      where: { id: order.id },
      data: {
        status: 'refunded',
        refundNo,
        refundId: result.refundId,
        refundAmount: order.amount,
        refundedAt: new Date(),
        refundReason: reason || null,
      },
    });
    await this.entitlements.revokeForOrder(Number(order.id), Number(order.userId));
    this.logger.log(`[Pay] 订单已退款 orderNo=${orderNo} refundNo=${refundNo} by=${reason || '-'}`);
    return this.toView(updated);
  }

  /** 后台手动同步（回调丢失时补单）。 */
  async syncOrder(orderNo: string): Promise<PayOrderView> {
    const order = await this.prisma.payOrder.findUnique({ where: { orderNo } });
    if (!order) {
      throw AppException.notFound('订单不存在');
    }
    await this.syncFromWechat(orderNo, true);
    const latest = await this.prisma.payOrder.findUnique({ where: { orderNo } });
    return this.toView(latest ?? order);
  }

  /**
   * 关闭过期未支付订单（定时任务调用）。
   * 先改本地状态再调微信关单：微信关单失败（已支付/不存在）不影响本地清理，异常吞掉只留日志。
   */
  async closeExpired(): Promise<number> {
    const now = new Date();
    const expired = await this.prisma.payOrder.findMany({
      where: { status: 'pending', expiredAt: { lte: now } },
      orderBy: { id: 'asc' },
      take: 200,
      select: { id: true, orderNo: true },
    });
    let closed = 0;
    for (const order of expired) {
      const changed = await this.closeLocal(order.id, 'expired');
      if (changed) {
        closed += 1;
        if (this.wechatPay.enabled) {
          try {
            await this.wechatPay.closeOrder(order.orderNo);
          } catch (error) {
            // 已支付（用户卡点付款）/ 订单不存在都会报错，属正常竞态：留给回调与轮询补单
            this.logger.warn(
              `[Pay] 微信关单跳过 orderNo=${order.orderNo}：${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }
    }
    if (closed > 0) {
      this.logger.log(`[Pay] 已关闭 ${closed} 笔过期未支付订单`);
    }
    return closed;
  }

  /** 后台订单列表（分页 + 筛选）。 */
  async listOrders(query: PayOrderListQuery): Promise<PageResult<PayOrderView>> {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20) || 20));
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.channel) where.channel = query.channel;
    if (query.userId) where.userId = BigInt(Number(query.userId));
    if (query.keyword) {
      const keyword = String(query.keyword).trim();
      if (keyword) {
        where.OR = [{ orderNo: { contains: keyword } }, { transactionId: { contains: keyword } }];
      }
    }
    if (query.dateFrom || query.dateTo) {
      const range: Record<string, Date> = {};
      if (query.dateFrom) range.gte = new Date(`${query.dateFrom}T00:00:00+08:00`);
      if (query.dateTo) range.lte = new Date(`${query.dateTo}T23:59:59.999+08:00`);
      where.createdAt = range;
    }
    const [rows, total] = await Promise.all([
      this.prisma.payOrder.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payOrder.count({ where }),
    ]);
    return { list: rows.map((row) => this.toView(row)), total, page, pageSize };
  }

  /** 后台收入概览。 */
  async stats(): Promise<PayStats> {
    const now = new Date();
    const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const todayStart = new Date(
      Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 8 * 60 * 60 * 1000,
    );
    const [paidAgg, refundAgg, todayAgg, todayRefundAgg, activeVipCount, pendingCount] = await Promise.all([
      this.prisma.payOrder.aggregate({
        where: { status: { in: ['paid', 'refunded'] } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.payOrder.aggregate({
        where: { status: 'refunded' },
        _sum: { refundAmount: true },
      }),
      this.prisma.payOrder.aggregate({
        where: { status: { in: ['paid', 'refunded'] }, paidAt: { gte: todayStart } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.payOrder.aggregate({
        where: { status: 'refunded', refundedAt: { gte: todayStart } },
        _sum: { refundAmount: true },
      }),
      this.prisma.userEntitlement
        .findMany({
          where: {
            kind: 'vip',
            status: 'active',
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          distinct: ['userId'],
          select: { userId: true },
        })
        .then((rows) => rows.length),
      this.prisma.payOrder.count({ where: { status: 'pending' } }),
    ]);
    const paidAmount = paidAgg._sum.amount ?? 0;
    const refundAmount = refundAgg._sum.refundAmount ?? 0;
    const todayPaidAmount = todayAgg._sum.amount ?? 0;
    const todayRefundAmount = todayRefundAgg._sum.refundAmount ?? 0;
    return {
      paidCount: paidAgg._count._all,
      paidAmount,
      refundAmount,
      netAmount: paidAmount - refundAmount,
      todayPaidCount: todayAgg._count._all,
      todayNetAmount: todayPaidAmount - todayRefundAmount,
      activeVipCount,
      pendingCount,
    };
  }

  /* ------------------------------ 内部实现 ------------------------------ */

  /** 本地关单（条件更新，返回是否真的改了）。 */
  private async closeLocal(orderId: bigint, reason: string): Promise<boolean> {
    const result = await this.prisma.payOrder.updateMany({
      where: { id: orderId, status: 'pending' },
      data: { status: 'closed' },
    });
    if (result.count > 0) {
      this.logger.log(`[Pay] 关闭订单 id=${orderId}（${reason}）`);
    }
    return result.count > 0;
  }

  /**
   * 主动查微信补单（节流：同一订单 5 秒一次）。
   * @param force 后台手动同步时跳过节流
   */
  private async syncFromWechat(orderNo: string, force = false): Promise<void> {
    if (!this.wechatPay.enabled) {
      return;
    }
    const last = this.lastSyncAt.get(orderNo) ?? 0;
    if (!force && Date.now() - last < SYNC_MIN_INTERVAL_MS) {
      return;
    }
    this.lastSyncAt.set(orderNo, Date.now());
    // 简单清理，避免 Map 无限增长（正常单量下保留最近 2000 条足够）
    if (this.lastSyncAt.size > 2000) {
      const oldest = this.lastSyncAt.keys().next().value;
      if (oldest) {
        this.lastSyncAt.delete(oldest);
      }
    }
    try {
      const tx = await this.wechatPay.queryByOutTradeNo(orderNo);
      if (tx.tradeState === 'SUCCESS') {
        await this.markPaid({ orderNo, transactionId: tx.transactionId, total: tx.total });
      } else if (tx.tradeState === 'CLOSED' || tx.tradeState === 'REVOKED') {
        const order = await this.prisma.payOrder.findUnique({ where: { orderNo }, select: { id: true } });
        if (order) {
          await this.closeLocal(order.id, `wechat ${tx.tradeState}`);
        }
      }
    } catch (error) {
      // 查单失败不阻塞客户端：保持 pending，下次轮询再试
      this.logger.warn(
        `[Pay] 主动查单失败 orderNo=${orderNo}：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** 退款通知确认（幂等：状态已是 refunded 则跳过）。 */
  private async markRefundedByNotify(orderNo: string, refundId: string): Promise<void> {
    if (!orderNo) {
      return;
    }
    const order = await this.prisma.payOrder.findUnique({ where: { orderNo } });
    if (!order || order.status === 'refunded') {
      return;
    }
    await this.prisma.payOrder.update({
      where: { id: order.id },
      data: {
        status: 'refunded',
        refundId: refundId || order.refundId,
        refundAmount: order.amount,
        refundedAt: order.refundedAt ?? new Date(),
      },
    });
    await this.entitlements.revokeForOrder(Number(order.id), Number(order.userId));
  }

  /** 写回调流水（失败只告警，绝不影响给微信的响应）。 */
  private async writeCallbackLog(input: {
    orderNo: string | null;
    transactionId: string | null;
    eventType: string;
    serial: string;
    verified: number;
    handled: number;
    resultNote: string;
    plainText: string | null;
    responseCode: number;
  }): Promise<void> {
    try {
      await this.prisma.payCallbackLog.create({
        data: {
          orderNo: input.orderNo,
          transactionId: input.transactionId,
          eventType: input.eventType,
          serial: input.serial || '-',
          verified: input.verified,
          handled: input.handled,
          resultNote: input.resultNote.slice(0, 200),
          plainText: input.plainText,
          responseCode: input.responseCode,
        },
      });
    } catch (error) {
      this.logger.error(`[Pay] 回调流水写入失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** 行 → 视图。 */
  private toView(row: {
    orderNo: string;
    userId: bigint;
    skuCode: string;
    title: string;
    amount: number;
    channel: string;
    status: string;
    transactionId: string | null;
    paidAt: Date | null;
    refundAmount: number;
    refundedAt: Date | null;
    refundReason: string | null;
    createdAt: Date;
    expiredAt: Date;
  }): PayOrderView {
    return {
      orderNo: row.orderNo,
      userId: Number(row.userId),
      skuCode: row.skuCode,
      title: row.title,
      amount: row.amount,
      channel: row.channel,
      status: row.status,
      transactionId: row.transactionId,
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      refundAmount: row.refundAmount,
      refundedAt: row.refundedAt ? row.refundedAt.toISOString() : null,
      refundReason: row.refundReason,
      createdAt: row.createdAt.toISOString(),
      expiredAt: row.expiredAt.toISOString(),
    };
  }
}
