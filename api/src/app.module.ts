/**
 * 应用根模块。
 * 模块职责：装配全局模块（数据库/基础设施/守卫/拦截器/过滤器）与各业务模块。
 */
import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthGuard } from './common/auth/auth.guard.js';
import { PermissionGuard } from './common/auth/permission.guard.js';
import { AllExceptionsFilter } from './common/exception/all-exceptions.filter.js';
import { ResponseInterceptor } from './common/http/response.interceptor.js';
import { OperationLogInterceptor } from './common/log/operation-log.interceptor.js';
import { CommonModule } from './common/common.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HttpAccessLoggerMiddleware } from './common/log/http-access-log.middleware.js';
import { RateLimitMiddleware } from './common/http/rate-limit.middleware.js';
import { IpBanMiddleware } from './common/security/ip-ban.middleware.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { MenuModule } from './modules/menu/menu.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { RoleModule } from './modules/roles/roles.module.js';
import { DeptModule } from './modules/depts/depts.module.js';
import { DictModule } from './modules/dict/dict.module.js';
import { ConfigModule } from './modules/config/config.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { GenModule } from './modules/gen/gen.module.js';
import { FilesModule } from './modules/files/files.module.js';
import { ProfileModule } from './modules/profile/profile.module.js';
import { LogsModule } from './modules/logs/logs.module.js';
import { DocsModule } from './modules/docs/docs.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MonitorModule } from './modules/monitor/monitor.module.js';
import { NoticeModule } from './modules/notice/notice.module.js';
import { FeedbackModule } from './modules/feedback/feedback.module.js';
import { TaskModule } from './modules/task/task.module.js';
import { ClientModule } from './modules/client/client.module.js';
import { SentenceModule } from './modules/sentence/sentence.module.js';
import { SentenceCardsModule } from './modules/sentence-cards/sentence-cards.module.js';
import { WordRootsModule } from './modules/word-roots/word-roots.module.js';
import { AppVersionsModule } from './modules/app-versions/app-versions.module.js';
import { MailModule } from './modules/mail/mail.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { ClientUsersModule } from './modules/client-users/client-users.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { SecurityModule } from './modules/security/ip-ban.module.js';
import { PayModule } from './modules/pay/pay.module.js';

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    // 定时任务基础设施（SchedulerRegistry + 装饰器扫描）。
    // 业务任务由 TaskModule 用 SchedulerRegistry 动态注册（cron 表达式来自配置，运行时才知道），
    // 故此处只需装好底座；forRoot() 是全局模块，SchedulerRegistry 在任意模块都可注入。
    ScheduleModule.forRoot(),
    HealthModule,
    MonitorModule,
    NoticeModule,
    // 客户端产品反馈（运营侧查看/处理 /api/client-feedbacks；提交侧在 ClientModule）
    FeedbackModule,
    AuthModule,
    MenuModule,
    UsersModule,
    RoleModule,
    DeptModule,
    DictModule,
    ConfigModule,
    DashboardModule,
    GenModule,
    FilesModule,
    ProfileModule,
    LogsModule,
    DocsModule,
    TaskModule,
    // 「短句」：客户端用户体系（/api/client/*）与题库管理（/api/sentences，含每日生成流水线）
    ClientModule,
    SentenceModule,
    // 「短句」运营后台：每日句签管理（/api/sentence-cards）与词根词典管理（/api/word-roots）
    SentenceCardsModule,
    WordRootsModule,
    // App 版本管理（/api/app-versions）与用户端下载（/api/client/app）
    AppVersionsModule,
    // 邮件设置（/api/mail-settings；发送能力在 CommonModule 的 MailService）
    MailModule,
    // AI 设置（/api/ai-settings；运行时快照与调用能力在 CommonModule）
    AiModule,
    ClientUsersModule,
    AnalyticsModule,
    SecurityModule,
    // 会员支付：微信支付回调（公开）+ 后台订单/退款/支付设置（RBAC）
    PayModule,
  ],
  providers: [
    // 守卫顺序：先鉴权（挂 req.user），再校验权限码
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    // 统一响应体包装
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    // 写操作留痕
    { provide: APP_INTERCEPTOR, useClass: OperationLogInterceptor },
    // 全局异常 → 统一错误响应
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // IP 黑名单中间件（class middleware，带 IpBanService 依赖；显式注册以保证 DI 解析）
    IpBanMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // 全局：HTTP 访问日志
    // 用 `{*path}` 而非 `*`：后者是 path-to-regexp v8 之前的写法，加了全局前缀后 Nest 会将它
    // 视作 `/api/*` 并每次启动打一条路由转换告警（自动转成 `/api/{*path}`）。
    // 显式写等价形式即可消警，实际覆盖范围不变（仅 /api 下的请求；静态资源不计入访问日志）。
    consumer.apply(HttpAccessLoggerMiddleware).forRoutes('{*path}');

    // 接口限流：注册在访问日志之后 → 被限流的请求同样留下访问记录，便于排查刷量来源
    consumer.apply(RateLimitMiddleware).forRoutes('{*path}');

    // IP 黑名单：置于限流**之前**——被封禁的 IP 连限流计数都不该再产生
    consumer.apply(IpBanMiddleware).forRoutes('{*path}');

    // 静态资源链（鉴权 → 防盗链 → 图片缩放）不在这里挂：
    // consumer.apply 的路由会被全局前缀改写成 /api/static/...，永远匹配不到真实的 /static/...，
    // 且 useStaticAssets 注册更早会直接出图。改由 app.setup.ts 按顺序显式挂到 express。
  }
}
