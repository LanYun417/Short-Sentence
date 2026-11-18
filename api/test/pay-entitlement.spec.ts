/**
 * 会员权益口径。
 *
 * 钉住四件事：
 * ① 会员状态判定：终身优先、否则取最晚到期；
 * ② 叠加续期：未到期从原到期日续，已过期从今天起算；
 * ③ 终身会员不再重复发权益；
 * ④ 60 秒缓存：热路径不反复打库，发/撤权益后主动失效。
 */
import { describe, expect, it, vi } from 'vitest';
import { EntitlementService } from '../src/common/pay/entitlement.service.js';

/** 权益行。 */
function row(overrides: Record<string, unknown> = {}) {
  return {
    userId: 7n,
    kind: 'vip',
    source: 'order',
    orderId: 1n,
    skuCode: 'vip_month',
    status: 'active',
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    ...overrides,
  } as Record<string, unknown>;
}

/** 组装服务（rows 可按用例替换）。 */
function makeService(rows: Array<Record<string, unknown>> = []) {
  const create = vi.fn(async () => row());
  const findMany = vi.fn(async () => rows);
  const updateMany = vi.fn(async () => ({ count: 1 }));
  const prisma = { userEntitlement: { findMany, create, updateMany } };
  const service = new EntitlementService(prisma as never);
  return { service, prisma, create, findMany, updateMany };
}

describe('会员状态判定', () => {
  it('没有任何权益时不是会员', async () => {
    const { service } = makeService([]);
    await expect(service.status(7)).resolves.toEqual({
      vip: false,
      lifetime: false,
      expiresAt: null,
      skuCode: null,
    });
  });

  it('终身权益优先（expiresAt 为 null）', async () => {
    const { service } = makeService([row({ skuCode: 'vip_month' }), row({ skuCode: 'vip_lifetime', expiresAt: null })]);
    const status = await service.status(7);
    expect(status.vip).toBe(true);
    expect(status.lifetime).toBe(true);
    expect(status.skuCode).toBe('vip_lifetime');
  });

  it('多条有效期权益取最晚到期的一条', async () => {
    const later = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const { service } = makeService([row(), row({ skuCode: 'vip_year', expiresAt: later })]);
    const status = await service.status(7);
    expect(status.expiresAt).toBe(later.toISOString());
    expect(status.skuCode).toBe('vip_year');
  });

  it('60 秒内重复查询只打一次库；invalidate 后重新查', async () => {
    const { service, findMany } = makeService([row()]);
    await service.status(7);
    await service.status(7);
    expect(findMany).toHaveBeenCalledTimes(1);
    service.invalidate(7);
    await service.status(7);
    expect(findMany).toHaveBeenCalledTimes(2);
  });
});

describe('权益授予（支付成功）', () => {
  it('已有未到期权益：在原到期日之上叠加（续期）', async () => {
    const base = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const { service, create } = makeService([]);
    await service.grantForPaidOrder(
      { userEntitlement: { findMany: vi.fn(async () => [row({ expiresAt: base })]), create } } as never,
      { userId: 7, orderId: 9, skuCode: 'vip_month', durationDays: 30 },
    );
    const data = (create.mock.calls[0] as unknown as [{ data: { expiresAt: Date } }])?.[0]?.data;
    expect(data?.expiresAt.getTime()).toBe(base.getTime() + 30 * 24 * 60 * 60 * 1000);
  });

  it('已是终身会员：不再写新权益行', async () => {
    const { service, create } = makeService([]);
    await service.grantForPaidOrder(
      { userEntitlement: { findMany: vi.fn(async () => [row({ expiresAt: null })]), create } } as never,
      { userId: 7, orderId: 9, skuCode: 'vip_month', durationDays: 30 },
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('购买终身卡：expiresAt 落 NULL', async () => {
    const { service, create } = makeService([]);
    await service.grantForPaidOrder({ userEntitlement: { findMany: vi.fn(async () => []), create } } as never, {
      userId: 7,
      orderId: 9,
      skuCode: 'vip_lifetime',
      durationDays: 0,
    });
    const data = (create.mock.calls[0] as unknown as [{ data: { expiresAt: Date | null } }])?.[0]?.data;
    expect(data?.expiresAt).toBeNull();
  });
});

describe('退款撤销权益', () => {
  it('只撤销该订单发放的那一条（按 orderId 精确匹配）', async () => {
    const { service, updateMany } = makeService([]);
    await service.revokeForOrder(12, 7);
    const args = (
      updateMany.mock.calls[0] as unknown as [{ where: { orderId: bigint }; data: { status: string } }]
    )?.[0];
    expect(args?.where.orderId).toBe(12n);
    expect(args?.data.status).toBe('revoked');
  });
});
