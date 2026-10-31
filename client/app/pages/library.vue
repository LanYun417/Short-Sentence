<script setup lang="ts">
/**
 * 题库页（路由 /library）。
 *
 * 为什么独立成页：刷题页是「一题一屏」的核心场景，任何常驻区块都会把题卡往下推、
 * 拉长页面。所有题库入口（几十个场景 + 二十多个节日）铺在刷题页顶部既占空间又抢注意力，
 * 所以挪到这里——顶部导航点「题库」进来，挑一个专门刷（刷题仍在刷题页完成）。
 */
import type { CategoryBank, FestivalBank } from '~/types';
import { apiFetch } from '~/composables/useApi';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '题库',
  description: '场景题库与节日题库全年常驻，挑一个专门刷。',
});

/**
 * 两组题库都走 SSR 数据通道：首屏 HTML 直接带卡片，不等水合后才出现。
 * useSsrApi 返回 null 表示「SSR 拿不到」（未登录 / Cookie 令牌过期），交客户端兜底。
 */
const { data: ssrCategories } = await useSsrApi<CategoryBank[]>('ss:category-banks', '/client/categories');
const { data: ssrFestivals } = await useSsrApi<FestivalBank[]>('ss:festivals', '/client/questions/festivals');

/** 场景题库（按 sort 升序，附可刷题数）。 */
const categories = ref<CategoryBank[]>(ssrCategories.value ?? []);
/** 节日题库（按日期升序，只含有就绪题的节日）。 */
const festivals = ref<FestivalBank[]>(ssrFestivals.value ?? []);
/** 两组都要 SSR 拿不到才算「还在加载」（有一组有数据就能先渲染那一组）。 */
const loading = ref(ssrCategories.value === null && ssrFestivals.value === null);

onMounted(async () => {
  if (categories.value.length > 0 && festivals.value.length > 0) {
    loading.value = false;
    return;
  }
  const [cats, fests] = await Promise.all([
    categories.value.length > 0
      ? Promise.resolve(categories.value)
      : apiFetch<CategoryBank[]>('/client/categories').catch(() => []),
    festivals.value.length > 0
      ? Promise.resolve(festivals.value)
      : apiFetch<FestivalBank[]>('/client/questions/festivals').catch(() => []),
  ]);
  categories.value = cats;
  festivals.value = fests;
  loading.value = false;
});

/**
 * 节日卡片配色：按它在一年中的位置取色（12 色环均匀分布），
 * 让二十多个卡片一眼能分出季节，而不是一片同色。
 */
function festivalHue(date: string | null): number {
  const month = date ? Number(date.slice(5, 7)) : 1;
  return Math.round(((month - 1) / 12) * 360);
}

/** 挑一个场景 → 去刷题页并锁定该场景题库。 */
function openCategory(id: number): void {
  void navigateTo({ path: '/', query: { category: String(id) } });
}

/** 挑一个节日 → 去刷题页并锁定该节日题库。 */
function openFestival(name: string): void {
  void navigateTo({ path: '/', query: { festival: name } });
}
</script>

<template>
  <div class="mx-auto max-w-xl px-4 py-6 md:py-8">
    <header class="anim-in mb-4">
      <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">题库</h1>
      <p class="mt-1 text-xs text-slate-400">场景与节日全年常驻，挑一个专门刷</p>
    </header>

    <!-- 场景题库：日常场景，点进去只刷该场景 -->
    <section class="anim-in mb-6" :style="{ animationDelay: '40ms' }">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">场景题库</h2>
        <span v-if="categories.length" class="text-[11px] text-slate-400">{{ categories.length }} 个场景</span>
      </div>
      <div v-if="loading" class="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <div
          v-for="n in 6"
          :key="`c${n}`"
          class="h-20 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70"
        />
      </div>
      <div v-else-if="categories.length" class="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <button
          v-for="item in categories"
          :key="item.id"
          type="button"
          :disabled="item.count === 0"
          class="flex h-20 flex-col justify-between rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200/70 transition active:scale-95 disabled:opacity-50 dark:bg-slate-900 dark:ring-slate-800/80"
          @click="openCategory(item.id)"
        >
          <span class="flex items-start justify-between gap-1">
            <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ item.name }}</span>
            <UIcon name="i-lucide-map-pin" class="h-4 w-4 shrink-0 text-sky-500" />
          </span>
          <span class="text-[11px] text-slate-400">{{ item.count > 0 ? `${item.count} 题` : '准备中' }}</span>
        </button>
      </div>
      <p
        v-else
        class="rounded-2xl bg-white px-4 py-6 text-center text-xs text-slate-400 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
      >
        暂无可刷的场景
      </p>
    </section>

    <!-- 节日题库：全年常驻，点进去只刷该节日 -->
    <section class="anim-in" :style="{ animationDelay: '80ms' }">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">节日题库</h2>
        <span v-if="festivals.length" class="text-[11px] text-slate-400">{{ festivals.length }} 个节日</span>
      </div>
      <div v-if="loading" class="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <div
          v-for="n in 6"
          :key="`f${n}`"
          class="h-20 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70"
        />
      </div>
      <div v-else-if="festivals.length" class="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <button
          v-for="item in festivals"
          :key="item.name"
          type="button"
          class="flex h-20 flex-col justify-between rounded-2xl p-3 text-left text-white shadow-sm transition active:scale-95"
          :style="{ backgroundColor: `hsl(${festivalHue(item.date)} 72% 46%)` }"
          @click="openFestival(item.name)"
        >
          <span class="flex items-start justify-between gap-1">
            <span class="text-sm font-semibold">{{ item.name }}</span>
            <UIcon name="i-lucide-sparkles" class="h-4 w-4 shrink-0 opacity-80" />
          </span>
          <span class="text-[11px] opacity-85">{{ item.count }} 题</span>
        </button>
      </div>
      <p
        v-else
        class="rounded-2xl bg-white px-4 py-6 text-center text-xs text-slate-400 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
      >
        节日题库正在准备中
      </p>
    </section>
  </div>
</template>
