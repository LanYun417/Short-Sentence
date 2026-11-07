/**
 * 环境配置中心。
 * 统一读取项目根 `.env`，导出强类型配置对象，供全局引用。
 * 模块职责：唯一的环境变量读取入口，禁止在其它模块直接读取 process.env。
 * 安全校验一律 fail-fast：缺失必填项即抛错，服务拒绝启动。
 */
import path from 'node:path';
import { ROOT_DIR, toBoolean, toNumber } from './env-parse.js';
import { dbConfig } from './db-config.js';
import { imageGenConfig } from './image-gen-config.js';

/**
 * 项目根目录（定义在 `env-parse.ts`，本文件仅转发导出以保持对外 API 稳定）。
 * `.env` 的加载也发生在 `env-parse.ts` 模块顶层——务必早于任何读取 process.env 的配置模块求值，
 * 否则 `dbConfig` 会在 `.env` 解析前被算成空密码（本地原生启动必现）。
 */
export { ROOT_DIR } from './env-parse.js';

/** 日志根目录（绝对路径）。 */
/** 日志根目录（绝对路径）。 */
const LOG_DIR = path.resolve(ROOT_DIR, process.env.LOG_DIR ?? 'logs');

/**
 * 口令长度边界：先夹下限（6~32），再让上限不小于下限——
 * 若只写 `max(env, 8)`，把 PASSWORD_MIN_LENGTH 配成 32 而上限用默认 20 时，
 * 会出现「min > max」导致任何口令都校验不过。
 */
const PASSWORD_MIN_LENGTH = Math.min(Math.max(toNumber(process.env.PASSWORD_MIN_LENGTH, 8), 6), 32);
const PASSWORD_MAX_LENGTH = Math.min(Math.max(toNumber(process.env.PASSWORD_MAX_LENGTH, 20), PASSWORD_MIN_LENGTH), 64);

/**
 * 解析防盗链 Referer 白名单：接受逗号分隔的 origin（`http://a.com`）或裸 host（`a.com`），
 * 统一归一为小写的 host（含端口）。未配置时返回空数组（仅放行「无 Referer」与「同源」）。
 */
function parseRefererHosts(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      try {
        return new URL(item).host.toLowerCase();
      } catch {
        return item.toLowerCase();
      }
    });
}

/** 保留天数合理性上界提示阈值（超过仅告警，不拒绝）。 */
const RETENTION_DAYS_MAX_HINT = 3650;

/**
 * 解析「日志保留天数」：必须为**正整数**。
 *
 * 安全背景（下界保护）：`retention = 0` 会让 `cutoff = now - 0 = now` → 删除**整张日志表**；
 * 一个环境变量的笔误即可造成数据事故。因此对 `≤ 0` / 非整数 / 非数字 / 空串一律**拒绝该值、
 * 回退到默认值**并打印明确告警。同时对上界做合理性提示。
 */
function parseRetentionDays(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    console.warn(`[LogRetention] ${name}=${raw} 非法（保留天数须为正整数），已回退默认 ${fallback} 天`);
    return fallback;
  }
  if (parsed > RETENTION_DAYS_MAX_HINT) {
    console.warn(
      `[LogRetention] ${name}=${parsed} 超出常见合理范围（> ${RETENTION_DAYS_MAX_HINT} 天），请确认是否有意为之`,
    );
  }
  return parsed;
}

/** 生成 32 字节随机密钥的命令（用于必填项报错信息与 .env.example 说明）。 */
const SECRET_GEN_HINT = `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`;

/** 两个 JWT 密钥：均为必填，且必须互不相同（否则 refreshToken 可直接当 accessToken 使用）。 */
const JWT_ACCESS_SECRET = requireEnv('JWT_ACCESS_SECRET', `请执行以下命令生成后写入 .env：${SECRET_GEN_HINT}`);
const JWT_REFRESH_SECRET = requireEnv('JWT_REFRESH_SECRET', `请执行以下命令生成后写入 .env：${SECRET_GEN_HINT}`);
if (JWT_ACCESS_SECRET === JWT_REFRESH_SECRET) {
  throw new Error('[Config] JWT_ACCESS_SECRET 与 JWT_REFRESH_SECRET 必须不同，服务拒绝启动。');
}

/**
 * 读取必填的环境变量；缺失或为空时抛出清晰错误并终止启动（fail-fast）。
 *
 * 安全背景：JWT 密钥绝不允许回退默认值——硬编码默认值等于把签名密钥公开给全网，
 * 任何人均可伪造 Token。缺失即抛错，配合 Nest 启动流程直接退出。
 */
function requireEnv(name: string, hint?: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    const lines = [`[Config] 缺少必填环境变量 ${name}，服务拒绝启动。`];
    if (hint) {
      lines.push(`  提示：${hint}`);
    }
    throw new Error(lines.join('\n'));
  }
  return value;
}

/** 全局配置对象。 */
export const config = {
  /** 运行环境 */
  env: process.env.NODE_ENV ?? 'development',
  /** 服务端口 */
  port: toNumber(process.env.PORT, 3000),
  /**
   * 反向代理信任跳数。默认 0 = 不信任 `X-Forwarded-For`，仅当服务确实部署在
   * 反向代理之后才设置。默认不启用可避免攻击者伪造来源 IP、绕过频率限制并污染审计日志。
   */
  trustProxy: toNumber(process.env.TRUST_PROXY, 0),
  /** 项目根目录（绝对路径） */
  rootDir: ROOT_DIR,
  /** 数据库配置 */
  /**
   * 数据库连接配置。单独放在 `db-config.ts`，好让只用到数据库的 CLI 脚本
   * （`prisma:comments` 等）不必 import 本文件、从而不被下面的 JWT fail-fast 拦住。
   */
  db: dbConfig,
  /** JWT 配置（密钥必填：缺失、为空或两者相同均抛错拒绝启动） */
  jwt: {
    accessSecret: JWT_ACCESS_SECRET,
    refreshSecret: JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '2h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  /** 登录图形验证码 */
  captcha: {
    enabled: toBoolean(process.env.CAPTCHA_ENABLED, true),
    /** 验证码有效期（ms，默认 5 分钟） */
    ttlMs: toNumber(process.env.CAPTCHA_TTL_MS, 5 * 60 * 1000),
    /** 验证码字符数（默认 4） */
    length: toNumber(process.env.CAPTCHA_LENGTH, 4),
  },
  /** 文件上传配置 */
  upload: {
    /** 上传根目录（绝对路径，磁盘上的真实物理存储路径） */
    dir: path.resolve(ROOT_DIR, process.env.UPLOAD_DIR ?? 'uploads'),
    /** 相对项目根的存储目录名，用于拼接 DB 中记录的 filePath 并解析磁盘文件。 */
    dirName: process.env.UPLOAD_DIR ?? 'uploads',
    /**
     * 对外静态资源路由前缀（URL 上的挂载路径），默认 `static`。
     * 物理存储目录仍为 dirName(uploads)，二者刻意分离——存储路径不变，仅路由改名。
     */
    route: process.env.UPLOAD_ROUTE ?? 'static',
    /**
     * 图片缩放缓存目录（绝对路径），默认 <root>/cache/images。
     * 必须位于静态服务根目录（upload.dir）之外，避免缓存文件被公开访问。
     */
    cacheDir: path.resolve(ROOT_DIR, process.env.UPLOAD_CACHE_DIR ?? 'cache/images'),
    /** 缩略图缓存保留天数（默认 30；0 表示不按时间清理） */
    cacheTtlDays: toNumber(process.env.UPLOAD_CACHE_TTL_DAYS, 30),
    /** 缩略图缓存体积上限（MB，默认 512；超出按最久未访问淘汰；0 表示不限） */
    cacheMaxMb: toNumber(process.env.UPLOAD_CACHE_MAX_MB, 512),
    /** 是否启用缓存清理任务（false 为紧急刹车；删除上传文件时的联动清理不受此开关影响） */
    cacheSweepEnabled: toBoolean(process.env.UPLOAD_CACHE_SWEEP_ENABLED, true),
    /** 缓存清理间隔（小时，默认 6） */
    cacheSweepIntervalHours: toNumber(process.env.UPLOAD_CACHE_SWEEP_INTERVAL_HOURS, 6),
    /** 单文件大小上限（字节） */
    maxSize: toNumber(process.env.UPLOAD_MAX_SIZE, 10 * 1024 * 1024),
    /** 单次最多文件数 */
    maxCount: toNumber(process.env.UPLOAD_MAX_COUNT, 10),
    /**
     * 单个用户的累计上传配额（MB，默认 512；0 表示不限）。
     * 只统计**实际落盘**的字节：命中秒传（内容已存在）的文件不计入。
     */
    userQuotaMb: Math.max(toNumber(process.env.UPLOAD_USER_QUOTA_MB, 512), 0),
    /** 防盗链 Referer 白名单（host 列表，已归一为小写）。 */
    allowedReferers: parseRefererHosts(process.env.UPLOAD_ALLOWED_REFERERS),
  },
  /** 前端构建产物（同源部署时由后端直接托管） */
  web: {
    /**
     * 前端产物目录（绝对路径）。默认取项目根下的 `web`；
     * 可用 WEB_DIST_DIR 覆盖。目录不存在时后端跳过托管。
     */
    distDir: path.resolve(ROOT_DIR, process.env.WEB_DIST_DIR ?? 'web'),
  },
  /**
   * Redis 配置（登出令牌黑名单 / 登录频率限制 / 验证码的共享存储）。
   * 未配置 REDIS_HOST 时视为「不启用」，相关增强整体降级关闭。
   */
  redis: {
    host: process.env.REDIS_HOST ?? '',
    port: toNumber(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD ?? '',
    db: toNumber(process.env.REDIS_DB, 0),
  },
  /**
   * 跨域允许来源（逗号分隔）。默认覆盖开发期两个前端：
   * admin `:5173`（Vite）与 client `:3001`（Nuxt，见 client/nuxt.config.ts）。
   */
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:3001',
  /** ip2region 离线 IP 库配置（IP 归属地解析；数据文件缺失时自动降级关闭，不影响启动） */
  ip2region: {
    /** xdb 数据文件路径（绝对路径），默认 <root>/data/ip2region_v4.xdb */
    dbPath: path.resolve(ROOT_DIR, process.env.IP2REGION_DB_PATH ?? 'data/ip2region_v4.xdb'),
  },
  /** 日志目录（绝对路径） */
  logDir: LOG_DIR,
  /** 日志系统配置（按天分文件 + 定时归档） */
  log: {
    dir: LOG_DIR,
    /** 归档根目录（绝对路径），默认 <logDir>/archive */
    archiveDir: path.resolve(
      ROOT_DIR,
      process.env.LOG_ARCHIVE_DIR ?? path.join(process.env.LOG_DIR ?? 'logs', 'archive'),
    ),
    /** 每日归档时刻（本地时区） */
    archiveHour: toNumber(process.env.LOG_ARCHIVE_HOUR, 0),
    archiveMinute: toNumber(process.env.LOG_ARCHIVE_MINUTE, 5),
    /** 归档成功后是否保留源 .log（false=删除，默认 false） */
    keepSourceAfterArchive: toBoolean(process.env.LOG_ARCHIVE_KEEP_SOURCE, false),
    /** 慢 SQL 阈值（ms，默认 200） */
    slowSqlMs: toNumber(process.env.LOG_SLOW_SQL_MS, 200),
    /** 可选的 tar 可执行文件路径覆盖（跨平台/自定义环境用） */
    tarBin: process.env.TAR_BIN ?? 'tar',
    /** HTTP 访问日志保留天数，默认 7（磁盘增长主源，取证价值随时间快速衰减） */
    httpLogRetentionDays: parseRetentionDays('LOG_HTTP_RETENTION_DAYS', 7),
    /** 操作日志保留天数，默认 180（审计证据，需长期保留） */
    operationLogRetentionDays: parseRetentionDays('LOG_OPERATION_RETENTION_DAYS', 180),
    /** 登录日志保留天数，默认 180（折中） */
    loginLogRetentionDays: parseRetentionDays('LOG_LOGIN_RETENTION_DAYS', 180),
    /**
     * AI 调用日志保留天数，默认 30。
     * 它是增长最快的一张表（每次生题/生图/造句都写一行，日均数百行），但价值集中在「近期」：
     * 30 天既够覆盖两个 14 天用量观察窗口（给每日额度定档用），也够回溯一轮生题的失败原因；
     * 再长的历史对运营没有实际意义。
     */
    aiLogRetentionDays: parseRetentionDays('LOG_AI_RETENTION_DAYS', 30),
    /** 保留清理时刻（本地时间，默认 00:10，刻意避开 00:05 归档以避免同一时刻抢 IO） */
    retentionHour: toNumber(process.env.LOG_RETENTION_HOUR, 0),
    retentionMinute: toNumber(process.env.LOG_RETENTION_MINUTE, 10),
    /** 是否启用日志保留清理（false 为「紧急刹车」） */
    retentionEnabled: toBoolean(process.env.LOG_RETENTION_ENABLED, true),
    /** 是否输出 HTTP 日志 count 缓存的命中/未命中调试日志（默认 false） */
    httpCountCacheDebug: toBoolean(process.env.LOG_HTTP_COUNT_CACHE_DEBUG, false),
  },
  /** 安全响应头（零依赖实现，见 common/http/security-headers.ts） */
  security: {
    /**
     * Content-Security-Policy。默认空 = **不下发**：本项目前端是 Vue SPA，
     * Element Plus / Tailwind / ECharts 会注入内联样式与 canvas，
     * 过严的 CSP 会直接白屏，必须按实际部署显式配置（如
     * `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'`）。
     */
    csp: process.env.CSP_POLICY ?? '',
    /**
     * 是否下发 HSTS。仅在部署于 HTTPS 反向代理之后才有意义，
     * 故默认跟随 NODE_ENV=production，可由 SECURITY_HSTS 覆盖。
     */
    hsts: toBoolean(process.env.SECURITY_HSTS, process.env.NODE_ENV === 'production'),
    /**
     * 同一账号连续登录失败多少次后锁定（默认 5）。
     * 与 rateLimit / LoginRateLimiterService 的**按 IP**限流互补：
     * 那两个挡「一个 IP 到处试」，这里挡「很多 IP 盯同一个账号」。
     */
    accountFailLimit: Math.max(1, toNumber(process.env.LOGIN_ACCOUNT_FAIL_LIMIT, 5)),
    /** 账号锁定时长（分钟，默认 15） */
    accountLockMinutes: Math.max(1, toNumber(process.env.LOGIN_ACCOUNT_LOCK_MINUTES, 15)),
  },
  /** 接口限流（按 IP + 按登录用户双维度固定窗口；Redis 不可用时自动降级放行） */
  rateLimit: {
    enabled: toBoolean(process.env.RATE_LIMIT_ENABLED, true),
    /** 窗口长度（ms），默认 1 分钟 */
    windowMs: toNumber(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    /** 单窗口内单 IP 的默认上限（登录/验证码/文档等敏感接口另有收紧值，见中间件） */
    max: toNumber(process.env.RATE_LIMIT_MAX, 300),
    /**
     * 单窗口内**单个登录用户**的默认上限。
     *
     * 为什么在按 IP 之外再加一维：IP 维度有两个天然缺口——
     * 1) 攻击者手上有一批代理 IP 时，单账号可以无限刷（IP 每次都换，计数打不上去）；
     * 2) 反过来，公司/学校出口 IP 下的多个正常用户共享同一份额度，容易被互相拖累。
     * 加上用户维度后「一号一额度」，跨 IP 刷量同样被封；取值比 IP 更小，
     * 因为单个正常用户的每分钟请求量远低于一个出口 IP 下的所有人之和。
     */
    userMax: toNumber(process.env.RATE_LIMIT_USER_MAX, 150),
  },
  /**
   * IP 黑名单（防「单 IP 批量注册」与「登录爆破」的兜底闸门）。
   *
   * 设计取舍（与安全相关的关键决策）：
   * - **默认关闭**（`enabled=false`）：IP 维度误伤风险高（公司 / 学校 / 小区出口 NAT 共享 IP
   *   下，正常用户共享同一地址），一旦默认开启可能误封一片人。必须由运维**显式开启**，
   *   且阈值留足余量。
   * - **降级放行（fail-open）**：Redis / 数据库异常时一律视为「未封禁」，绝不因安全增强故障
   *   而导致全站不可访问——与 rate-limit / 令牌黑名单的降级口径一致。
   * - **自动封禁只作为最后手段**：先有邮箱验证码 + 双维度限流 + 账号锁定三道防线，本功能只在
   *   「单 IP 单日注册次数」或「单 IP 短时登录失败次数」明显越界时才兜底封 IP。
   * - 阈值全部可配置，便于按实际流量调参；自动封禁带到期时间，到期自动解封，避免永久误伤。
   */
  ipBan: {
    /** 总开关：默认关闭（绝不默认开启，避免误封正常用户）。 */
    enabled: toBoolean(process.env.IP_BAN_ENABLED, false),
    /**
     * 单 IP 自然日内「注册接口调用次数」上限（含验证码失败；正常用户只注册 1 次）。
     * 超过即自动封禁该 IP（覆盖「一个 IP 一天注册多个用户」与「脚本狂刷注册接口」两类场景）。
     */
    dailyRegisterLimit: Math.max(1, toNumber(process.env.IP_BAN_DAILY_REGISTER_LIMIT, 30)),
    /** 自动封禁时长（小时，默认 24）；0 表示永久（仅建议调试/应急临时使用）。 */
    autoBanHours: Math.max(0, toNumber(process.env.IP_BAN_AUTO_BAN_HOURS, 24)),
    /** 单 IP 在攻击窗口内「登录失败次数」上限（检测爆破 / 账号枚举）。 */
    loginFailLimit: Math.max(1, toNumber(process.env.IP_BAN_LOGIN_FAIL_LIMIT, 50)),
    /** 单 IP 在攻击窗口内「验证码失败次数」上限（检测验证码绕过尝试）。 */
    captchaFailLimit: Math.max(1, toNumber(process.env.IP_BAN_CAPTCHA_FAIL_LIMIT, 50)),
    /** 攻击计数滑动窗口（ms，默认 60s，与限流窗口一致）。 */
    attackWindowMs: Math.max(1000, toNumber(process.env.IP_BAN_ATTACK_WINDOW_MS, 60_000)),
  },
  /**
   * 口令策略（新增用户 / 重置密码 / 自助改密共用，见 common/auth/password-policy.ts）。
   * 只约束**新设置**的口令，不影响存量账号登录。
   */
  password: {
    /** 最小长度：默认 8，夹在 6~32 之间（低于 6 无意义，高于 32 会显著拖慢 bcrypt） */
    minLength: PASSWORD_MIN_LENGTH,
    /** 最大长度：默认 20，夹在最小长度~64 之间（bcrypt 只取前 72 字节，过长无收益） */
    maxLength: PASSWORD_MAX_LENGTH,
    /** 是否要求「字母 + 数字」组合（默认要求；纯数字弱口令是最常见的撞库起点） */
    requireComplexity: toBoolean(process.env.PASSWORD_REQUIRE_COMPLEXITY, true),
  },
  /** CSV 导出（流式写出；超上限先拒后导，避免生成半截文件） */
  export: {
    /** 单次导出行数上限（默认 5 万，0 表示不限制——不建议，超大导出会长时间占用连接） */
    maxRows: toNumber(process.env.EXPORT_MAX_ROWS, 50_000),
    /** 分批取数大小（默认 1000，兼顾查询次数与单批内存） */
    batchSize: Math.min(Math.max(toNumber(process.env.EXPORT_BATCH_SIZE, 1000), 100), 5000),
  },
  /**
   * AI 能力（「短句」题库生成 + 用户端造句/词根）。
   * 密钥缺失时相关功能整体禁用（接口返回明确错误），**不阻断服务启动**——
   * 与 JWT 的 fail-fast 区别：JWT 缺失等于鉴权体系不可用，AI 缺失只是增值功能不可用。
   */
  ai: {
    agnes: {
      /** Agnes AI 入口（生文与生图共用同一 Base URL 与密钥） */
      baseUrl: process.env.AI_AGNES_BASE_URL ?? 'https://api.agnes-ai.cn/v1',
      apiKey: process.env.AI_AGNES_API_KEY ?? '',
      /** 图像模型（题目配图 / 句签生图） */
      imageModel: process.env.AI_AGNES_IMAGE_MODEL ?? process.env.AI_AGNES_MODEL ?? 'agnes-image-2.5-flash',
      /** 文本模型（生题 / 造句 / 词根解析 / 句签文案；OpenAI 兼容 chat/completions） */
      textModel: process.env.AI_AGNES_TEXT_MODEL ?? 'agnes-2.5-flash',
    },
    /** 生题并发上限（Agnes 限流未知，保守取 2） */
    textConcurrency: Math.max(1, toNumber(process.env.AI_TEXT_CONCURRENCY, 2)),
    /** 生图并发上限（Agnes 限流未知，保守取 3） */
    imageConcurrency: Math.max(1, toNumber(process.env.AI_IMAGE_CONCURRENCY, 3)),
    /** 瞬时错误最大重试次数 */
    maxAttempts: Math.max(1, toNumber(process.env.AI_MAX_ATTEMPTS, 3)),
    /** 单次 AI 请求超时（生图可能数十秒，官方建议 60s~360s） */
    requestTimeoutMs: Math.max(1000, toNumber(process.env.AI_REQUEST_TIMEOUT_MS, 180_000)),
    /**
     * 单次生文最大输出 token。
     * 不设（或设过小）时，agnes-2.5-flash 用默认上限，20 题一批约 5000+ token，
     * 输出被截断 → JSON 不完整 → 整批「模型输出不是合法 JSON」被丢弃（已实测命中）。
     * 实测 20 题一批约需 8000~16000 token，默认给 16000 留足余量；不同模型上限不同，
     * 若仍截断可适当调大，或调小 TEXT_CHUNK。
     */
    maxOutputTokens: Math.max(1, toNumber(process.env.AI_MAX_OUTPUT_TOKENS, 16_000)),
    /**
     * 客户端用户每日免费 AI 次数（按自然日、Asia/Shanghai 计）。
     * 实测单次约 450 token，50 次≈2.2 万 token/人/天（成本可忽略）；
     * 先按 50 上线观察真实用量分布，后续按会员等级在 AiQuotaService.resolveLimit 里分档。
     */
    dailyQuota: Math.max(1, toNumber(process.env.AI_DAILY_QUOTA, 50)),
    /**
     * 全局每日 AI 预算（跨所有调用方：批次生题/生图、客户端造句/词根、句签）。
     * 0 = 不限制（默认）。任一维度达到上限即闸断所有 AI 调用入口。
     *
     * 为什么需要：客户端已有「每人每日次数」额度，但**没有全局天花板**——
     * 被多账号刷或批量生题失控时成本无上限；这里是最后一道成本闸门。
     * 为什么用「次数」为主口径：上游按 token/图片的计费口径尚未固化，次数最直观可控；
     * token 维度作为辅助上限（防单次超长输出把成本拉爆）。
     */
    dailyCallBudget: Math.max(0, toNumber(process.env.AI_DAILY_CALL_BUDGET, 0)),
    dailyTokenBudget: Math.max(0, toNumber(process.env.AI_DAILY_TOKEN_BUDGET, 0)),
  },
  /**
   * 成长体系（XP / 等级 / 成就）防刷配置。
   */
  gamify: {
    /**
     * 每日经验上限（按自然日、Asia/Shanghai 计；0 表示不限制）。
     *
     * 为什么需要硬上限：经验的幂等键是「作答记录 id」，而作答记录每次都新生成，
     * 所以脚本反复提交同一题（尤其是「答错→当天到期→可再次作答」这条回路）
     * 仍能持续产经验。给每日总量封顶后，刷量与正常使用在总量上被区分开：
     * 正常用户一天 20 句（含拼词折扣、收藏、达标奖励、成就）大约 200~300 点，
     * 取 600 留足余量，同时把刷量收益压到「一天 600」这个可忽略的量级。
     */
    dailyXpCap: Math.max(0, toNumber(process.env.GAMIFY_DAILY_XP_CAP, 600)),
  },
  /** 「短句」业务配置 */
  sentence: {
    /** 每日批量生成目标题数 */
    dailyTarget: Math.max(1, toNumber(process.env.SENTENCE_DAILY_TARGET, 300)),
    /** 用户每日目标题数（打卡完成线） */
    dailyGoal: Math.max(1, toNumber(process.env.SENTENCE_DAILY_GOAL, 20)),
    /** 是否启用每日定时生成 */
    cronEnabled: toBoolean(process.env.SENTENCE_CRON_ENABLED, true),
    /**
     * 定时生成时刻（本地时间，默认 00:00）。
     * 与 00:05 日志归档、00:10 保留清理同处夜间时段：三条任务写的是不同的表，
     * 后两者是秒级操作，不会与生成流水线抢资源。
     */
    cronHour: toNumber(process.env.SENTENCE_CRON_HOUR, 0),
    cronMinute: toNumber(process.env.SENTENCE_CRON_MINUTE, 0),
    /** 配图尺寸档位、宽高比、入库缩放（定义在 image-gen-config，CLI 脚本共用同一份） */
    imageSize: imageGenConfig.imageSize,
    imageRatio: imageGenConfig.imageRatio,
    imageMaxWidth: imageGenConfig.imageMaxWidth,
    imageQuality: imageGenConfig.imageQuality,
    /** 抽题时未做过的新题占比（其余按比例从复习池混入） */
    newRatio: Math.min(1, Math.max(0, toNumber(process.env.SENTENCE_NEW_RATIO, 0.8))),
    /** 防重窗口：最近 N 次答过的题不再出现（0 = 不启用） */
    antiRepeatWindow: Math.max(0, toNumber(process.env.SENTENCE_ANTI_REPEAT_WINDOW, 10)),
    /** 节日题库：命中节日当天的目标题数（普通日仍按 dailyTarget） */
    festivalTarget: Math.max(1, toNumber(process.env.SENTENCE_FESTIVAL_TARGET, 100)),
    /** 是否启用节日题库（关闭后节日当天按普通批次生成，不做节日标记） */
    festivalEnabled: toBoolean(process.env.SENTENCE_FESTIVAL_ENABLED, true),
    /** 答题历史保留天数（0 = 不清理；默认 30 天，不论对错） */
    recordRetentionDays: Math.max(0, toNumber(process.env.SENTENCE_RECORD_RETENTION_DAYS, 30)),
    /** 是否启用答题历史清理（关掉只停物理删除，历史列表仍按保留天数过滤） */
    recordRetentionEnabled: toBoolean(process.env.SENTENCE_RECORD_RETENTION_ENABLED, true),
    /**
     * 「累计答对」降权阶梯步长：每累计答对 N 次降低一档抽中权重（默认 5 次一档）。
     * 累计口径（答对 +1，答错不清零），在抽题时由 sentence_record 实时聚合，不另建表。
     */
    masteryStep: Math.max(1, toNumber(process.env.SENTENCE_MASTERY_STEP, 5)),
    /** 每档权重衰减因子（0~1，默认 0.5 = 每档概率减半） */
    masteryStepFactor: Math.min(1, Math.max(0, toNumber(process.env.SENTENCE_MASTERY_STEP_FACTOR, 0.5))),
    /** 累计答对达到该次数后，开始 30 天内不再被抽到（默认 20 次） */
    masterySuppressAt: Math.max(1, toNumber(process.env.SENTENCE_MASTERY_SUPPRESS_AT, 20)),
    /** 累计答对达到 masterySuppressAt 后的禁抽天数（默认 30 天） */
    masterySuppressDays: Math.max(1, toNumber(process.env.SENTENCE_MASTERY_SUPPRESS_DAYS, 30)),
  },
} as const;

export type AppConfig = typeof config;
