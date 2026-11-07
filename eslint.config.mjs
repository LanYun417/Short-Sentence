import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

/**
 * LYAdmin 根目录 ESLint 扁平配置（flat config）。
 * 统一覆盖后端 api/ 与前端 admin/（Vue3 中后台）、client/（Nuxt 用户端）的
 * TypeScript / Vue 源码；android/（Flutter/Dart）不在 ESLint 管辖范围。
 * 注意：注释内不可出现连续星号加斜杠的 glob 写法，否则会提前闭合块注释。
 */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      // 构建验证用临时输出目录（如 vite build --outDir dist-verify），
      // **/dist/** 匹配不到 dist-xxx 形式，需显式排除，否则 lint 需遍历整个产物
      '**/dist-*/**',
      '**/build/**',
      '**/coverage/**',
      // Nuxt 客户端生成产物与输出目录（.nuxt 类型/自动导入、.output 构建产物、.data 数据目录）
      '**/.nuxt/**',
      '**/.output/**',
      '**/.data/**',
      // 前端构建产物映射目录（由 admin 构建输出、同源部署时后端托管，非源码）
      'api/web/**',
      '**/*.min.js',
      // 前端自动生成的类型声明（unplugin-auto-import / unplugin-vue-components，格式由插件决定）
      'admin/auto-imports.d.ts',
      'admin/components.d.ts',
      // 后端：Prisma 生成客户端（构建产物）与运行时数据目录
      'api/src/generated/**',
      // 后端：接口文档数据（由 scripts/gen-api-docs.mjs 生成）
      'api/src/modules/docs/api-docs.generated.ts',
      'api/src/modules/docs/openapi.generated.ts',
      'api/uploads/**',
      'api/logs/**',
      'api/cache/**',
      // WorkBuddy 会话数据与一次性验证脚本（非项目源码，格式由工具决定，不参与 lint）
      '.workbuddy/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Vue 单文件组件
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/require-default-prop': 'off',
    },
  },

  // TypeScript 通用规则
  {
    files: ['**/*.{ts,vue}'],
    rules: {
      // 未定义标识符交由 TypeScript 编译器检查（vue-tsc / tsc），
      // ESLint 的 no-undef 无法识别 TS 类型（如 HTMLDivElement、File）与 DOM 全局，会产生误报。
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },

  // 前端浏览器环境（admin 中后台 + client Nuxt 用户端）
  {
    files: ['admin/**/*.{ts,vue,js,mjs}', 'client/**/*.{ts,vue,js,mjs}'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        history: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        getComputedStyle: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        MutationObserver: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        FormData: 'readonly',
        FileReader: 'readonly',
        URL: 'readonly',
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLInputElement: 'readonly',
        Event: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        DragEvent: 'readonly',
      },
    },
  },

  // 后端 Node 环境（纯 ESM，api/，无 __dirname/module/require）
  {
    files: ['api/**/*.ts'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
  },

  // 配置文件（Node/CJS）
  {
    files: ['**/*.cjs', '**/*.config.{js,mjs,ts}', '**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        // Node 内置全局：零依赖 Node 脚本（scripts/*.mjs）会用到
        Buffer: 'readonly',
        URL: 'readonly',
        // 定时器不是 ES 内置全局， scripts/*.mjs 的轮询等待会用到
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        // Node 18+ 内置网络 API， dev.mjs 的健康检查轮询直接用，无需引第三方 HTTP 客户端
        fetch: 'readonly',
        AbortSignal: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off',
    },
  },

  prettierRecommended,
  {
    rules: {
      'prettier/prettier': 'error',
    },
  },
];
