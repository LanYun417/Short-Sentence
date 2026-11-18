/**
 * AI 配额与会员分档。
 *
 * 免费层与会员层只差「上限」，计数键不变——钉住三点：
 * ① 免费用户达到免费上限即 429，提示里给出会员提升后的次数；
 * ② 会员用同一份已用次数时仍可继续（上限更大）；
 * ③ usage 返回的上限随身份变化（前端「剩余 N 次」直接读它）。
 */
import { describe, expect, it, vi } from 'vitest';
import { AiQuotaService } from '../src/common/ai/ai-quota.service.js';
import { config } from '../src/common/config/config.js';

/** 假 Redis：get 返回预置用量，自增恒成功。 */
function makeRedis(used: number) {
  return {
    get: vi.fn(async () => (used > 0 ? String(used) : null)),
    incrWithTtl: vi.fn(async () => true),
    decr: vi.fn(async () => undefined),
  };
}

/** 假权益：按 isVip 返回值。 */
function makeEntitlements(vip: boolean) {
  return {
    isVip: vi.fn(async () => vip),
    status: vi.fn(async () => ({ vip, lifetime: false, expiresAt: null, skuCode: null })),
  };
}

describe('AI 配额分档', () => {
  it('免费用户用满免费额度后被拦，并提示会员可提升', async () => {
    const redis = makeRedis(config.ai.dailyQuota);
    const service = new AiQuotaService(redis as never, makeEntitlements(false) as never);
    await expect(service.consume(7, 'expand')).rejects.toThrow(/会员/);
    expect(redis.incrWithTtl).not.toHaveBeenCalled();
  });

  it('会员用同一份已用次数仍可继续（上限更大）', async () => {
    const redis = makeRedis(config.ai.dailyQuota);
    const service = new AiQuotaService(redis as never, makeEntitlements(true) as never);
    await expect(service.consume(7, 'expand')).resolves.toBeUndefined();
    expect(redis.incrWithTtl).toHaveBeenCalledTimes(1);
  });

  it('usage 返回的上限随身份变化', async () => {
    const free = await new AiQuotaService(makeRedis(0) as never, makeEntitlements(false) as never).usage(7);
    const vip = await new AiQuotaService(makeRedis(0) as never, makeEntitlements(true) as never).usage(7);
    expect(free.limit).toBe(config.ai.dailyQuota);
    expect(vip.limit).toBe(Math.max(config.ai.dailyQuota, config.pay.vipAiDailyQuota));
    expect(vip.limit).toBeGreaterThan(free.limit);
  });
});
