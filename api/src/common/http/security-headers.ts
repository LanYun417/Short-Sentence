/**
 * 安全响应头中间件（零依赖实现）。
 *
 * 为什么不用 helmet：本项目把「零第三方运行时依赖」作为项目身份约束（见
 * `scripts/deps-guard.mjs` 与 `knowledge/前端开发规范/15-依赖守护与版本策略.md`），
 * 而这里需要的只是几个固定响应头，手写 15 行即可，不值得为此新增运行时依赖并更新基线。
 *
 * 下发内容与理由：
 * - `X-Content-Type-Options: nosniff`：禁止浏览器 sniff 类型，避免上传文件被当成脚本执行；
 * - `X-Frame-Options: SAMEORIGIN`：防点击劫持（页面可被同源 iframe 嵌套，够用且不误伤）；
 * - `Referrer-Policy: strict-origin-when-cross-origin`：跨站只发 origin，
 *   同源仍发完整 Referer —— 防盗链（HotlinkGuard）依赖同源 Referer 判定，不能改成 no-referrer；
 * - `X-Permitted-Cross-Domain-Policies: none`：关闭 Flash/PDF 时代的跨域策略文件读取；
 * - `Permissions-Policy`：明确关闭地理位置 / 麦克风 / 摄像头 / 支付等本项目用不到的浏览器能力；
 * - `Strict-Transport-Security`：仅在 `SECURITY_HSTS` / production 时下发
 *   （HTTP 部署下浏览器本就忽略，但避免误导运维）；
 * - `Content-Security-Policy`：`CSP_POLICY` 显式配置时优先；未配置时生产环境
 *   （NODE_ENV=production）下发 config.ts 里的保守默认策略，开发环境不下发。
 *   前端为 SPA，Element Plus 与 Tailwind 会写内联样式、ECharts 用 canvas，
 *   所以默认策略保留 'unsafe-inline'，只把第三方来源收敛到 'self'，
 *   真正挡外部脚本注入的是 `object-src 'none'` / `base-uri 'self'` / `frame-ancestors 'self'`。
 *
 * 不下发 `Cross-Origin-Resource-Policy`：它会影响 `/static` 资源的跨站引用，
 * 而静态资源是否可访问已由静态鉴权 + 防盗链决定，不在这里叠加一层易误伤的策略。
 *
 * 另外给 `/api` 下的响应统一下发 `Cache-Control: no-store`：接口响应都是**按人**的数据
 * （个人信息、答题结果、登录令牌），一旦被中间代理或浏览器磁盘缓存留存，就等于把
 * 别人的数据放在共享缓存里。静态资源（`/static`）与 SPA 产物不在此列，缓存策略不变。
 */
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/config.js';

/** 本项目未使用的浏览器能力，统一显式关闭。 */
const PERMISSIONS_POLICY = 'geolocation=(), microphone=(), camera=(), payment=(), usb=()';

/** HSTS 有效期：180 天（与常见反代模板一致，不写 preload 以免误入预加载列表）。 */
const HSTS_VALUE = 'max-age=15552000; includeSubDomains';

/** 接口响应禁用缓存（含历史实现里的 Pragma，兼容 HTTP/1.0 代理）。 */
const NO_STORE = 'no-store, no-cache, must-revalidate';

/**
 * 生成安全响应头中间件（挂在全局，覆盖 `/api` 与静态资源 / SPA 回退）。
 * @returns Express 中间件
 */
export function securityHeaders(): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    if ((req.path ?? '').startsWith('/api')) {
      res.setHeader('Cache-Control', NO_STORE);
      res.setHeader('Pragma', 'no-cache');
    }
    if (config.security.hsts) {
      res.setHeader('Strict-Transport-Security', HSTS_VALUE);
    }
    if (config.security.csp) {
      res.setHeader('Content-Security-Policy', config.security.csp);
    }
    next();
  };
}
