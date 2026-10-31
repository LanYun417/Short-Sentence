<script setup lang="ts">
/**
 * 题库页（路由 /library）。
 *
 * 为什么独立成页：刷题页是「一题一屏」的核心场景，任何常驻区块都会把题卡往下推、
 * 拉长页面。节日题库有二十多个入口，铺在刷题页顶部既占空间又抢注意力，
 * 所以挪到这里——顶部导航点「题库」进来，挑一个节日专门刷（刷题仍在刷题页完成）。
 */
import type { FestivalBank } from '~/types';
import { apiFetch } from '~/composables/useApi';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '题库',
  description: '节日题库全年常驻，挑一个节日专门刷。',
});

/**
 * 节日列表走 SSR 数据通道：首屏 HTML 直接带卡片，不等水合后才出现。
 * useSsrApi 返回 null 表示「SSR 拿不到」（未登录 / Cookie 令牌过期），交客户端兜底。
 */
const { data: ssrFestivals } = await useSsrApi<FestivalBank[]>('ss:festivals', '/client/questions/festivals');

/** 可刷的节日题库（只含有就绪题的节日；按日期升序）。 */
const festivals = ref<FestivalBank[]>(ssrFestivals.value ?? []);
const loading = ref(ssrFestivals.value === null);

onMounted(async () => {
  if (festivals.value.length > 0) {
    loading.value = false;
    return;
  }
  festivals.value = await apiFetch<FestivalBank[]>('/client/questions/festivals').catch(() => []);
  loading.value = false;
});

/**
 * 节日卡片配色：按它在一年中的位置取色（12 色环均匀分布），
 * 让二十多个卡片一眼能分出季节，而不是一片同色。
 */
function hueOf(date: string | null): number {
  const month = date ? Number(date.slice(5, 7)) : 1;
  return Math.round(((month - 1) / 12) * 360);
}

/** 选一个节日 → 去刷题页并锁定该节日题库。 */
function openFestival(name: string): void {
  void navigateTo({ path: '/', query: { festival: name } });
}
</script>

<template>
  <div class="mx-auto max-w-xl px-4 py-6 md:py-8">
    <header class="anim-in mb-4">
      <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">题库</h1>
      <p class="mt-1 text-xs text-slate-400">节日题库全年常驻，挑一个节日专门刷</p>
    </header>

    <!-- 骨架屏：加载中占位，避免网格突然抖一下 -->
    <div v-if="loading" class="anim-in grid grid-cols-2 gap-2.5 md:grid-cols-3">
      <div v-for="n in 6" :key="n" class="h-20 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
    </div>

    <div v-else-if="festivals.length" class="anim-in grid grid-cols-2 gap-2.5 md:grid-cols-3">
      <button
        v-for="item in festivals"
        :key="item.name"
        type="button"
        class="flex h-20 flex-col justify-between rounded-2xl p-3 text-left text-white shadow-sm transition active:scale-95"
        :style="{ backgroundColor: `hsl(${hueOf(item.date)} 72% 46%)` }"
        @click="openFestival(item.name)"
      >
        <span class="flex items-start justify-between gap-1">
          <span class="text-sm font-semibold">{{ item.name }}</span>
          <UIcon name="i-lucide-sparkles" class="h-4 w-4 shrink-0 opacity-80" />
        </span>
        <span class="text-[11px] opacity-85">{{ item.count }} 题</span>
      </button>
    </div>

    <!-- 空态：题库还没铺满（运营侧正在生成） -->
    <div
      v-else
      class="anim-in rounded-2xl bg-white px-4 py-8 text-center shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
    >
      <UIcon name="i-lucide-calendar-days" class="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
      <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">节日题库正在准备中</p>
      <p class="mt-1 text-xs text-slate-400">铺好后这里会列出全年所有节日，随时点开专门刷</p>
    </div>
  </div>
</template>
