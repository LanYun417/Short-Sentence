<script setup lang="ts">
/**
 * 「下载 App」入口，两种呈现，均跳转独立下载页 `/download`：
 * - `card`（默认）：我的页里的整行卡片；
 * - `link`：登录/注册页底部的轻量文字链接——**未登录用户也要能下载 App**。
 *
 * 版本信息与安装包下载全部在 /download 完成（专用接口 /api/client/app/download/:id
 * 绕过 /static 防盗链并统计下载量），这里只负责把用户带过去。
 */
withDefaults(defineProps<{ variant?: 'card' | 'link' }>(), { variant: 'card' });
</script>

<template>
  <!-- 我的页：整行卡片 -->
  <NuxtLink
    v-if="variant === 'card'"
    to="/download"
    class="anim-in mt-3 flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-sm ring-1 ring-slate-200/70 transition hover:ring-sky-300 dark:bg-slate-900 dark:ring-slate-800/80 dark:hover:ring-sky-500/40"
    style="animation-delay: 115ms"
  >
    <UIcon name="i-lucide-smartphone" class="h-5 w-5 shrink-0 text-sky-500" />
    <span class="min-w-0 flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">下载 App</span>
    <span class="shrink-0 text-xs text-slate-400">Android</span>
    <UIcon name="i-lucide-chevron-right" class="h-4 w-4 shrink-0 text-slate-400" />
  </NuxtLink>

  <!-- 登录/注册页：轻量文字链接，不抢表单的视觉重心 -->
  <NuxtLink
    v-else
    to="/download"
    class="mx-auto flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-sky-600 dark:hover:text-sky-400"
  >
    <UIcon name="i-lucide-smartphone" class="h-4 w-4" />
    下载 Android App
  </NuxtLink>
</template>
