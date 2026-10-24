<script setup lang="ts">
/**
 * 认证页骨架（登录 / 注册共用）。
 *
 * 居中对称的单列结构：品牌 → 标题 → 表单，全部沿中轴排列，整块在视口内垂直水平居中。
 * 只保留功能性文案（页面标题 + 表单本身），不放卖点列表、产品示意这类营销内容——
 * 登录/注册是一次性动作，用户只想尽快填完，营销区块既占地方又拖慢视线。
 *
 * 页面通过默认插槽填入表单卡片；标题由 `title` 传入，保证两页版式完全一致。
 */
defineProps<{
  /** 页面标题（居中显示在品牌下方） */
  title: string;
}>();
</script>

<template>
  <div class="relative grid min-h-dvh place-items-center px-4 py-10">
    <!-- 居中光晕：给纯色背景一点纵深，左右对称不破坏版式 -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        class="absolute left-1/2 top-0 h-104 w-104 -translate-x-1/2 -translate-y-1/3 rounded-full bg-sky-200/45 blur-3xl dark:bg-sky-500/10"
      />
    </div>

    <div class="relative w-full max-w-sm">
      <!-- 品牌：与 default 布局顶栏保持一致（图标 + 渐变字标）。
           刻意不用 logo.svg：它的 viewBox 留白很大（内容只占中间一块且偏左上），
           按高度缩放后既显小又不在正中。 -->
      <div class="anim-in mb-6 flex items-center justify-center gap-2.5">
        <img src="/favicon.svg" alt="" class="h-10 w-10" />
        <span
          class="bg-linear-to-r from-sky-600 to-indigo-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent dark:from-sky-400 dark:to-indigo-400"
        >
          短句
        </span>
      </div>

      <h1
        class="anim-in mb-5 text-center text-lg font-semibold text-slate-800 dark:text-slate-100"
        :style="{ animationDelay: '60ms' }"
      >
        {{ title }}
      </h1>

      <div class="anim-in" :style="{ animationDelay: '120ms' }">
        <slot />
      </div>
    </div>
  </div>
</template>
