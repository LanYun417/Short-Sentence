// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  modules: [
    '@nuxt/icon/module',
    '@nuxt/fonts',
    '@nuxt/image',
    'reka-ui/nuxt',
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
  },
  // Tailwind v4 入口（暗色变体由 color-mode 的 .dark class 驱动）
  css: ['~/assets/css/main.css'],

  // 运行时配置：API 基地址经 NUXT_PUBLIC_API_BASE_URL 注入（默认 /api 同源走代理）
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || '/api',
    },
  },

  // 开发期把 /api 代理到 NestJS（生产同源部署无需此配置）
  nitro: {
    devProxy: {
      '/api': {
        target: process.env.NUXT_API_TARGET || 'http://localhost:3000',
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
