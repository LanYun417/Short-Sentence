/**
 * 鉴权守卫与请求上下文装饰器。
 * 模块职责：解析 Bearer Token、校验 accessToken、查库校验用户状态（强制下线）、
 * 校验改密后旧 Token 失效与登出黑名单，并把用户上下文挂载到请求对象。
 */
import { type CanActivate, type ExecutionContext, Injectable, SetMetadata, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppException } from '../exception/app.exception.js';
import { ERROR_MESSAGE, Status } from '../config/constants.js';
import { JwtService } from './jwt.service.js';
import { SessionService } from './session.service.js';
import { TokenBlacklistService } from './token-blacklist.service.js';
import { RedisService } from '../redis/redis.service.js';
// 必须为**值导入**（非 import type）：Nest 依赖注入需要运行时的构造函数引用，
// 用 import type 会在 emitDecoratorMetadata 下退化为 Function，导致无法解析依赖。
import { AuthUserService } from './auth-user.service.js';
import { ClientAuthService } from './client-auth.service.js';
import type { AuthContext, AuthUserContext, ClientUserContext, JwtPayload } from '../types.js';

/** 请求对象扩展：挂载鉴权上下文。 */
export interface AuthenticatedRequest extends Request {
  /** 后台管理用户上下文（admin 令牌） */
  user?: AuthUserContext;
  /** 客户端用户上下文（client 令牌；与 user 互斥，不会同时存在） */
  clientUser?: ClientUserContext;
  /** 已加载的完整鉴权上下文，供控制器复用避免重复查库 */
  authContext?: AuthContext | null;
  tokenIat?: number;
  /** 当前令牌所属会话 id（供「登出」摘除会话记录；旧令牌无此字段） */
  tokenSid?: string;
}

/** 公开接口标记：跳过鉴权。 */
export const IS_PUBLIC_KEY = 'ly:isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** 读取请求中的 accessToken：优先 Authorization 头，回退 `?token=`（静态资源场景）。 */
export function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token) {
      return token;
    }
  }
  // 浏览器 <img>/<el-avatar> 无法自动带 Authorization 头，故前端在静态资源 URL 上拼 ?token=
  const queryToken = (req.query as Record<string, unknown> | undefined)?.token;
  if (typeof queryToken === 'string' && queryToken) {
    return queryToken;
  }
  return null;
}

/**
 * 提取并校验 accessToken，返回解码载荷；失败抛 AppException。
 * 守卫的 admin / client 两条分支共用（避免同一请求验两遍签）。
 */
export async function decodeAccessToken(req: Request, jwtService: JwtService): Promise<JwtPayload> {
  const token = extractToken(req);
  if (!token) {
    throw AppException.unauthorized('未提供访问令牌');
  }
  try {
    return await jwtService.verifyAccessToken(token);
  } catch (error) {
    if (jwtService.isExpiredError(error)) {
      throw AppException.unauthorized('登录已过期，请重新登录');
    }
    // jose 把「结构非法」「签名不符」等都归为 JWTInvalid / JWTClaimValidationFailed，
    // 统一按「令牌无效」处理，**不把内部错误细节透给客户端**。
    if (jwtService.isInvalidError(error)) {
      throw AppException.unauthorized('访问令牌无效');
    }
    // 兜底：任何其它解析异常同样按 401 处理（而非 500），避免泄露实现细节
    throw AppException.unauthorized('访问令牌无效');
  }
}

/**
 * 执行 admin 体系鉴权核心逻辑，返回用户上下文；失败抛 AppException。
 * 供守卫与静态资源中间件复用。
 *
 * @param req 请求对象
 * @param jwtService JWT 服务
 * @param blacklist 黑名单服务
 * @param authUserService 后台用户查询服务
 * @param sessionService 会话服务
 * @param redis Redis 服务
 * @param sidHolder  sid 出参容器
 * @param preloadedPayload 已由调用方验签的载荷（守卫主流程传入，避免重复验签）
 */
export async function authenticateRequest(
  req: Request,
  jwtService: JwtService,
  blacklist: TokenBlacklistService,
  authUserService: AuthUserService,
  sessionService: SessionService,
  redis: RedisService,
  sidHolder: { value?: string } = {},
  preloadedPayload?: JwtPayload,
): Promise<{ user: AuthUserContext; context: AuthContext | null }> {
  const payload = preloadedPayload ?? (await decodeAccessToken(req, jwtService));

  const context = await authUserService.loadAuthUser(Number(payload.userId));
  if (!context) {
    throw AppException.unauthorized('用户不存在');
  }

  // 强制下线：账号被禁用即失效
  if (Number(context.status) !== Status.ENABLED) {
    throw AppException.unauthorized(ERROR_MESSAGE.ACCOUNT_DISABLED);
  }

  // 改密后旧 Token 失效
  if (context.passwordChangedAt) {
    const changedAt = new Date(context.passwordChangedAt).getTime();
    if (payload.iat * 1000 < changedAt) {
      throw AppException.unauthorized(ERROR_MESSAGE.PASSWORD_CHANGED);
    }
  }

  // 登出后旧 Token 失效（Redis 黑名单）
  if (await blacklist.isTokenRevoked(context.userId, payload.iat)) {
    throw AppException.unauthorized(ERROR_MESSAGE.LOGOUT_INVALIDATED);
  }

  // 会话已被强制下线 / 已登出：令牌携带的 sid 在 Redis 中已无对应记录
  // 注意「只在 Redis 可用时才判定」——否则 Redis 一挂，全体用户会被立刻登出，
  // 与项目对 Redis 的整体降级策略（可用则增强、不可用则放行）相违背。
  if (payload.sid && redis.isReady()) {
    if (!(await sessionService.isAlive(payload.sid))) {
      throw AppException.unauthorized(ERROR_MESSAGE.SESSION_REVOKED);
    }
  }

  // sid 需要挂到请求上供登出使用；通过闭包返回避免改 AuthUserContext 结构
  sidHolder.value = payload.sid;

  const user: AuthUserContext = {
    userId: context.userId,
    username: context.username,
    roles: context.roleCodes,
    permissions: context.permissions,
    status: Number(context.status),
    deptId: Number(context.deptId ?? 0),
    deptName: context.deptName ?? null,
    tokenIat: payload.iat,
  };
  return { user, context };
}

/**
 * 全局鉴权守卫（APP_GUARD）。
 * 默认全部接口需鉴权，`@Public()` 显式放行（登录、验证码、健康检查、接口文档）。
 *
 * 双体系分流：accessToken 携带 `tokenType` claim——
 * - `admin`：走后台用户链路（loadAuthUser + 会话/黑名单校验），挂 `req.user`；
 * - `client`：走客户端用户链路（loadClientUser + 黑名单校验），挂 `req.clientUser`。
 * 两套用户表 id 空间独立，client 令牌**不可能**通过 admin 链路校验（反之亦然），从根上防越权。
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly blacklist: TokenBlacklistService,
    private readonly authUserService: AuthUserService,
    private readonly clientAuthService: ClientAuthService,
    private readonly sessionService: SessionService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sidHolder: { value?: string } = {};
    // 先验签拿到载荷，再按 tokenType 分流（同一请求只验一次签）
    const payload = await decodeAccessToken(req, this.jwtService);

    if (payload.tokenType === 'client') {
      await this.authenticateClient(req, payload);
      return true;
    }

    const { user, context: authContext } = await authenticateRequest(
      req,
      this.jwtService,
      this.blacklist,
      this.authUserService,
      this.sessionService,
      this.redis,
      sidHolder,
      payload,
    );
    req.user = user;
    req.tokenIat = user.tokenIat;
    req.tokenSid = sidHolder.value;
    req.authContext = authContext;
    return true;
  }

  /** client 体系鉴权：查库校验状态、改密失效与登出黑名单，挂载 req.clientUser。 */
  private async authenticateClient(req: AuthenticatedRequest, payload: JwtPayload): Promise<void> {
    const clientUser = await this.clientAuthService.loadClientUser(payload.userId);
    if (!clientUser) {
      throw AppException.unauthorized('用户不存在');
    }
    // 已注销账号：令牌与微信登录均失效
    if (clientUser.deletedAt) {
      throw AppException.unauthorized('账号已注销');
    }
    // 账号禁用即失效
    if (clientUser.status !== Status.ENABLED) {
      throw AppException.unauthorized(ERROR_MESSAGE.ACCOUNT_DISABLED);
    }
    // 改密后旧 Token 失效
    if (clientUser.passwordChangedAt) {
      const changedAt = new Date(clientUser.passwordChangedAt).getTime();
      if (payload.iat * 1000 < changedAt) {
        throw AppException.unauthorized(ERROR_MESSAGE.PASSWORD_CHANGED);
      }
    }
    // 登出后旧 Token 失效（Redis 黑名单，scope=client 与后台隔离）
    if (await this.blacklist.isTokenRevoked(clientUser.userId, payload.iat, 'client')) {
      throw AppException.unauthorized(ERROR_MESSAGE.LOGOUT_INVALIDATED);
    }
    req.clientUser = {
      userId: clientUser.userId,
      email: clientUser.email,
      nickname: clientUser.nickname,
      status: clientUser.status,
      tokenIat: payload.iat,
    };
    req.tokenIat = payload.iat;
  }
}

/** 参数装饰器：读取当前登录用户。 */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUserContext => {
  const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!req.user) {
    throw AppException.unauthorized();
  }
  return req.user;
});

/** 参数装饰器：读取当前登录的客户端用户（仅 client 体系控制器使用）。 */
export const CurrentClientUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ClientUserContext => {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.clientUser) {
      throw AppException.unauthorized();
    }
    return req.clientUser;
  },
);

/** 参数装饰器：读取已加载的鉴权上下文（含角色码/权限码），供控制器复用避免重复查库。 */
export const ReqAuthContext = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return req.authContext ?? null;
});
