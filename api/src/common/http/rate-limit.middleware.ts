/**
 * 接口限流中间件（**IP + 登录用户**双维度固定窗口，基于 Redis）。
 *
 * 为什么需要：原先只有登录接口有按账号的频率限制，验证码、公开文档等接口完全没有闸门，
 * 单机脚本即可把验证码接口刷爆（每个验证码都会写 Redis 并占内存）。
 *
 * 为什么要加「用户」维度：只按 IP 有两个天然缺口——
 * 1) 攻击者用一批代理 IP 换着打，IP 计数永远上不去（单账号可无限刷）；
 * 2) 公司/学校的出口 IP 下所有正常用户共享同一份额度，容易被别人拖累。
 * 加上用户维度后「一号一额度」，跨 IP 刷量同样被封。
 *
 * 口径：
 * - 键为 `ratelimit:<ip>:<窗口序号>` / `ratelimit:u:<体系:id>:<窗口序号>`，
 *   用 Redis 的 `INCR` + 首次 `PEXPIRE` 形成固定窗口
 *   （复用 RedisService.incrWithTtl，无需额外脚本，集群下天然共享计数）；
 * - **Redis 不可用时降级放行**（只打一条 warn）：与项目对 Redis 的整体降级策略一致，
 *   限流是防护而非业务前置条件，不能因为 Redis 抖动导致全站 429；
 * - 超限直接写 429 信封（与 HotlinkGuardMiddleware 写法一致）。不 `next(err)`：
 *   中间件抛出的错误不经过控制器异常过滤器，会退化成 Express 默认 500 页面；
 * - 跳过健康检查与根探活：探针是**高频**请求（编排系统每秒可打多次），
 *   把它们计入限流会自己把自己打成 429；
 * - 放在访问日志中间件**之后**注册：被限流的请求同样留在 `sys_http_log` 里，便于排查刷量来源。
 *
 * 用户标识的来源：**只解令牌载荷里的 userId，不做验签**。
 * 理由：这里只是把请求分到某个计数桶里，伪造 userId 只能污染自己那个桶（既拿不到额外额度，
 * 也影响不到别人）——真正的身份校验由 AuthGuard 完成，限流层不该、也无法承担鉴权职责。
 * 解析失败（无令牌 / 不是 JWT）就只走 IP 维度，绝不因此拒绝请求。
 */
import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/config.js';
import { ERROR_CODE, ERROR_MESSAGE } from '../config/constants.js';
import { RedisService } from '../redis/redis.service.js';

/** 不计入限流的路径（健康检查与根探活）。 */
const SKIP_PATTERNS: RegExp[] = [/^\/api\/health\//, /^\/api\/?$/];

/**
 * 敏感接口的收紧阈值（按顺序匹配，命中即用）。
 *
 * `ipMax` 挡「一个 IP 到处试」，`userMax` 挡「一个账号猛刷」。
 * 公开接口（未登录）没有用户维度，只吃 `ipMax`。
 */
interface ScopeLimit {
  /** 路径匹配 */
  pattern: RegExp;
  /** 单 IP / 单窗口上限 */
  ipMax: number;
  /** 单登录用户 / 单窗口上限 */
  userMax: number;
}

const SCOPE_LIMITS: ScopeLimit[] = [
  // 后台登录：防换账号爆破（按账号锁定见 AccountLockService，这里补 IP 维度）
  { pattern: /^\/api\/auth\/login/, ipMax: 20, userMax: 20 },
  // 验证码：每次进登录页都会取一次，留足余量即可；它也是「写 Redis」的接口，不能放开
  { pattern: /^\/api\/auth\/captcha/, ipMax: 30, userMax: 30 },
  // 客户端注册：会落一行用户表，属于「制造资源」的接口，必须比登录更严
  { pattern: /^\/api\/client\/auth\/register/, ipMax: 10, userMax: 10 },
  // 客户端验证码
  { pattern: /^\/api\/client\/auth\/captcha/, ipMax: 30, userMax: 30 },
  // 刷新令牌：正常半小时一次，给足余量但防被当成「无限续签」接口刷
  { pattern: /^\/api\/client\/auth\/refresh/, ipMax: 60, userMax: 60 },
  // 改密 / 上传头像：低频且高风险
  { pattern: /^\/api\/client\/auth\/password/, ipMax: 10, userMax: 10 },
  { pattern: /^\/api\/client\/auth\/avatar/, ipMax: 10, userMax: 10 },
  // 答题：一次刷题 = 抽题 1 次 + 提交 1 次，正常用户每分钟最多十几题
  { pattern: /^\/api\/client\/questions\/\d+\/answer/, ipMax: 90, userMax: 60 },
  // 举报/反馈：给用户留够额度，但防脚本批量灌水
  { pattern: /^\/api\/client\/report/, ipMax: 10, userMax: 10 },
  // 句签领取：幂等接口，但同样不该被轮询
  { pattern: /^\/api\/client\/sentence-card\/claim/, ipMax: 10, userMax: 10 },
  // 客户端 AI：另有每日额度（AiQuotaService）兜底成本，这里防瞬时并发
  { pattern: /^\/api\/client\/ai/, ipMax: 60, userMax: 30 },
  // 接口文档：公开且响应体较大，防被反复拉取
  { pattern: /^\/api\/docs/, ipMax: 120, userMax: 120 },
];

/** 单维度计数结果。 */
type LimitOutcome = 'ok' | 'exceeded' | 'degraded';

/** 从 Bearer 令牌 / `?token=` 里取用户标识（不验签，仅用于分桶）。 */
export function extractRateLimitIdentity(req: Request): string | null {
  const raw = req.headers?.authorization;
  let token: string | null = null;
  if (typeof raw === 'string' && raw.startsWith('Bearer ')) {
    token = raw.slice(7).trim();
  }
  if (!token) {
    const queryToken = (req.query as Record<string, unknown> | undefined)?.token;
    token = typeof queryToken === 'string' && queryToken ? queryToken : null;
  }
  if (!token) {
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      userId?: unknown;
      tokenType?: unknown;
    };
    if (payload.userId === undefined || payload.userId === null) {
      return null;
    }
    // 带上体系前缀：admin 与 client 的 id 空间独立，避免「两套用户表同号」被算成同一个人
    const scope = payload.tokenType === 'client' ? 'client' : 'admin';
    return `${scope}:${String(payload.userId).slice(0, 32)}`;
  } catch {
    return null;
  }
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  /** Redis 降级提示只打一次，避免每请求刷日志。 */
  private degradedWarned = false;

  constructor(private readonly redis: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!config.rateLimit.enabled) {
      next();
      return;
    }

    const path = (req.originalUrl || req.url).split('?')[0] ?? '';
    if (SKIP_PATTERNS.some((pattern) => pattern.test(path))) {
      next();
      return;
    }

    const scope = SCOPE_LIMITS.find((item) => item.pattern.test(path));
    const ipMax = scope?.ipMax ?? config.rateLimit.max;
    const windowMs = config.rateLimit.windowMs;
    const windowIndex = Math.floor(Date.now() / windowMs);
    const ip = req.ip ?? 'unknown';

    const ipKey = `ratelimit:${ip}:${windowIndex}`;
    const ipOutcome = await this.consume(ipKey, windowMs, ipMax, res, 'X-RateLimit');
    if (ipOutcome === 'degraded') {
      this.warnDegraded();
      next();
      return;
    }
    if (ipOutcome === 'exceeded') {
      await this.respondTooMany(res, ipKey);
      return;
    }

    // 用户维度：仅当能取到令牌时才启用（公开接口没有第二维度）
    const identity = extractRateLimitIdentity(req);
    if (identity) {
      const userMax = scope?.userMax ?? config.rateLimit.userMax;
      const userKey = `ratelimit:u:${identity}:${windowIndex}`;
      const userOutcome = await this.consume(userKey, windowMs, userMax, res, 'X-RateLimit-User');
      if (userOutcome === 'degraded') {
        this.warnDegraded();
      } else if (userOutcome === 'exceeded') {
        await this.respondTooMany(res, userKey);
        return;
      }
    }

    next();
  }

  /**
   * 自增一个窗口计数并写响应头。
   * @param key Redis 键
   * @param windowMs 窗口长度（ms）
   * @param max 上限
   * @param res 响应对象
   * @param headerPrefix 响应头前缀（区分 IP / 用户两维）
   * @returns 计数结果；`degraded` 表示 Redis 不可用，调用方应降级放行
   */
  private async consume(
    key: string,
    windowMs: number,
    max: number,
    res: Response,
    headerPrefix: string,
  ): Promise<LimitOutcome> {
    const count = await this.redis.incrWithTtl(key, windowMs);
    if (count === 0) {
      // 0 = Redis 不可用（未配置 / 连接失败）
      return 'degraded';
    }
    res.setHeader(`${headerPrefix}-Limit`, String(max));
    res.setHeader(`${headerPrefix}-Remaining`, String(Math.max(max - count, 0)));
    return count > max ? 'exceeded' : 'ok';
  }

  /** 写 429 信封（含 Retry-After）。 */
  private async respondTooMany(res: Response, key: string): Promise<void> {
    const ttlMs = await this.redis.pttl(key);
    if (ttlMs > 0) {
      res.setHeader('Retry-After', String(Math.ceil(ttlMs / 1000)));
    }
    res.status(ERROR_CODE.TOO_MANY_REQUESTS).json({
      code: ERROR_CODE.TOO_MANY_REQUESTS,
      message: ERROR_MESSAGE.TOO_MANY_REQUESTS,
      data: null,
    });
  }

  /** Redis 降级提示只打一次。 */
  private warnDegraded(): void {
    if (this.degradedWarned) {
      return;
    }
    this.degradedWarned = true;
    this.logger.warn('[RateLimit] Redis 不可用，接口限流已降级放行（仅提示一次）');
  }
}
