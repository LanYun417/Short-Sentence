/**
 * CommonModule：全局共享基础设施。
 * 模块职责：把配置、Redis、JWT、验证码、鉴权缓存、鉴权用户查询、日志、文件等
 * 横切能力以全局模块形式导出，使业务模块无需逐个 import 即可注入。
 */
import { Global, Module } from '@nestjs/common';
import { JwtService } from './auth/jwt.service.js';
import { RedisService } from './redis/redis.service.js';
import { SessionService } from './auth/session.service.js';
import { TokenBlacklistService } from './auth/token-blacklist.service.js';
import { AuthCacheService } from './auth/auth-cache.service.js';
import { AuthUserService } from './auth/auth-user.service.js';
import { ClientAuthService } from './auth/client-auth.service.js';
import { CaptchaService } from './auth/captcha.service.js';
import { DataScopeService } from './auth/data-scope.service.js';
import { LoginRateLimiterService } from './auth/login-rate-limit.service.js';
import { AccountLockService } from './auth/account-lock.service.js';
import { IpBanService } from './security/ip-ban.service.js';
import { OperationLogService } from './log/operation-log.service.js';
import { FileLoggerService } from './log/file-logger.service.js';
import { HttpLogQueueService } from './log/http-log-queue.service.js';
import { FileService } from './file/file.service.js';
import { ImageScaleService, HotlinkGuardMiddleware, ImageScaleMiddleware } from './file/file-guards.js';
import { IpRegionService } from './ip/ip-region.service.js';
import { AiCallLogService } from './ai/ai-call-log.service.js';
import { AiQuotaService } from './ai/ai-quota.service.js';
import { AiBudgetService } from './ai/ai-budget.service.js';
import { AiSettingsService } from './ai/ai-settings.service.js';
import { AgnesSentenceProvider } from './ai/agnes-sentence.provider.js';
import { AgnesImageProvider } from './ai/agnes-image.provider.js';
import { MailService } from './mail/mail.service.js';

@Global()
@Module({
  providers: [
    RedisService,
    JwtService,
    TokenBlacklistService,
    SessionService,
    AuthCacheService,
    AuthUserService,
    // 客户端用户查询（守卫 client 分支 + 客户端登录注册共用；与 AuthUserService 对应）
    ClientAuthService,
    CaptchaService,
    DataScopeService,
    LoginRateLimiterService,
    // 按账号维度的登录失败锁定（与按 IP 的 LoginRateLimiterService 互补）
    AccountLockService,
    // IP 黑名单（防单 IP 批量注册 / 登录爆破的兜底闸门；默认关闭，fail-open）
    IpBanService,
    OperationLogService,
    FileLoggerService,
    HttpLogQueueService,
    FileService,
    ImageScaleService,
    IpRegionService,
    // AI 能力（「短句」题库生题/生图；密钥缺失时由各 Provider 的 enabled 标记禁用）
    AiCallLogService,
    AiQuotaService,
    // 全局每日 AI 预算闸门（跨所有 AI 调用入口；0 = 不限）
    AiBudgetService,
    // AI 配置运行时快照（sys_config 优先、环境变量兜底；后台改完刷新）
    AiSettingsService,
    AgnesSentenceProvider,
    AgnesImageProvider,
    // 邮件（腾讯云 SES；凭证存 sys_config，后台可编辑，缺配置时发送接口报可读错误）
    MailService,
    // 静态资源链的中间件：由 app.setup.ts 显式挂到 express 上，需要能被 app.get 解析
    HotlinkGuardMiddleware,
    ImageScaleMiddleware,
  ],
  exports: [
    RedisService,
    JwtService,
    TokenBlacklistService,
    SessionService,
    AuthCacheService,
    AuthUserService,
    ClientAuthService,
    CaptchaService,
    DataScopeService,
    LoginRateLimiterService,
    // 按账号维度的登录失败锁定（与按 IP 的 LoginRateLimiterService 互补）
    AccountLockService,
    // IP 黑名单（防单 IP 批量注册 / 登录爆破的兜底闸门；默认关闭，fail-open）
    IpBanService,
    OperationLogService,
    FileLoggerService,
    HttpLogQueueService,
    FileService,
    ImageScaleService,
    IpRegionService,
    AiCallLogService,
    AiQuotaService,
    AiBudgetService,
    AiSettingsService,
    AgnesSentenceProvider,
    AgnesImageProvider,
    MailService,
  ],
})
export class CommonModule {}
