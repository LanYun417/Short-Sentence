/**
 * CSP 默认策略解析（纯函数单测，不触碰 config 模块缓存）。
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_CSP_POLICY, resolveCspPolicy } from '../src/common/http/csp-default.js';

describe('resolveCspPolicy', () => {
  it('显式 CSP_POLICY 优先（生产/开发都一样）', () => {
    expect(resolveCspPolicy("default-src 'none'", 'production')).toBe("default-src 'none'");
    expect(resolveCspPolicy("default-src 'none'", 'development')).toBe("default-src 'none'");
  });

  it('未配置时生产环境下发默认策略', () => {
    expect(resolveCspPolicy(undefined, 'production')).toBe(DEFAULT_CSP_POLICY);
  });

  it('未配置时开发环境不下发（Vite HMR 需要 eval/内联）', () => {
    expect(resolveCspPolicy(undefined, 'development')).toBe('');
    expect(resolveCspPolicy(undefined, undefined)).toBe('');
  });

  it('默认策略包含关键防护指令且只放行同源', () => {
    expect(DEFAULT_CSP_POLICY).toContain("default-src 'self'");
    expect(DEFAULT_CSP_POLICY).toContain("object-src 'none'");
    expect(DEFAULT_CSP_POLICY).toContain("base-uri 'self'");
    expect(DEFAULT_CSP_POLICY).toContain("frame-ancestors 'self'");
    // 第三方脚本/样式不放行（script-src/style-src 没有 https: 通配）
    const scriptSrc = /script-src ([^;]+)/.exec(DEFAULT_CSP_POLICY)?.[1] ?? '';
    const styleSrc = /style-src ([^;]+)/.exec(DEFAULT_CSP_POLICY)?.[1] ?? '';
    expect(scriptSrc).not.toContain('https:');
    expect(scriptSrc).not.toContain('*');
    expect(styleSrc).not.toContain('https:');
  });
});
