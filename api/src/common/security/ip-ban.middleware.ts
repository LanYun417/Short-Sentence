/**
 * IP 黑名单中间件（**最早**的安全闸门，置于接口限流之前）。
 * 模块职责：在请求进入业务前，若来源 IP 处于封禁名单，直接以 403 信封拒绝，不再消耗后续资源。
 *
 * 与 rate-limit 的异同：
 * - 同样直接写 403/429 信封并 `return`（不走异常过滤器，避免退化为 Express 默认 500）；
 * - 但本中间件**先于** RateLimitMiddleware 执行——被封禁的 IP 连「限流计数」都不该再产生。
 *
 * 安全与降级：
 * - 仅在 `config.ipBan.enabled=true` 时生效；关闭则直接放行（与功能默认关闭一致）。
 * - 跳过健康检查探针（高频请求，不应被自己挡住）。
 * - `isBanned` 异常时 fail-open 放行，绝不因安全增强故障导致全站不可访问。
 */
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/config.js';
import { ERROR_CODE, ERROR_MESSAGE } from '../config/constants.js';
import { IpBanService } from './ip-ban.service.js';
import { getClientIp } from '../log/operation-log.interceptor.js';

/** 不检查黑名单的路径（健康检查探针高频，不应被自己挡住）。 */
const SKIP_PATTERNS: RegExp[] = [/^\/api\/health\//];

@Injectable()
export class IpBanMiddleware implements NestMiddleware {
  constructor(private readonly ipBan: IpBanService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!config.ipBan.enabled) {
      next();
      return;
    }

    const path = (req.originalUrl || req.url).split('?')[0] ?? '';
    if (SKIP_PATTERNS.some((pattern) => pattern.test(path))) {
      next();
      return;
    }

    const ip = getClientIp(req);
    if (ip && (await this.ipBan.isBanned(ip))) {
      // 信封体由响应拦截器统一约定；此处直接写（与限流中间件同口径，绕过拦截器）
      res.status(ERROR_CODE.FORBIDDEN).json({
        code: ERROR_CODE.FORBIDDEN,
        message: ERROR_MESSAGE.FORBIDDEN,
        data: null,
      });
      return;
    }

    next();
  }
}
