<script setup lang="ts">
/**
 * 情景闯关入口卡片（成长页）。
 *
 * 只展示「总进度 + 当前推荐关卡」，完整地图在 /stages。
 * 刻意不在成长页铺 14 个关卡：成长页已经有 5 张卡片，关卡地图需要纵向空间讲剧情，
 * 挤成一行卡片会变成「图标墙」，反而看不出这是个有故事的玩法。
 */
import { computed } from 'vue';
import type { StageChapter, StageOverview, StageView } from '~/types';

const { data: overview } = await useFetch<StageOverview | null>('/api/client/stages', {
  default: () => null,
});

/** 推荐关卡（第一个已解锁未通关的关卡）。 */
const recommended = computed<StageView | null>(() => {
  const data = overview.value;
  if (!data || data.recommendedId === null) return null;
  for (const chapter of data.chapters) {
    const hit = chapter.stages.find((item) => item.id === data.recommendedId);
    if (hit) return hit;
  }
  return null;
});

/** 推荐关卡所属章节。 */
const chapter = computed<StageChapter | null>(() => {
  const id = recommended.value?.id;
  if (!id) return null;
  return overview.value?.chapters.find((item) => item.stages.some((stage) => stage.id === id)) ?? null;
});

const percent = computed(() => {
  const data = overview.value;
  if (!data || data.totalStages === 0) return 0;
  return Math.round((data.clearedStages / data.totalStages) * 100);
});
</script>

<template>
  <section
    v-if="overview && overview.totalStages > 0"
    class="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 sm:p-5 dark:bg-slate-900 dark:ring-slate-800/80"
  >
    <header class="mb-3 flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-map" class="h-4 w-4 text-sky-500" />
        <h2 class="text-sm font-semibold text-slate-800 dark:text-slate-100">情景闯关</h2>
      </div>
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
        已通关 <b class="text-sky-600 dark:text-sky-400">{{ overview.clearedStages }}</b> / {{ overview.totalStages }}
      </span>
    </header>

    <!-- 总进度 -->
    <div class="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div
        class="h-full rounded-full bg-linear-to-r from-sky-400 to-indigo-500 transition-all duration-700"
        :style="{ width: `${percent}%` }"
      />
    </div>

    <!-- 当前关卡：把剧情引入露出来，让人知道这不是普通题库 -->
    <NuxtLink
      v-if="recommended"
      :to="`/?category=${recommended.id}`"
      class="block rounded-2xl bg-linear-to-br from-sky-50 to-indigo-50 p-3 ring-1 ring-sky-100 transition hover:ring-sky-300 dark:from-sky-950/40 dark:to-indigo-950/40 dark:ring-sky-900/60"
    >
      <p class="mb-1 text-[11px] font-medium text-sky-600 dark:text-sky-400">
        {{ chapter?.name }} · {{ recommended.name }}
      </p>
      <p class="text-base font-bold text-slate-800 dark:text-slate-100">{{ recommended.title }}</p>
      <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
        {{ recommended.intro }}
      </p>
      <div class="mt-2 flex items-center gap-2">
        <div class="h-1 flex-1 overflow-hidden rounded-full bg-white/70 dark:bg-slate-800">
          <div class="h-full rounded-full bg-sky-500" :style="{ width: `${recommended.progress}%` }" />
        </div>
        <span class="shrink-0 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
          {{ recommended.correctCount }} / {{ recommended.target }} 句
        </span>
      </div>
    </NuxtLink>

    <p
      v-else
      class="rounded-2xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
    >
      全部关卡已通关。回去复习，或者等新的章节上线。
    </p>

    <div class="mt-3 flex items-center justify-between gap-2">
      <span
        v-if="overview.claimable > 0"
        class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
      >
        <UIcon name="i-lucide-gift" class="h-3 w-3" />
        {{ overview.claimable }} 个通关奖励待领取
      </span>
      <span v-else class="text-[11px] text-slate-400 dark:text-slate-500"> 每关答对该场景若干句即可通关 </span>
      <NuxtLink
        to="/stages"
        class="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400"
      >
        查看地图
        <UIcon name="i-lucide-chevron-right" class="h-3.5 w-3.5" />
      </NuxtLink>
    </div>
  </section>
</template>
