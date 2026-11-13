<script setup lang="ts">
/**
 * 场景探索页（路由 /scenes）：全部场景的网格列表，支持筛选。
 *
 * 从成长面板「场景探索 · 查看全部」进入。私有页：不进 sitemap / 禁止抓取（nuxt.config.ts 已排除）。
 */
import { computed, ref } from 'vue';
import type { GamifyOverview, GamifyScene } from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '场景探索',
  description: '查看全部学习场景，已解锁的可以直接去练。',
});

const { data: overview } = await useSsrApi<GamifyOverview>('ss:gamify', '/client/gamify/overview');

/** 筛选：全部 / 已解锁 / 未解锁。 */
const filter = ref<'all' | 'unlocked' | 'locked'>('all');

const FILTERS: Array<{ key: 'all' | 'unlocked' | 'locked'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'unlocked', label: '已解锁' },
  { key: 'locked', label: '未解锁' },
];

const scenes = computed<GamifyScene[]>(() => {
  const list = overview.value?.sceneMap ?? [];
  if (filter.value === 'unlocked') return list.filter((s) => s.unlocked);
  if (filter.value === 'locked') return list.filter((s) => !s.unlocked);
  return list;
});
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6 sm:py-8">
    <header class="mb-5 flex items-center gap-2">
      <button
        type="button"
        class="grid size-8 place-items-center rounded-full transition hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="返回"
        @click="navigateTo('/profile')"
      >
        <UIcon name="i-lucide-chevron-left" class="h-5 w-5 text-slate-500" />
      </button>
      <div>
        <h1 class="flex items-center gap-1.5 text-lg font-bold text-slate-800 dark:text-slate-100">
          <UIcon name="i-lucide-map" class="h-5 w-5 text-sky-500" />
          场景探索
        </h1>
        <p v-if="overview" class="mt-0.5 text-xs text-slate-400">
          已点亮 {{ overview.unlockedScenes }} / {{ overview.totalScenes }}
        </p>
      </div>
    </header>

    <!-- 筛选 -->
    <div v-if="overview" class="mb-4 flex gap-2">
      <button
        v-for="f in FILTERS"
        :key="f.key"
        type="button"
        class="rounded-full px-3 py-1.5 text-xs font-medium transition ring-1"
        :class="
          filter === f.key
            ? 'bg-sky-600 text-white ring-sky-600'
            : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700 dark:hover:bg-slate-800'
        "
        @click="filter = f.key"
      >
        {{ f.label }}
      </button>
    </div>

    <p v-if="!overview" class="py-16 text-center text-sm text-slate-400">加载中…</p>
    <p v-else-if="scenes.length === 0" class="py-16 text-center text-sm text-slate-400">该筛选下暂无场景</p>

    <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div
        v-for="scene in scenes"
        :key="scene.id"
        class="rounded-2xl border p-4 transition"
        :class="
          scene.unlocked
            ? 'border-sky-200 bg-sky-50/50 dark:border-sky-500/20 dark:bg-sky-500/5'
            : 'border-dashed border-slate-200 opacity-70 dark:border-slate-700'
        "
      >
        <div class="flex items-center gap-2">
          <span
            class="grid size-9 shrink-0 place-items-center rounded-xl"
            :class="scene.unlocked ? 'bg-sky-500/15 text-sky-500' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'"
          >
            <UIcon :name="scene.unlocked ? 'i-lucide-map-pin' : 'i-lucide-lock'" class="h-4 w-4" />
          </span>
          <span class="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {{ scene.name }}
          </span>
        </div>
        <p class="mt-2 text-[11px] text-slate-400">
          {{ scene.unlocked ? `已练 ${scene.practicedCount} 句` : '未解锁' }}
        </p>
      </div>
    </div>
  </div>
</template>
