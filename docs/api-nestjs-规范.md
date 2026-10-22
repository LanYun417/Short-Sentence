# 后端开发规范（api/ · NestJS 12 + Prisma 7）

适用于 `api/`（NestJS 12 + TypeScript 6 纯 ESM + Prisma 7 + MySQL 8）。本文是 LYAdmin 基座约定的延续，并新增「短句」业务与 AI 能力的接入规范。

## 1. 硬性约定（违反即不通过 Code Review / 门禁）

- **纯 ESM**：相对导入一律带 `.js` 后缀（`import { config } from './config.js'`）；
- **单一配置入口**：只有 `src/common/config/config.ts` 读取 `process.env`，其它模块一律 `import { config }`；密钥（JWT、AI Key）**无默认值、缺失即拒绝启动**；
- **分层边界**：`module → controller → service`；controller 不访问 `PrismaService`，service 不读写 `Request/Response`；
- **DTO 必须可校验**：请求体/路径参数一律用 class-validator 装饰过的 DTO，无装饰器的 DTO 会被 `whitelist` 清空；
- **统一响应**：成功恒 HTTP 200，响应体 `{ code, message, data }`；错误统一抛 `AppException`，不手写 `res.json()`；
- **写操作留痕**：管理端写操作加 `@OperationLog('模块', '动作')`；
- **零运行时新增依赖**：变更 `dependencies` 必须 `npm run guard:deps -- --update` 并在评审说明。

## 2. 目录与模块骨架

```
src/
├─ common/     # 横切能力（@Global CommonModule）：config / utils / exception / http / auth / log / file / ip / redis / ai（新）
├─ modules/    # 业务模块（各含 module/controller/service/dto）
├─ prisma/     # PrismaModule / PrismaService / seed.service
├─ generated/  # Prisma Client 生成产物（勿手改）
├─ app.module.ts / app.setup.ts / main.ts
```

新增业务模块固定四文件（`*.module.ts` / `*.controller.ts` / `*.service.ts` / `dto/*.dto.ts`），并注册进 `app.module.ts` 的 `imports`，否则路由不生效。

## 3. Controller / Service 约定

- 装饰器顺序：HTTP 方法 → `@RequirePermissions(...)` → `@OperationLog(...)`；公开接口 `@Public()`；
- 返回值默认直接给业务数据，由 `ResponseInterceptor` 包装；自定义提示语用 `{ __raw: true, data, message }`；
- 路径参数必须 `@Param() params: IdParamDto`；**BigInt 边界**：出参 `Number()`、入参 `BigInt(id)`；
- 业务失败抛 `AppException.badRequest / unauthorized / forbidden / notFound / conflict`；
- 列表查询统一 `parsePagination` / `buildPageResult`，分页键固定 `{ list, total, page, pageSize }`；
- 多表写入用 `prisma.$transaction`；文件下载/CSV 用 `@Res()` + `@RawResponse()`。

## 4. 数据层（Prisma）

- schema 按域拆分到 `prisma/schema/*.prisma`（**文件名字典序即合并顺序**），首行必须 `// use prisma-next`；
- 列名统一 `@map` snake_case；主键 BigInt 对外转 Number；关联用**显式中间表**，禁隐式 m2m；
- 哨兵值：`parent_id`/`dept_id` 的 0 表示「无」，不建外键；
- `///` 是表/字段注释的唯一来源：改完执行 `npm run prisma:comments` 落库（`db push` 不带注释），CI 用 `prisma:comments:check` 查漂移；
- 表结构变更流程：改 schema → `npm run prisma:push` → `prisma:comments` → `prisma:generate` → 迁移 SQL 入库（`migrate:dev` 产物必须提交）；
- CLI 连接串只来自 `prisma.config.ts`（Prisma 7 禁止 schema 内写 url）；运行期连接由 driver adapter 注入。

## 5. AI 能力接入规范（DeepSeek / Agnes）

- **密钥只在服务端**：`NVIDIA_API_KEY`、`NVIDIA_BASE_URL`、`AGNES_API_KEY`、`AGNES_BASE_URL` 等写入 `api/.env`，经 `config.ts` 暴露；**严禁**下发到任何前端、严禁写入代码/文档/日志；
- **Provider 抽象**：AI 调用统一走 `src/common/ai/` 的适配器（`SentenceGenProvider` / `ImageGenProvider`），业务模块只依赖接口，不直接 fetch；换模型/换厂商只改适配器；
- **限流与并发**：外部 API 限流（如 NVIDIA 40 RPM、Agnes 频率限制）由**服务端信号量 + 最小间隔**控制，配合指数退避重试（默认 3 次，基期 1s，封顶 30s）；同一时刻只允许一个批次任务在跑（进程内互斥）；
- **可观测**：每次 AI 调用落 `ai_call_log`（provider/model/用量/耗时/状态/错误摘要），管理端可查；
- **失败不静默**：批量任务逐条重试与记录，全部失败要能在任务表中看到失败原因；降级策略（如跳过该题继续下一题）必须在代码注释中说明。

## 6. 定时任务与批量生成

- 定时任务经 `@nestjs/schedule`（基座已有 `ScheduleModule.forRoot()`）注册；任务定义集中在对应模块，cron 表达式由配置推导（见 `modules/task/task.registry.ts` 的 `cronOf`）；
- **每日题库生成流水线**（生题 → 生图 → 入库）：
  1. 生成题目文本（DeepSeek，批量 JSON 输出，按 `sentence_en` 唯一约束去重）；
  2. 对每道题生成**对话场景图**（Agnes），提示词描述「两人在具体场景对话」的构图；
  3. 图片经 sharp 转 webp（最大宽 1280、质量 80），调用 `FileService.save()` 入库（`bizType=sentence`，hash 秒传天然去重），回填 `sentence.image_file_id`；
  4. 全部成功后才把句子置为 `ready`（用户端只下发 ready 的题）；
- **断点续跑**：批次状态（待处理/进行中/成功/失败）落库，worker 周期性扫描未完成任务，重启不丢进度；
- 幂等：同一天重复触发不重复生成（按 `biz_date` 唯一约束）。

## 7. SSE 流式接口

- 流式输出（AI 造句/词根拆解）用 NestJS `@Sse()` 或手动 `res.write` + `text/event-stream`；**响应头必须带** `Cache-Control: no-cache`、`Connection: keep-alive`、`X-Accel-Buffering: no`（防反向代理缓冲）；
- 上游（AI）流经服务端转发，客户端只见到租户自身的 SSE；客户端断连时中止上游请求（`AbortController`），避免泄漏计费；
- 上游错误在流内以 `event: error` 下发，不透出内部堆栈。

## 8. 鉴权与多用户体系

- 管理端用户（`sys_user`）与客户端用户（`client_user`）**两套表、两套令牌**：JWT 增加 `tokenType` claim（`admin` / `client`），全局 `AuthGuard` 按类型分流挂载 `req.user` / `req.clientUser`；
- 客户端接口仅接受 client 令牌，管理端接口仅接受 admin 令牌，**禁止跨用**（防止越权）；
- 登出黑名单/强制下线按 `tokenType` 命名空间隔离键名；
- 客户端权限模型简化：数据按 userId 天然隔离，不使用 RBAC 权限码。

## 9. 测试与门禁

```bash
cd api
npm run typecheck        # tsc --noEmit
npm run lint             # oxlint --type-aware
npm run test             # vitest 单测
npm run test:e2e         # 契约 + 冒烟（需 MySQL/Redis）
npx prisma validate      # schema 合法性
```

- 新增模块至少覆盖：service 纯函数逻辑单测 + 一条「创建 → 查询」e2e 契约；
- AI Provider 用依赖注入 + fetch 桩测试，**测试不发真实请求**；
- 提交前按 `docs/git-提交规范.md` 第 7 节全绿。
