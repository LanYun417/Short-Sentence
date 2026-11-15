/**
 * CSP 默认策略（纯函数，便于单测，不依赖 config 模块加载）。
 *
 * 背景：前端是 Vue SPA，Element Plus / Tailwind 会写内联样式、Nuxt SSR 有内联数据块，
 * 过严的 CSP 会白屏。因此默认策略**不搞 nonce**，只做两件事：
 * 1. 把第三方来源收敛到 'self'（script/style/img/connect/media/font）；
 * 2. 保留真正有价值的指令：`object-src 'none'`（禁插件）、`base-uri 'self'`（防 base 劫持）、
 *    `frame-ancestors 'self'`（防嵌套点击劫持，与 X-Frame-Options 一致）。
 */

/** 生产环境内置的保守 CSP。 */
export const DEFAULT_CSP_POLICY =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; media-src 'self' blob:; " +
  "object-src 'none'; base-uri 'self'; frame-ancestors 'self'";

/**
 * 解析最终下发的 CSP：显式配置优先；未配置时生产环境用默认策略，开发环境不下发。
 */
export function resolveCspPolicy(explicit: string | undefined, nodeEnv: string | undefined): string {
  if (explicit) return explicit;
  return nodeEnv === 'production' ? DEFAULT_CSP_POLICY : '';
}
