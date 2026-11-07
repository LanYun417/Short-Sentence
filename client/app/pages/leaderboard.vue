<script setup lang="ts">
/**
 * 今日排行榜（路由 /leaderboard）：答题数前 100 / 答对数前 100。
 *
 * 数据来自 GET /client/leaderboard?type=today_answered|today_correct（需登录）。
 * 私有页：不进 sitemap / 禁止抓取（nuxt.config.ts 的 robots/sitemap 已排除）。
 */
import { apiFetch } from '~/composables/useApi';
import type { LeaderboardResult, LeaderboardRow, LeaderboardType } from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '排行榜',
  description: '今日答题数与答对数排行榜，看看今天谁最卷。',
});

const auth = useAuthStore();
const myId = computed(() => auth.user?.id ?? null);

type Tab = 'answered' | 'correct';
const active = ref<Tab>('answered');

const TABS: { key: Tab; label: string; type: LeaderboardType; icon: string }[] = [
  { key: 'answered', label: '答题榜', type: 'today_answered', icon: 'i-lucide-list-checks' },
  { key: 'correct', label: '答对榜', type: 'today_correct', icon: 'i-lucide-badge-check' },
];

/** 首屏 SSR 预取两个榜（未登录/令牌过期为 null，由 onMounted 客户端兜底重拉）。 */
const { data: ssrAnswered } = await useSsrApi<LeaderboardResult>('ss:lb-answered', '/client/leaderboard', {
  type: 'today_answered',
});
const { data: ssrCorrect } = await useSsrApi<LeaderboardResult>('ss:lb-correct', '/client/leaderboard', {
  type: 'today_correct',
});
const dataMap = ref<Record<Tab, LeaderboardResult | null>>({
  answered: ssrAnswered.value,
  correct: ssrCorrect.value,
});
const loading = ref(false);

const current = computed(() => dataMap.value[active.value]);
const rows = computed<LeaderboardRow[]>(() => current.value?.top ?? []);
const me = computed(() => current.value?.me ?? null);
const dateText = computed(() => current.value?.date ?? '');
const currentUnit = computed(() => (active.value === 'answered' ? '答了' : '答对'));

async function reload(): Promise<void> {
  loading.value = true;
  try {
    const [a, c] = await Promise.all([
      apiFetch<LeaderboardResult>('/client/leaderboard', { query: { type: 'today_answered' } }),
      apiFetch<LeaderboardResult>('/client/leaderboard', { query: { type: 'today_correct' } }),
    ]);
    dataMap.value = { answered: a, correct: c };
  } catch {
    // 401 由 useApi 统一跳登录；其它错误保留当前数据
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void reload();
});

function rankClass(rank: number): string {
  if (rank === 1) return 'bg-amber-400 text-white';
  if (rank === 2) return 'bg-slate-300 text-slate-700 dark:bg-slate-600 dark:text-slate-100';
  if (rank === 3) return 'bg-orange-300 text-orange-900 dark:bg-orange-900/60 dark:text-orange-200';
  return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
}

function initialOf(name: string): string {
  const ch = (name || '?').trim().charAt(0);
  return ch ? ch.toUpperCase() : '?';
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6 sm:py-8">
    <header class="mb-4 flex items-center justify-between gap-3">
      <div class="flex items-baseline gap-2">
        <h1 class="text-lg font-bold text-slate-800 dark:text-slate-100">排行榜</h1>
        <span v-if="dateText" class="text-xs font-medium text-sky-600 dark:text-sky-400">今日 · {{ dateText }}</span>
      </div>
      <UButton
        size="xs"
        color="neutral"
        variant="outline"
        icon="i-lucide-refresh-cw"
        :loading="loading"
        aria-label="刷新榜单"
        @click="reload"
      />
    </header>

    <!-- 我的名次 -->
    <div
      class="mb-4 flex items-center gap-3 rounded-2xl bg-linear-to-r from-sky-50 to-indigo-50 px-4 py-3 ring-1 ring-sky-100 dark:from-sky-950/40 dark:to-indigo-950/40 dark:ring-sky-900/50"
    >
      <UIcon name="i-lucide-trophy" class="h-5 w-5 shrink-0 text-amber-500" />
      <p v-if="me" class="text-sm text-slate-700 dark:text-slate-200">
        你今天{{ currentUnit }} <b class="font-bold text-sky-600 dark:text-sky-400">第 {{ me.rank }} 名</b> ·
        {{ me.count }} 题
      </p>
      <p v-else class="text-sm text-slate-500 dark:text-slate-400">今天还没上榜，去刷几题吧</p>
    </div>

    <!-- 双榜切换 -->
    <div class="mb-4 inline-flex rounded-full bg-slate-100 p-1 dark:bg-slate-800">
      <button
        v-for="t in TABS"
        :key="t.key"
        type="button"
        class="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition"
        :class="
          active === t.key
            ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
        "
        @click="active = t.key"
      >
        <UIcon :name="t.icon" class="h-4 w-4" />
        {{ t.label }}
      </button>
    </div>

    <!-- 榜单列表 -->
    <ul v-if="rows.length" class="space-y-2.5">
      <li
        v-for="row in rows"
        :key="row.userId"
        class="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 transition dark:bg-slate-900"
        :class="
          row.userId === myId ? 'ring-2 ring-sky-400 dark:ring-sky-500' : 'ring-slate-200/70 dark:ring-slate-800/80'
        "
      >
        <span
          class="grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold"
          :class="rankClass(row.rank)"
        >
          {{ row.rank }}
        </span>
        <img
          v-if="row.avatarUrl"
          :src="row.avatarUrl"
          :alt="row.nickname"
          class="size-9 shrink-0 rounded-full object-cover"
        />
        <span
          v-else
          class="grid size-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-sky-500 to-indigo-600 text-sm font-bold text-white"
        >
          {{ initialOf(row.nickname) }}
        </span>
        <span class="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
          {{ row.nickname }}
        </span>
        <UTag v-if="row.userId === myId" color="primary" variant="subtle" size="sm">我</UTag>
        <span class="shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {{ row.count }}<span class="ml-0.5 text-xs font-normal text-slate-400">题</span>
        </span>
      </li>
    </ul>

    <div
      v-else
      class="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
    >
      <UIcon name="i-lucide-trophy" class="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
      <p class="mt-3 text-sm text-slate-400">今天还没有人上榜</p>
      <p class="mt-1 text-xs text-slate-400">答完第一题，你就是今天的榜一</p>
    </div>
  </div>
</template>
