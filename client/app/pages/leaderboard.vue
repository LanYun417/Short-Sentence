<script setup lang="ts">
/**
 * 排行榜（路由 /leaderboard）：今日 / 近 7 天 / 近 30 天的答题数与答对数，以及累计打卡天数，各前 100。
 *
 * 数据来自 GET /client/leaderboard?type=...（需登录），按「周期 × 指标」二维选择、按需拉取。
 * 周/月榜是最近 N 个自然日的滚动窗口，与答题记录 30 天保留期对齐，数据完整。
 * 私有页：不进 sitemap / 禁止抓取（nuxt.config.ts 的 robots/sitemap 已排除）。
 */
import { apiFetch } from '~/composables/useApi';
import type { LeaderboardResult, LeaderboardRow, LeaderboardType } from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '排行榜',
  description: '今日、近 7 天、近 30 天的答题与答对排行榜，以及累计打卡榜。',
});

const auth = useAuthStore();
const myId = computed(() => auth.user?.id ?? null);

type Period = 'today' | 'week' | 'month' | 'checkin';
type Metric = 'answered' | 'correct';

const PERIODS: { key: Period; label: string; title: string; scope: string; icon: string }[] = [
  { key: 'today', label: '今日', title: '今日', scope: '今天', icon: 'i-lucide-sun' },
  { key: 'week', label: '近 7 天', title: '近 7 天', scope: '近 7 天', icon: 'i-lucide-calendar-range' },
  { key: 'month', label: '近 30 天', title: '近 30 天', scope: '近 30 天', icon: 'i-lucide-calendar-days' },
  { key: 'checkin', label: '累计打卡', title: '累计打卡', scope: '累计', icon: 'i-lucide-calendar-check-2' },
];
const METRICS: { key: Metric; label: string; icon: string }[] = [
  { key: 'answered', label: '答题数', icon: 'i-lucide-list-checks' },
  { key: 'correct', label: '答对数', icon: 'i-lucide-badge-check' },
];

const period = ref<Period>('today');
const metric = ref<Metric>('answered');

function typeOf(p: Period, m: Metric): LeaderboardType {
  if (p === 'checkin') return 'checkin_total';
  if (p === 'week') return m === 'answered' ? 'week_answered' : 'week_correct';
  if (p === 'month') return m === 'answered' ? 'month_answered' : 'month_correct';
  return m === 'answered' ? 'today_answered' : 'today_correct';
}

const activeType = computed(() => typeOf(period.value, metric.value));
const periodMeta = computed(() => PERIODS.find((p) => p.key === period.value) ?? PERIODS[0]!);
const metricLabel = computed(() => (metric.value === 'answered' ? '答题' : '答对'));
const isCheckin = computed(() => period.value === 'checkin');

/** 首屏 SSR 预取默认榜；其余榜切换时按需拉取（未登录/令牌过期由 onMounted 兜底重拉）。 */
const { data: ssrDefault } = await useSsrApi<LeaderboardResult>('ss:lb-today-answered', '/client/leaderboard', {
  type: 'today_answered',
});
const dataMap = ref<Partial<Record<LeaderboardType, LeaderboardResult>>>(
  ssrDefault.value ? { today_answered: ssrDefault.value } : {},
);
const loading = ref(false);
const inflight = new Set<LeaderboardType>();

const current = computed(() => dataMap.value[activeType.value] ?? null);
const rows = computed<LeaderboardRow[]>(() => current.value?.top ?? []);
const me = computed(() => current.value?.me ?? null);
const dateText = computed(() => current.value?.date ?? '');
const unit = computed(() => current.value?.unit ?? (isCheckin.value ? '天' : '题'));

async function load(type: LeaderboardType): Promise<void> {
  if (inflight.has(type)) return;
  inflight.add(type);
  loading.value = true;
  try {
    const res = await apiFetch<LeaderboardResult>('/client/leaderboard', { query: { type } });
    dataMap.value = { ...dataMap.value, [type]: res };
  } catch {
    // 401 由 useApi 统一跳登录；其它错误保留当前数据
  } finally {
    inflight.delete(type);
    loading.value = false;
  }
}

watch(activeType, (type) => {
  if (!dataMap.value[type]) void load(type);
});

onMounted(() => {
  void load(activeType.value);
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
        <span v-if="dateText" class="text-xs font-medium text-sky-600 dark:text-sky-400">
          {{ periodMeta.title }} · 截至 {{ dateText }}
        </span>
      </div>
      <UButton
        size="xs"
        color="neutral"
        variant="outline"
        icon="i-lucide-refresh-cw"
        :loading="loading"
        aria-label="刷新榜单"
        @click="load(activeType)"
      />
    </header>

    <!-- 我的名次 -->
    <div
      class="mb-4 flex items-center gap-3 rounded-2xl bg-linear-to-r from-sky-50 to-indigo-50 px-4 py-3 ring-1 ring-sky-100 dark:from-sky-950/40 dark:to-indigo-950/40 dark:ring-sky-900/50"
    >
      <UIcon name="i-lucide-trophy" class="h-5 w-5 shrink-0 text-amber-500" />
      <p v-if="me" class="text-sm text-slate-700 dark:text-slate-200">
        <template v-if="isCheckin">
          你累计打卡 <b class="font-bold text-sky-600 dark:text-sky-400">第 {{ me.rank }} 名</b> · {{ me.count }} 天
        </template>
        <template v-else>
          你{{ periodMeta.scope }}{{ metricLabel }}
          <b class="font-bold text-sky-600 dark:text-sky-400">第 {{ me.rank }} 名</b> · {{ me.count }} {{ unit }}
        </template>
      </p>
      <p v-else class="text-sm text-slate-500 dark:text-slate-400">
        {{ isCheckin ? '还没打过卡，去完成今日目标吧' : `${periodMeta.scope}还没上榜，去刷几题吧` }}
      </p>
    </div>

    <!-- 周期切换 -->
    <div class="mb-2 flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
      <button
        v-for="p in PERIODS"
        :key="p.key"
        type="button"
        class="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-medium transition"
        :class="
          period === p.key
            ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
        "
        @click="period = p.key"
      >
        <UIcon :name="p.icon" class="h-4 w-4" />
        {{ p.label }}
      </button>
    </div>
    <!-- 指标切换（打卡榜只有天数一个口径） -->
    <div v-if="!isCheckin" class="mb-4 flex gap-1 rounded-xl bg-slate-50 p-1 dark:bg-slate-800/60">
      <button
        v-for="m in METRICS"
        :key="m.key"
        type="button"
        class="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition"
        :class="
          metric === m.key
            ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-200'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
        "
        @click="metric = m.key"
      >
        <UIcon :name="m.icon" class="h-3.5 w-3.5" />
        {{ m.label }}
      </button>
    </div>
    <div v-else class="mb-4" />

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
          {{ row.count }}<span class="ml-0.5 text-xs font-normal text-slate-400">{{ unit }}</span>
        </span>
      </li>
    </ul>

    <div
      v-else
      class="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
    >
      <UIcon name="i-lucide-trophy" class="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
      <p class="mt-3 text-sm text-slate-400">{{ isCheckin ? '还没有人打卡' : `${periodMeta.scope}还没有人上榜` }}</p>
      <p class="mt-1 text-xs text-slate-400">
        {{ isCheckin ? '完成今日目标，你就是打卡第一人' : '答完第一题，你就是榜一' }}
      </p>
    </div>
  </div>
</template>
