/**
 * 会员订单状态机与回调入账。
 *
 * 资金链路最容易出事的三处，逐个钉住：
 * ① 幂等：同一笔回调/补单重复到达，权益只能发一次；
 * ② 金额校验：回调金额与订单不符绝不入账；
 * ③ 回调安全：验签失败回 401（触发微信重试），不写明文流水；成功才推进状态。
 */
import { describe, expect, it, vi } from 'vitest';
import { PayOrderService } from '../src/common/pay/pay-order.service.js';

/** 订单行（可覆盖字段）。 */
function baseOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 1n,
    orderNo: 'SS20260101000000abcdef',
    userId: 7n,
    skuId: 1n,
    skuCode: 'vip_month',
    title: '会员月卡',
    amount: 1200,
    channel: 'web',
    status: 'pending',
    prepayId: null,
    transactionId: null,
    paidAt: null,
    refundNo: null,
    refundId: null,
    refundAmount: 0,
    refundedAt: null,
    refundReason: null,
    expiredAt: new Date(Date.now() + 30 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Record<string, unknown> & { id: bigint; status: string; amount: number; orderNo: string; userId: bigint };
}

/** 组装服务（假 Prisma + 假权益 + 假微信支付）。 */
function makeService(
  options: {
    order?: ReturnType<typeof baseOrder>;
    verify?: { verified: boolean; serial: string; reason?: string };
    plain?: string;
    expired?: Array<{ id: bigint; orderNo: string }>;
    prepayFails?: boolean;
  } = {},
) {
  const order = options.order ?? baseOrder();
  const calls = { grant: 0, revoke: 0, logs: [] as Array<Record<string, unknown>>, close: 0 };
  /** 过期关单场景里已被关闭的订单 id（按 id 独立判重，与主订单状态互不影响）。 */
  const closedIds = new Set<bigint>();

  const fakePrisma = {
    payOrder: {
      findUnique: vi.fn(async () => order),
      updateMany: vi.fn(async (args: { where: { id?: bigint; status?: unknown }; data: Record<string, unknown> }) => {
        // 过期关单按 id + status:'pending'（字符串）更新：与主订单状态机分开处理
        if (args.where.id !== undefined && args.where.status === 'pending') {
          const target = (options.expired ?? []).find((item) => item.id === args.where.id);
          if (!target || closedIds.has(args.where.id)) {
            return { count: 0 };
          }
          closedIds.add(args.where.id);
          return { count: 1 };
        }
        const cond = args.where.status as { in?: string[] } | string | undefined;
        const allowed = Array.isArray((cond as { in?: string[] })?.in)
          ? ((cond as { in: string[] }).in ?? []).includes(order.status)
          : cond === undefined || cond === order.status;
        if (!allowed) {
          return { count: 0 };
        }
        Object.assign(order, args.data);
        return { count: 1 };
      }),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => {
        Object.assign(order, args.data);
        return order;
      }),
      findMany: vi.fn(async () => options.expired ?? []),
      count: vi.fn(async () => 0),
      aggregate: vi.fn(async () => ({ _count: { _all: 0 }, _sum: { amount: null, refundAmount: null } })),
    },
    paySku: { findUnique: vi.fn(async () => ({ durationDays: 30 })) },
    payCallbackLog: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        calls.logs.push(args.data);
        return { id: 1n };
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ payOrder: undefined, paySku: { findUnique: vi.fn(async () => ({ durationDays: 30 })) } }),
    ),
  };
  // $transaction 里用到的 payOrder.updateMany 与外部是同一个对象：补上引用
  (
    fakePrisma as unknown as { $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> }
  ).$transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ payOrder: fakePrisma.payOrder, paySku: fakePrisma.paySku }),
  );

  const entitlements = {
    grantForPaidOrder: vi.fn(async () => {
      calls.grant += 1;
    }),
    revokeForOrder: vi.fn(async () => {
      calls.revoke += 1;
    }),
    status: vi.fn(async () => ({ vip: false, lifetime: false, expiresAt: null, skuCode: null })),
    isVip: vi.fn(async () => false),
    listMine: vi.fn(async () => []),
    invalidate: vi.fn(),
  };

  const wechatPay = {
    enabled: true,
    verifyCallback: vi.fn(async () => options.verify ?? { verified: true, serial: 'SERIAL' }),
    decryptResource: vi.fn(() => options.plain ?? '{}'),
    refund: vi.fn(async () => ({ refundId: 'R1', status: 'PROCESSING' })),
    closeOrder: vi.fn(async () => {
      calls.close += 1;
    }),
    queryByOutTradeNo: vi.fn(async () => ({
      outTradeNo: order.orderNo,
      transactionId: 'T1',
      tradeState: 'NOTPAY',
      total: order.amount,
    })),
    nativePrepay: vi.fn(async () => {
      if (options.prepayFails) {
        throw new Error('prepay down');
      }
      return { codeUrl: 'weixin://wxpay/bizpayurl?pr=xxx' };
    }),
    jsapiPrepay: vi.fn(async () => ({
      appId: 'wxapp',
      timeStamp: '1',
      nonceStr: 'n',
      package: 'prepay_id=p',
      signType: 'RSA',
      paySign: 'sig',
    })),
  };

  const skus = {
    requireEnabled: vi.fn(async () => ({
      id: 1n,
      code: 'vip_month',
      name: '会员月卡',
      kind: 'vip',
      price: 1200,
      durationDays: 30,
      benefits: [],
    })),
    listEnabled: vi.fn(async () => []),
  };

  const service = new PayOrderService(fakePrisma as never, skus as never, wechatPay as never, entitlements as never);
  return { service, order, calls, entitlements, wechatPay, skus, fakePrisma };
}

describe('订单入账（markPaid）', () => {
  it('首次支付成功：订单转 paid 并发放权益（仅一次）', async () => {
    const { service, order, entitlements } = makeService();
    const result = await service.markPaid({ orderNo: order.orderNo, transactionId: 'T1', total: 1200 });
    expect(result.changed).toBe(true);
    expect(order.status).toBe('paid');
    expect(entitlements.grantForPaidOrder).toHaveBeenCalledTimes(1);
  });

  it('重复回调：不重复发权益、不报错（幂等）', async () => {
    const { service, order, entitlements } = makeService();
    await service.markPaid({ orderNo: order.orderNo, transactionId: 'T1', total: 1200 });
    const again = await service.markPaid({ orderNo: order.orderNo, transactionId: 'T1', total: 1200 });
    expect(again.changed).toBe(false);
    expect(entitlements.grantForPaidOrder).toHaveBeenCalledTimes(1);
  });

  it('回调金额与订单不一致：拒绝入账并保持 pending', async () => {
    const { service, order, entitlements } = makeService();
    await expect(service.markPaid({ orderNo: order.orderNo, transactionId: 'T1', total: 1 })).rejects.toThrow(/金额/);
    expect(order.status).toBe('pending');
    expect(entitlements.grantForPaidOrder).not.toHaveBeenCalled();
  });

  it('已关闭的订单收到支付成功（用户卡点付款）也要入账——钱是真的', async () => {
    const { service, order, entitlements } = makeService({ order: baseOrder({ status: 'closed' }) });
    const result = await service.markPaid({ orderNo: order.orderNo, transactionId: 'T1', total: 1200 });
    expect(result.changed).toBe(true);
    expect(entitlements.grantForPaidOrder).toHaveBeenCalledTimes(1);
  });
});

describe('支付回调（handleNotify）', () => {
  const payload = JSON.stringify({
    out_trade_no: 'SS20260101000000abcdef',
    transaction_id: 'T1',
    trade_state: 'SUCCESS',
    success_time: '2026-01-01T12:00:00+08:00',
    amount: { total: 1200 },
  });

  it('验签失败：回 401 让微信重试，且不写明文', async () => {
    const { service, calls } = makeService({ verify: { verified: false, serial: 'S', reason: '签名校验失败' } });
    const result = await service.handleNotify({}, '{}');
    expect(result.statusCode).toBe(401);
    expect(result.body.code).toBe('FAIL');
    expect(calls.logs[0]?.verified).toBe(0);
    expect(calls.logs[0]?.plainText).toBeNull();
  });

  it('验签通过且是支付成功：入账、回 SUCCESS、流水记明文', async () => {
    const { service, order, calls } = makeService({ plain: payload });
    const rawBody = JSON.stringify({ event_type: 'TRANSACTION.SUCCESS', resource: {} });
    const result = await service.handleNotify({}, rawBody);
    expect(result.statusCode).toBe(200);
    expect(result.body.code).toBe('SUCCESS');
    expect(order.status).toBe('paid');
    expect(calls.logs[0]?.handled).toBe(1);
    expect(String(calls.logs[0]?.plainText)).toContain('T1');
  });

  it('重复通知按幂等处理（handled=0，duplicate ignored）', async () => {
    const { service, calls } = makeService({ plain: payload, order: baseOrder({ status: 'paid' }) });
    const rawBody = JSON.stringify({ event_type: 'TRANSACTION.SUCCESS', resource: {} });
    const result = await service.handleNotify({}, rawBody);
    expect(result.statusCode).toBe(200);
    expect(calls.logs[0]?.handled).toBe(0);
    expect(String(calls.logs[0]?.resultNote)).toContain('duplicate');
  });
});

describe('退款', () => {
  it('未支付订单拒绝退款', async () => {
    const { service } = makeService({ order: baseOrder({ status: 'pending' }) });
    await expect(service.refund('SS20260101000000abcdef', '误购')).rejects.toThrow(/已支付/);
  });

  it('已支付订单退款：状态转 refunded 并撤销权益', async () => {
    const { service, order, entitlements } = makeService({ order: baseOrder({ status: 'paid' }) });
    const view = await service.refund(order.orderNo, '误购');
    expect(order.status).toBe('refunded');
    expect(view.refundReason).toBe('误购');
    expect(entitlements.revokeForOrder).toHaveBeenCalledTimes(1);
  });
});

describe('过期关单', () => {
  it('逐笔关闭过期 pending 单并同步向微信关单', async () => {
    const { service, calls } = makeService({
      expired: [
        { id: 1n, orderNo: 'SS1' },
        { id: 2n, orderNo: 'SS2' },
      ],
    });
    const closed = await service.closeExpired();
    expect(closed).toBe(2);
    expect(calls.close).toBe(2);
  });
});
