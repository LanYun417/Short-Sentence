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

export default defineNuxtConfig({
  // 开发服务：固定端口 + strictPort（见下方 vite.server），端口被占直接报错而非静默漂移，
  // 否则 CORS / 防盗链白名单（按端口配置）会在换端口后失效。
  devServer: {
    host: 'localhost',
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

  app: {
    head: {
      title: '短句 · 视觉场景英语闪卡',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: '每天 20 句，看图学地道英语口语。' },
      ],
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
    },
  },
});
