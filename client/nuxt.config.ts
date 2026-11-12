// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite';

/**
 * 开发服务端口（默认 3001）。
 *
 * 为什么不是 Nuxt 默认的 3000：3000 是后端 NestJS 的端口（Dockerfile / compose / nginx
 * 均以此为契约），两端同占 3000 会出现「谁先起谁赢」，且 devProxy 会把 /api 代理回自己，
 * 形成自环。默认端口只用 NUXT_DEV_PORT 覆盖，不要改回 3000。
 */
const DEV_PORT = Number(process.env.NUXT_DEV_PORT ?? 3001);

/** 后端地址（devProxy 目标），与 api/.env 的 PORT 保持一致。 */
const API_TARGET = process.env.NUXT_API_TARGET || 'http://localhost:3000';

/**
 * 站点名。@nuxtjs/seo 的 %siteName / og:site_name 都取自这里——
 * 不配它占位符会原样漏进 <title>（曾出现「短句 · 视觉场景英语闪卡 | %siteName」）。
 */
const SITE_NAME = '短句';

/** 站点描述（meta description 与分享卡片共用）。 */
const SITE_DESCRIPTION = '每天 20 句，看图学英语。场景闪卡 + 间隔重复 + AI 拓展，用完即走。';

/**
 * 站点绝对地址（canonical / sitemap 用）。
 * 刻意不给默认值：不传时由运行期从请求头推断（生产环境即真实域名），
 * 避免把开发地址或臆测域名写进 canonical；需要固定域名时在部署环境注入。
 */
const SITE_URL = process.env.NUXT_PUBLIC_SITE_URL || '';

export default defineNuxtConfig({
  // 保持 SSR（默认开启）。登录态不能只存 localStorage：SSR 时服务端读不到 localStorage，
  // 路由中间件会把已登录用户误判为未登录、每次刷新被 302 回登录页。
  // 因此令牌额外写一份 Cookie（见 utils/auth-cookie.ts），服务端守卫以 Cookie 为准；
  // localStorage 仍保留，供客户端 API 请求注入 Authorization 头。
  ssr: true,

  // 开发服务：绑定 0.0.0.0（不是 localhost），让同一局域网的手机/平板能直接访问
  // `http://<本机内网 IP>:3001` 做真机联调。
  // 固定端口 + strictPort（见下方 vite.server），端口被占直接报错而非静默漂移，
  // 否则 CORS / 防盗链白名单（按端口配置）会在换端口后失效。
  devServer: {
    host: '0.0.0.0',
    port: DEV_PORT,
  },

  modules: [
    '@nuxt/icon/module',
    '@nuxt/fonts',
    '@nuxt/image',
    // UI 组件层统一走 @nuxt/ui（Reka UI 已移除：它只被注册过、代码中零引用，
    // 且与 @nuxt/ui 的组件体系重复）
    '@nuxt/ui',
    '@pinia/nuxt',
    '@nuxtjs/color-mode',
    '@vueuse/nuxt/module',
    '@nuxtjs/i18n',
    '@nuxtjs/sitemap',
    '@nuxtjs/robots',
    '@nuxtjs/seo',
  ],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // 图标：实测 **SSR 并不内联 SVG**——服务端只输出 <span class="iconify"> 占位，
  // 最终图样（含首屏图标，靠客户端水合替换）**全部来自客户端静态包**。
  // 该包由 clientBundle.scan 构建期扫描源码生成，且**运行期没有兜底端点**：
  // `/api/_nuxt_icon/...` 被 devProxy 转给 NestJS（404），`/_nuxt_icon/...` Nitro 未注册（404），
  // 外网 api.iconify.design 在国内不可达——因此**不在包里的图标名会彻底渲染空白**
  // （曾反复出现「修改密码按钮图标不显示」）。
  // - serverBundle: 'local'：SSR 侧持有本地 lucide 集合（判定/能力用），但输出仍是占位；
  // - clientBundle.scan：构建期扫描源码，把用到的图标打进客户端静态包。
  // ⚠️ 坑 1：**scan 默认只扫 vue/jsx/tsx/md/mdc/mdx，纯 .ts 文件不扫**——图标名只出现在
  // composable / 常量表（如 useQuestionSession 的 ANSWER_MODES/DIFFICULTIES）里时不会进包，
  // 运行时整块空白（2026-11-10 的 sprout/keyboard/blocks 三个图标即此坑：难度与作答方式
  // 选择器的图标全裂）。这里把 `ts` 显式加进 globInclude 根治。
  // ⚠️ 坑 2：**新加的图标名必须重新构建 / 重启 dev server 才会进包**——dev server 运行期
  // 改源码不会重新扫描该包。所以**运行期才渲染的图标**（如滚动后才出现的按钮）要优先选
  // 已在包内的图标（Nuxt UI 内置那批恒在包内），否则 dev 期直接空白。
  // ⚠️ 坑 3（保险）：`icons` 白名单强制进包，与 glob 双保险。
  icon: {
    serverBundle: 'local',
    clientBundle: {
      scan: {
        globInclude: ['**/*.{vue,jsx,tsx,md,mdc,mdx,ts}'],
      },
      // 兜底白名单：历史上只在 .ts 常量表里出现过的图标（正常已被 globInclude 覆盖，
      // 这里显式钉住，防止将来改动扫描配置时回归）。
      icons: ['lucide:sprout', 'lucide:keyboard', 'lucide:blocks'],
    },
  },

  // Tailwind v4 走 vite 插件（与 admin 工程一致，避免 postcss 模式）
  vite: {
    plugins: [tailwindcss()],
    // 端口被占时立即失败：devProxy 与后端 CORS 白名单都按端口硬编码，
    // Nuxt 默认的「端口被占就 +1」会让联调静默指向错误来源。
    server: { strictPort: true },
  },
  // Tailwind v4 入口（暗色变体由 color-mode 的 .dark class 驱动）
  css: ['~/assets/css/main.css'],

  // 运行时配置：API 基地址经 NUXT_PUBLIC_API_BASE_URL 注入（默认 /api 同源走代理）
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || '/api',
    },
    // 服务端（SSR）访问 API 的内网地址：生产里相对路径 /api 由网关转发，Node 内部 $fetch 走不到，
    // 必须直连 API。部署时按拓扑注入 NUXT_API_INTERNAL_URL（如 http://api:3000/api）。
    apiInternalUrl: process.env.NUXT_API_INTERNAL_URL || 'http://127.0.0.1:3000/api',
  },

  // 开发期把后端接口与静态资源代理到 NestJS（生产同源部署无需此配置）
  // - /api   ：业务接口
  // - /static：题目配图与用户头像（后端返回的 fileUrl 是 `/static/...` 相对路径，
  //            不代理会打到 Nuxt 自身而 404，海报 html2canvas 也会因图裂失败）
  // 注意：nitro devProxy 会**剥掉匹配的前缀**再拼到 target 上，因此 target 必须补回该前缀，
  // 否则 /api/health/live 会被转成后端 /health/live 直接 404（vite 的 proxy 无此行为）。
  nitro: {
    devProxy: {
      '/api': {
        target: `${API_TARGET}/api`,
        changeOrigin: true,
      },
      '/static': {
        target: `${API_TARGET}/static`,
        changeOrigin: true,
      },
    },
  },

  // color-mode：class 策略（Tailwind 的 dark: 变体配合 .dark）
  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'light',
  },

  // i18n：短期只做中文；保留框架，文案 key 集中在 locales/
  i18n: {
    locales: [{ code: 'zh', language: 'zh-CN', name: '中文' }],
    defaultLocale: 'zh',
    strategy: 'no_prefix',
  },

  // ===== SEO =====
  // 站点信息：@nuxtjs/seo / sitemap / robots 的共同事实来源。
  site: {
    ...(SITE_URL ? { url: SITE_URL } : {}),
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    defaultLocale: 'zh-CN',
    indexable: true,
  },

  // nuxt-seo-utils 的配置（@nuxtjs/seo 把 seo-utils 子模块的 configKey 映射为 "seo"）。
  seo: {
    // 关掉 twitter:* 标签的自动派生。
    // unhead v3 已把 twitter:card / twitter:image 等判为弃用，会在浏览器控制台刷
    // "[unhead] twitter:card is deprecated. Use Open Graph metadata instead."。
    // 社交平台现在读 Open Graph 即可（og:title / og:description / og:image），
    // 保留一份 twitter 副本只会制造噪音告警，没有额外收益。
    automaticTwitterTags: false,
  },

  // og-image：项目用的是**静态**分享图（public/og-image.png，见 app.vue 的 og:image），
  // 不需要动态生成 OG 图。@nuxtjs/seo 会连带装 nuxt-og-image，它找不到渲染器（takumi/satori/
  // chromium）时会持续在启动日志里警告 "No OG image renderer is installed"。
  // 置 false 即不装载该子模块，消除噪声（不影响手写的 og:image）。
  ogImage: false,

  // robots：私有页（需登录）一律禁止抓取——它们对爬虫没有内容，进索引只会稀释站点质量。
  // 「是否收录」仍由环境决定：开发环境自动全站 Disallow，生产才放开。
  // disallowNonIndexableRoutes 关掉：它会给每个 routeRule 非索引路由生成一个「空 Disallow」组，
  // 而同名 User-agent 的空组有被解读为「允许全部」的风险，反而削弱上面的规则。
  robots: {
    disallowNonIndexableRoutes: false,
    disallow: [
      '/features',
      '/ai',
      '/favorites',
      '/review',
      '/profile',
      '/notices',
      '/feedback',
      '/leaderboard',
      '/stages',
      '/stages/*',
      '/chains',
      '/team',
      '/achievements',
    ],
  },

  // sitemap：只保留公开入口。模块会自动发现全部路由，不排除就会把私有页也写进去。
  sitemap: {
    exclude: [
      '/features',
      '/ai',
      '/favorites',
      '/review',
      '/profile',
      '/notices',
      '/feedback',
      '/leaderboard',
      '/stages',
      '/stages/*',
      '/chains',
      '/team',
      '/achievements',
    ],
    urls: () => [
      { loc: '/', changefreq: 'daily', priority: 1 },
      { loc: '/login', changefreq: 'monthly', priority: 0.3 },
      { loc: '/register', changefreq: 'monthly', priority: 0.5 },
    ],
  },

  app: {
    // 页面切换动画（CSS 类见 assets/css/main.css 的 .page-* 定义）
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      // 默认标题（无页面级标题时使用）；页面只写短标题，品牌后缀由 titleTemplate 统一拼
      title: '视觉场景英语闪卡',
      titleTemplate: '%s · 短句',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        // 浏览器 / 系统 UI 主题色（跟随亮暗）
        { name: 'theme-color', content: '#ffffff', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#0f172a', media: '(prefers-color-scheme: dark)' },
      ],
      // 注：文档语言（htmlAttrs.lang）与分享图（og:image 等）都在 app.vue 里运行时声明。
      // 原因：二者都依赖「当前站点域名」，构建期拿不到；写成静态相对值会被判定为
      // 无效（相对 og:image 爬虫取不到，静态 lang 在装了 i18n 时算「钉死 locale」）。
      link: [
        // 矢量 favicon 优先（任意尺寸清晰），.ico 兜底旧浏览器
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', sizes: '32x32', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'mask-icon', href: '/favicon.svg', color: '#4f46e5' },
      ],
    },
  },
});
