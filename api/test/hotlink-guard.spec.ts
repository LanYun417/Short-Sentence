import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { HotlinkGuardMiddleware, isRefererAllowed } from '../src/common/file/file-guards.js';

/**
 * 防盗链策略：重点覆盖「局域网真机联调」。
 *
 * 背景：手机访问 `http://192.168.x.x:3001` 时，Nuxt devProxy 转发给后端的
 * 请求 Host 是 `localhost:3000`，浏览器 Referer 仍是局域网 IP——两者不同源，
 * 不额外放行会导致题目配图全部 403。
 */
const BASE = {
  requestHost: 'localhost:3000',
  allowedReferers: [] as readonly string[],
};

function allowed(
  referer: string | undefined,
  isDev = false,
  extra: Partial<{ allowedReferers: readonly string[] }> = {},
): boolean {
  return isRefererAllowed({ ...BASE, referer, isDev, ...extra });
}

describe('isRefererAllowed', () => {
  it('同源放行', () => {
    expect(allowed('http://localhost:3000/static/a.png')).toBe(true);
  });

  it('无 Referer 放行（直接访问 / 服务端调用）', () => {
    expect(allowed(undefined)).toBe(true);
  });

  it('开发期放行局域网私有地址（RFC1918）', () => {
    for (const host of ['192.168.1.7:3001', '10.0.0.8:3001', '172.20.3.4:3001']) {
      expect(allowed(`http://${host}/`, true)).toBe(true);
    }
  });

  it('生产环境仍拦截局域网地址', () => {
    expect(allowed('http://192.168.1.7:3001/', false)).toBe(false);
  });

  it('外站始终拦截', () => {
    expect(allowed('https://evil.example.com/', true)).toBe(false);
  });

  it('白名单命中放行', () => {
    expect(
      allowed('https://web.example.com/', false, {
        allowedReferers: ['web.example.com'],
      }),
    ).toBe(true);
  });

  it('非法 Referer 视为外链', () => {
    expect(allowed('not-a-url', true)).toBe(false);
  });
});

describe('HotlinkGuardMiddleware', () => {
  it('外站返回 403', () => {
    const middleware = new HotlinkGuardMiddleware();
    const req = {
      headers: { host: 'localhost:3000', referer: 'https://evil.example.com/' },
    } as unknown as Request;
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { status } as unknown as Response;
    const next = vi.fn();

    middleware.use(req, res, next as unknown as NextFunction);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
