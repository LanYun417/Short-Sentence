/**
 * 支付安全回归（重点）。
 *
 * 覆盖四类「出事就是事故」的行为：
 * ① 密钥不落地：操作日志脱敏覆盖 privateKey/apiv3Key，参数管理不返回密钥类参数；
 * ② 密钥文件读取边界：后台填的路径不能越出项目根；
 * ③ 资金并发：退款先抢占状态，失败回滚；重复点击不会发两笔退款；
 * ④ 回调身份：mchid/appid/币种不符一律拒收，且不落成 500（避免微信无限重试）。
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { maskSensitive } from '../src/common/log/operation-log.service.js';
import { ConfigService, isDedicatedConfigKey } from '../src/modules/config/config.service.js';
import { normalizePrivateKey } from '../src/common/pay/wechatpay-crypto.js';
import { toPaySettingsView } from '../src/common/pay/pay-settings.js';
import { PayOrderService } from '../src/common/pay/pay-order.service.js';
import { WechatPayService } from '../src/common/pay/wechatpay.service.js';

/** 密钥脱敏。 */
describe('操作日志脱敏', () => {
  it('支付/AI/邮件类密钥一律打码，正常字段不动', () => {
    const masked = maskSensitive({
      appId: 'wx123',
      mchId: '1900000001',
      serialNo: 'SERIAL',
      privateKey: '-----BEGIN PRIVATE KEY-----',
      apiv3Key: '0123456789abcdef0123456789abcdef',
      apiKey: 'sk-xxx',
      secret: 's',
      password: 'p',
      token: 't',
      configKey: 'pay.wechat.appid',
      emailCode: '123456',
    }) as Record<string, unknown>;
    expect(masked.privateKey).toBe('***');
    expect(masked.apiv3Key).toBe('***');
    expect(masked.apiKey).toBe('***');
    expect(masked.secret).toBe('***');
    expect(masked.password).toBe('***');
    expect(masked.token).toBe('***');
    expect(masked.emailCode).toBe('***');
    // 正常字段不能被误伤（否则日志失去排查价值）
    expect(masked.configKey).toBe('pay.wechat.appid');
    expect(masked.serialNo).toBe('SERIAL');
    expect(masked.mchId).toBe('1900000001');
  });

  it('大小写 / 下划线变体也能命中（脚本与第三方回调用 snake_case）', () => {
    const masked = maskSensitive({ private_key: 'x', API_KEY: 'y' }) as Record<string, unknown>;
    expect(masked.private_key).toBe('***');
    expect(masked.API_KEY).toBe('***');
  });
});

/** 参数管理：密钥类参数不可见、不可读、不可改。 */
describe('参数管理密钥隔离', () => {
  it('识别专属键：支付商户密钥 / 邮件 SES 密钥 / AI 模型列表', () => {
    expect(isDedicatedConfigKey('pay.wechat.privateKey')).toBe(true);
    expect(isDedicatedConfigKey('mail.ses.secretKey')).toBe(true);
    expect(isDedicatedConfigKey('ai.models')).toBe(true);
    expect(isDedicatedConfigKey('site.icp')).toBe(false);
    expect(isDedicatedConfigKey('mail.enabled')).toBe(false);
  });

  it('按键取参接口对密钥键返回 null，且不查库', async () => {
    const findUnique = vi.fn();
    const service = new ConfigService({ sysConfig: { findUnique } } as never);
    await expect(service.getConfigData('pay.wechat.privateKey')).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('通用更新接口拒绝修改密钥类参数', async () => {
    const update = vi.fn();
    const service = new ConfigService({
      sysConfig: {
        findUnique: vi.fn(async () => ({
          id: 1n,
          configKey: 'pay.wechat.privateKey',
          configName: '商户私钥',
          configValue: 'secret',
          remark: null,
          systemFlag: 1,
        })),
        update,
      },
    } as never);
    await expect(service.updateConfig(1, { configName: 'x' })).rejects.toThrow(/专属设置页/);
    expect(update).not.toHaveBeenCalled();
  });

  it('通用列表查询带上「排除密钥前缀」的过滤条件', async () => {
    const findMany = vi.fn(async () => []);
    const count = vi.fn(async () => 0);
    const service = new ConfigService({ sysConfig: { findMany, count } } as never);
    await service.listConfigs({ page: 1, pageSize: 10 });
    const where = (findMany.mock.calls[0] as unknown as [{ where: { AND: unknown[] } }])?.[0]?.where;
    expect(JSON.stringify(where)).toContain('pay.wechat.');
    expect(JSON.stringify(where)).toContain('mail.ses.');
  });
});

/** 私钥文件读取边界。 */
describe('私钥文件读取限制', () => {
  const root = mkdtempSync(join(tmpdir(), 'ss-key-'));
  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('项目根内的相对路径可读取', () => {
    writeFileSync(join(root, 'apiclient_key.pem'), '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----');
    const pem = normalizePrivateKey('apiclient_key.pem', root);
    expect(pem).toContain('BEGIN PRIVATE KEY');
  });

  it('越界路径（../ 或绝对路径）一律拒绝', () => {
    expect(normalizePrivateKey(join(root, '..', 'etc', 'passwd.pem'), root)).toBe('');
    expect(normalizePrivateKey('/etc/passwd.pem', root)).toBe('');
  });

  it('未给根目录时不做文件读取（只接受行内 PEM）', () => {
    expect(normalizePrivateKey('apiclient_key.pem')).toBe('');
  });
});

/** 支付配置视图：密钥只回掩码。 */
describe('支付设置视图', () => {
  it('不回显私钥与 APIv3 密钥明文', () => {
    const view = toPaySettingsView({
      appId: 'wxapp',
      mchId: 'mch1',
      serialNo: 'SERIAL',
      privateKey: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
      apiv3Key: '0123456789abcdef0123456789abcdef',
      notifyUrl: 'https://example.com/api/pay/notify/wechat',
    });
    const json = JSON.stringify(view);
    expect(json).not.toContain('BEGIN PRIVATE KEY');
    expect(json).not.toContain('0123456789abcdef');
    expect(view.privateKeyConfigured).toBe(true);
    expect(view.apiv3KeyMasked.endsWith('cdef')).toBe(true);
    expect(view.enabled).toBe(true);
  });

  it('缺项时 enabled=false 并列出缺什么', () => {
    const view = toPaySettingsView({
      appId: '',
      mchId: 'mch1',
      serialNo: '',
      privateKey: '',
      apiv3Key: 'short',
      notifyUrl: '',
    });
    expect(view.enabled).toBe(false);
    expect(view.missing.join('|')).toContain('AppID');
    expect(view.missing.join('|')).toContain('APIv3');
  });
});

/** 订单服务最小假件。 */
function makeOrderService(
  options: {
    order?: Record<string, unknown>;
    pendingCount?: number;
    claimCount?: number;
    refundFails?: boolean;
    verify?: { verified: boolean; serial: string; reason?: string };
    plain?: string;
  } = {},
) {
  const order = {
    id: 1n,
    orderNo: 'SS20260101000000abcdef',
    userId: 7n,
    skuId: 1n,
    skuCode: 'vip_month',
    title: '会员月卡',
    amount: 1200,
    channel: 'web',
    status: 'paid',
    prepayId: null,
    transactionId: 'T1',
    paidAt: new Date(),
    refundNo: null,
    refundId: null,
    refundAmount: 0,
    refundedAt: null,
    refundReason: null,
    expiredAt: new Date(Date.now() + 30 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...options.order,
  };

  const updateMany = vi.fn(async (args: { data: Record<string, unknown> }) => {
    Object.assign(order, args.data);
    return { count: options.claimCount ?? 1 };
  });
  const update = vi.fn(async (args: { data: Record<string, unknown> }) => {
    Object.assign(order, args.data);
    return order;
  });
  const prisma = {
    payOrder: {
      findUnique: vi.fn(async () => order),
      updateMany,
      update,
      count: vi.fn(async () => options.pendingCount ?? 0),
      findMany: vi.fn(async () => []),
      aggregate: vi.fn(async () => ({ _count: { _all: 0 }, _sum: { amount: null, refundAmount: null } })),
    },
    paySku: { findUnique: vi.fn(async () => ({ durationDays: 30 })) },
    payCallbackLog: {
      create: vi.fn(async () => ({ id: 1n })),
      findMany: vi.fn(async () => []),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        payOrder: { updateMany, findUnique: prisma.payOrder.findUnique },
        paySku: { findUnique: vi.fn(async () => ({ durationDays: 30 })) },
      }),
    ),
  };
  const entitlements = {
    status: vi.fn(async () => ({ vip: false, lifetime: false, expiresAt: null, skuCode: null })),
    grantForPaidOrder: vi.fn(async () => undefined),
    revokeForOrder: vi.fn(async () => undefined),
    isVip: vi.fn(async () => false),
    listMine: vi.fn(async () => []),
  };
  const wechatPay = {
    enabled: true,
    merchant: { appId: 'wxapp', mchId: 'mch1' },
    verifyCallback: vi.fn(async () => options.verify ?? { verified: true, serial: 'SERIAL' }),
    decryptResource: vi.fn(() => options.plain ?? '{}'),
    nativePrepay: vi.fn(async () => ({ codeUrl: 'weixin://x' })),
    jsapiPrepay: vi.fn(async () => ({
      appId: 'wxapp',
      timeStamp: '1',
      nonceStr: 'n',
      package: 'prepay_id=p',
      signType: 'RSA',
      paySign: 's',
    })),
    refund: vi.fn(async () => {
      if (options.refundFails) {
        throw new Error('upstream down');
      }
      return { refundId: 'R1', status: 'PROCESSING' };
    }),
    closeOrder: vi.fn(async () => undefined),
    queryByOutTradeNo: vi.fn(async () => ({
      outTradeNo: order.orderNo,
      transactionId: 'T1',
      tradeState: 'NOTPAY',
      total: 1200,
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
  const service = new PayOrderService(prisma as never, skus as never, wechatPay as never, entitlements as never);
  return { service, order, prisma, wechatPay, skus, updateMany, entitlements };
}

/** 配置自检：未配置时直接拒绝，不打微信接口。 */
describe('支付配置自检', () => {
  it('未配置时 probe 抛可读错误（不会发网络请求）', async () => {
    const service = new WechatPayService({
      enabled: false,
      current: { appId: '', mchId: '', serialNo: '', privateKey: '', apiv3Key: '', notifyUrl: '' },
    } as never);
    await expect(service.probe()).rejects.toThrow(/未配置/);
  });
});

/** 下单防刷。 */
describe('下单防刷', () => {
  it('待支付订单达到上限时拒绝，且不调用微信下单', async () => {
    const { service, wechatPay } = makeOrderService({ pendingCount: 5 });
    await expect(service.create(7, 'vip_month', 'web')).rejects.toThrow(/待支付订单/);
    expect(wechatPay.nativePrepay).not.toHaveBeenCalled();
  });
});

/** 退款并发。 */
describe('退款并发防护', () => {
  it('抢占失败（已有退款在途）时拒绝，不重复调用微信退款', async () => {
    const { service, wechatPay } = makeOrderService({ claimCount: 0, order: { status: 'refunding' } });
    await expect(service.refund('SS20260101000000abcdef', '误购')).rejects.toThrow(/退款处理中/);
    expect(wechatPay.refund).not.toHaveBeenCalled();
  });

  it('微信退款失败时回滚为已支付，允许重试', async () => {
    const { service, updateMany } = makeOrderService({ refundFails: true });
    await expect(service.refund('SS20260101000000abcdef', '误购')).rejects.toThrow(/upstream down/);
    // 第一次抢占 paid→refunding，第二次回滚 refunding→paid
    const revert = (updateMany.mock.calls.at(-1) as unknown as [{ data: { status: string } }])?.[0];
    expect(revert?.data.status).toBe('paid');
  });
});

/** 回调身份校验。 */
describe('回调商户校验', () => {
  const rawBody = JSON.stringify({ event_type: 'TRANSACTION.SUCCESS', resource: {} });

  it('mchid 不匹配：回 400，订单不入账', async () => {
    const plain = JSON.stringify({
      mchid: 'other',
      appid: 'wxapp',
      out_trade_no: 'SS20260101000000abcdef',
      transaction_id: 'T1',
      amount: { total: 1200, currency: 'CNY' },
    });
    const { service, order } = makeOrderService({ order: { status: 'pending' }, plain });
    const result = await service.handleNotify({}, rawBody);
    expect(result.statusCode).toBe(400);
    expect(order.status).toBe('pending');
  });

  it('appid 不匹配：回 400', async () => {
    const plain = JSON.stringify({
      mchid: 'mch1',
      appid: 'other-app',
      out_trade_no: 'SS20260101000000abcdef',
      amount: { total: 1200, currency: 'CNY' },
    });
    const { service } = makeOrderService({ order: { status: 'pending' }, plain });
    const result = await service.handleNotify({}, rawBody);
    expect(result.statusCode).toBe(400);
  });

  it('缺验签头的请求不落流水（防刷流水表）', async () => {
    const { service, prisma } = makeOrderService({ verify: { verified: false, serial: '', reason: '缺少验签请求头' } });
    const result = await service.handleNotify({}, rawBody);
    expect(result.statusCode).toBe(401);
    expect(prisma.payCallbackLog.create).not.toHaveBeenCalled();
  });

  it('部分退款通知不撤销整笔权益（只有全额退款才改状态）', async () => {
    const plain = JSON.stringify({
      mchid: 'mch1',
      out_trade_no: 'SS20260101000000abcdef',
      refund_status: 'SUCCESS',
      refund_id: 'R1',
      amount: { refund: 100, total: 1200 },
    });
    const { service, order } = makeOrderService({ order: { status: 'paid' }, plain });
    const refundBody = JSON.stringify({ event_type: 'REFUND.SUCCESS', resource: {} });
    const result = await service.handleNotify({}, refundBody);
    expect(result.statusCode).toBe(200);
    expect(order.status).toBe('paid');
  });

  it('币种不是 CNY：回 400（不落 500，避免微信无限重试）', async () => {
    const plain = JSON.stringify({
      mchid: 'mch1',
      appid: 'wxapp',
      out_trade_no: 'SS20260101000000abcdef',
      amount: { total: 1200, currency: 'USD' },
    });
    const { service } = makeOrderService({ order: { status: 'pending' }, plain });
    const result = await service.handleNotify({}, rawBody);
    expect(result.statusCode).toBe(400);
  });
});
