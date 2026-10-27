import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * 用户端单测配置。
 *
 * 刻意**不引入 @nuxt/test-utils**：这里只跑与框架无关的纯逻辑（答案归一化、
 * AI 输出解析），不需要起 Nuxt 运行时，跑得快也不会因为 SSR 环境波动而假红。
 * `~` 别名与 Nuxt 的 srcDir（`app/`）保持一致，否则源码里的 `~/types` 解析不到。
 */
export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.spec.ts'],
  },
});
