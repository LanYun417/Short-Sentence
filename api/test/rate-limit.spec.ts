/**
 * 接口限流中间件单测。
 *
 * 为什么用假 Redis 而不是打真接口：验证 429 需要把计数打过阈值（默认 300 次/分钟），
 * 用 fake 直接给计数既快又覆盖得到分支；同时能覆盖「Redis 降级放行」这条真环境难以复现的分支。
 */
import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/common/config/config.js';
import { RateLimitMiddleware, extractRateLimitIdentity } from '../src/common/http/rate-limit.middleware.js';
import type { RedisService } from '../src/common/redis/redis.service.js';

/** 造一个只暴露限流用到的两个方法的假 Redis。 */
function fakeRedis(options: { count: number; ttlMs?: number }): RedisService {
  return {
    incrWithTtl: vi.fn().mockResolvedValue(options.count),
    pttl: vi.fn().mockResolvedValue(options.ttlMs ?? 30_000),
  } as unknown as RedisService;
}

/** 可断言的假响应（记录 header / 状态码 / 响应体）。 */
interface FakeResponse extends Response {
  __headers: Record<string, string>;
  __status?: number;
  __body?: unknown;
}

/** 造一个记录 header / 状态的假响应。 */
function fakeResponse(): FakeResponse {
  const res = {
    __headers: {} as Record<string, string>,
    __status: undefined as number | undefined,
    __body: undefined as unknown,
  } as unknown as FakeResponse;
  res.setHeader = (name: string, value: string): FakeResponse => {
    res.__headers[name] = value;
    return res;
  };
  res.status = (code: number): FakeResponse => {
    res.__status = code;
    return res;
  };
  res.json = (body?: unknown): FakeResponse => {
    res.__body = body;
    return res;
  };
  return res;
}

/** 造一个最小请求对象。 */
function fakeRequest(path: string, ip = '10.0.0.1'): Request {
  return { originalUrl: path, url: path, ip, headers: {} } as unknown as Request;
}

/** 造带令牌的请求：按 `{ userId, tokenType }` 现签一个假 JWT（限流只看载荷，不验签）。 */
function fakeTokenRequest(path: string, userId: number, tokenType = 'client'): Request {
  const payload = Buffer.from(JSON.stringify({ userId, tokenType })).toString('base64url');
  const req = fakeRequest(path) as unknown as { headers: Record<string, string> };
  req.headers.authorization = `Bearer header.${payload}.signature`;
  return req as unknown as Request;
}

/** 造一个「按 key 决定计数」的假 Redis（用来区分 IP / 用户两个维度）。 */
function fakeRedisMatcher(match: (key: string) => number): RedisService {
  return {
    incrWithTtl: vi.fn((key: string) => Promise.resolve(match(key))),
    pttl: vi.fn().mockResolvedValue(30_000),
  } as unknown as RedisService;
}

/** 取假 Redis 上 incrWithTtl 的调用次数。 */
function incrCalls(redis: RedisService): unknown[] {
  return (redis.incrWithTtl as unknown as { mock: { calls: unknown[] } }).mock.calls;
}

const originalEnabled = config.rateLimit.enabled;

describe('RateLimitMiddleware', () => {
  beforeEach(() => {
    (config.rateLimit as { enabled: boolean }).enabled = true;
  });

  afterEach(() => {
    (config.rateLimit as { enabled: boolean }).enabled = originalEnabled;
  });

  it('未超限时放行，并带出限额与余量响应头', async () => {
    const middleware = new RateLimitMiddleware(fakeRedis({ count: 5 }));
    const res = fakeResponse();
    const next = vi.fn() as unknown as NextFunction;

    await middleware.use(fakeRequest('/api/users'), res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.__headers['X-RateLimit-Limit']).toBe(String(config.rateLimit.max));
    expect(res.__headers['X-RateLimit-Remaining']).toBe(String(config.rateLimit.max - 5));
    expect(res.__status).toBeUndefined();
  });

  it('超过全局阈值返回 429 信封与 Retry-After（不抛异常、不依赖异常过滤器）', async () => {
    const middleware = new RateLimitMiddleware(fakeRedis({ count: config.rateLimit.max + 1, ttlMs: 42_000 }));
    const res = fakeResponse();
    const next = vi.fn() as unknown as NextFunction;

    await middleware.use(fakeRequest('/api/users'), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.__status).toBe(429);
    expect(res.__body).toMatchObject({ code: 429, data: null });
    expect(res.__headers['Retry-After']).toBe('42');
  });

  it('登录接口用更严的阈值（20 次/窗口，防换账号爆破）', async () => {
    const middleware = new RateLimitMiddleware(fakeRedis({ count: 21 }));
    const res = fakeResponse();
    const next = vi.fn() as unknown as NextFunction;

    await middleware.use(fakeRequest('/api/auth/login'), res, next);

    expect(res.__status).toBe(429);
    expect(res.__headers['X-RateLimit-Limit']).toBe('20');
  });

  it('健康检查与根探活不计入限流（探针是高频请求，否则会自己打成 429）', async () => {
    const redis = fakeRedis({ count: 1 });
    const middleware = new RateLimitMiddleware(redis);
    const next = vi.fn() as unknown as NextFunction;

    await middleware.use(fakeRequest('/api/health/live'), fakeResponse(), next);
    await middleware.use(fakeRequest('/api/health/ready'), fakeResponse(), next);
    await middleware.use(fakeRequest('/api'), fakeResponse(), next);

    expect(next).toHaveBeenCalledTimes(3);
    expect((redis.incrWithTtl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0);
  });

  it('Redis 不可用时降级放行（计数 0 表示未启用/异常，不得因此全站 429）', async () => {
    const middleware = new RateLimitMiddleware(fakeRedis({ count: 0 }));
    const res = fakeResponse();
    const next = vi.fn() as unknown as NextFunction;

    await middleware.use(fakeRequest('/api/users'), res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.__status).toBeUndefined();
    expect(res.__headers['X-RateLimit-Limit']).toBeUndefined();
  });

  it('带令牌的请求同时过「用户」维度：换 IP 也刷不动（单账号跨 IP 仍被封）', async () => {
    // IP 维度计数很低，用户维度已超限 —— 模拟「换一批代理 IP 打同一个账号」
    const redis = fakeRedisMatcher((key) => (key.startsWith('ratelimit:u:') ? config.rateLimit.userMax + 1 : 1));
    const middleware = new RateLimitMiddleware(redis);
    const res = fakeResponse();
    const next = vi.fn() as unknown as NextFunction;

    await middleware.use(fakeTokenRequest('/api/users', 7), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.__status).toBe(429);
    expect(res.__headers['X-RateLimit-User-Limit']).toBe(String(config.rateLimit.userMax));
  });

  it('用户维度未超限时照常放行（两个维度都计数）', async () => {
    const redis = fakeRedisMatcher(() => 1);
    const middleware = new RateLimitMiddleware(redis);
    const next = vi.fn() as unknown as NextFunction;

    await middleware.use(fakeTokenRequest('/api/users', 7), fakeResponse(), next);

    expect(next).toHaveBeenCalledWith();
    expect(incrCalls(redis)).toHaveLength(2);
  });

  it('公开接口没有用户维度，只计 IP（不多写一次 Redis）', async () => {
    const redis = fakeRedisMatcher(() => 1);
    const middleware = new RateLimitMiddleware(redis);

    await middleware.use(fakeRequest('/api/users'), fakeResponse(), vi.fn() as unknown as NextFunction);

    expect(incrCalls(redis)).toHaveLength(1);
  });

  it('客户端注册用更严的阈值（10 次/窗口，防批量注册）', async () => {
    const middleware = new RateLimitMiddleware(fakeRedis({ count: 11 }));
    const res = fakeResponse();

    await middleware.use(fakeRequest('/api/client/auth/register'), res, vi.fn() as unknown as NextFunction);

    expect(res.__status).toBe(429);
    expect(res.__headers['X-RateLimit-Limit']).toBe('10');
  });

  it('答题接口按用户收紧（60 次/窗口，防脚本重放刷分）', async () => {
    const redis = fakeRedisMatcher((key) => (key.startsWith('ratelimit:u:') ? 61 : 1));
    const middleware = new RateLimitMiddleware(redis);
    const res = fakeResponse();

    await middleware.use(
      fakeTokenRequest('/api/client/questions/12/answer', 3),
      res,
      vi.fn() as unknown as NextFunction,
    );

    expect(res.__status).toBe(429);
    expect(res.__headers['X-RateLimit-User-Limit']).toBe('60');
  });

  it('用户标识只从令牌载荷取，且按体系隔离（admin/client 同号不算同一人）', () => {
    expect(extractRateLimitIdentity(fakeTokenRequest('/x', 7))).toBe('client:7');
    expect(extractRateLimitIdentity(fakeTokenRequest('/x', 7, 'admin'))).toBe('admin:7');
    expect(extractRateLimitIdentity(fakeRequest('/x'))).toBeNull();

    // 非法令牌不解析、也不抛错（限流层不承担鉴权职责，解析不了就只走 IP 维度）
    const bogus = fakeRequest('/x') as unknown as { headers: Record<string, string> };
    bogus.headers.authorization = 'Bearer not-a-jwt';
    expect(extractRateLimitIdentity(bogus as unknown as Request)).toBeNull();
  });
});
