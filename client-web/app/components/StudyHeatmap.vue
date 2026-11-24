<script setup lang="ts">
/**
 * 学习热力图：GitHub 风格 53 周 × 7 天方格，展示最近一年每天的答题量。
 *
 * 数据来源 GET /client/checkin/history（user_checkin 按日 upsert，天然只含有活动的日子）；
 * 没有记录的日子渲染成空格，不靠后端补日历。规则引擎产出，不消耗 AI 额度。
 *
 * 布局：CSS grid，列 = 周（53），行 = 星期（7，周一在顶）；格子用 title 显示日期与题数，
 * 不引入额外 tooltip 库。移动端横向可滚（外层 overflow-x-auto），不挤压页面宽度。
 */
import { computed } from 'vue';
import { apiFetch } from '~/composables/useApi';
import type { CheckinHistoryDay } from '~/types';

interface Cell {
  date: string;
  doneCount: number;
  goalCount: number;
  completed: boolean;
  /** 是否在查询范围内（范围外的日子留空，不渲染格子） */
  inRange: boolean;
  /** 星期索引 0=周一 … 6=周日 */
  weekday: number;
  week: number;
}

const days = ref<CheckinHistoryDay[]>([]);
const loading = ref(true);
const error = ref('');

/** 格子强度 0~4：0 = 无活动，1~4 按当日题数分档（门槛跟每日目标对齐）。 */
function levelOf(count: number, goalCount: number): number {
  if (count <= 0) return 0;
  const goal = goalCount > 0 ? goalCount : 10;
  if (count >= goal * 2) return 4;
  if (count >= goal) return 3;
  if (count >= Math.ceil(goal / 2)) return 2;
  return 1;
}

const LEVEL_CLASS = [
  'bg-slate-100 dark:bg-slate-800',
  'bg-sky-200 dark:bg-sky-900',
  'bg-sky-400 dark:bg-sky-700',
  'bg-sky-500 dark:bg-sky-500',
  'bg-sky-700 dark:bg-sky-300',
];

/** 今天（本地时区，YYYY-MM-DD）与一周前的周一，用作网格起点。 */
const grid = computed<Cell[]>(() => {
  const byDate = new Map(days.value.map((d) => [d.date, d]));
  const today = new Date();
  // 以周日为一周起点对齐（getDay: 0=周日），换算成周一在顶：offset = (getDay+6)%7
  const todayOffset = (today.getDay() + 6) % 7;
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  end.setDate(end.getDate() + (6 - todayOffset)); // 本周周日补齐
  const start = new Date(end);
  start.setDate(start.getDate() - (53 * 7 - 1)); // 53 周前

  const cells: Cell[] = [];
  const cursor = new Date(start);
  for (let week = 0; week < 53; week += 1) {
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      const date = `${y}-${m}-${d}`;
      const row = byDate.get(date);
      cells.push({
        date,
        doneCount: row?.doneCount ?? 0,
        goalCount: row?.goalCount ?? 0,
        completed: row?.completed ?? false,
        inRange: cursor <= end,
        weekday,
        week,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return cells;
});

/** 月份标签：每周第一格所在周若跨月则标出月份名；相邻不足 3 周的不标（避免文字叠字）。 */
const monthLabels = computed(() => {
  const out: Array<{ week: number; label: string }> = [];
  let lastMonth = -1;
  let lastWeek = -99;
  for (let week = 0; week < 53; week += 1) {
    const cell = grid.value.find((c) => c.week === week && c.weekday === 0);
    if (!cell) continue;
    const month = Number(cell.date.slice(5, 7));
    if (month !== lastMonth) {
      if (week - lastWeek >= 3) {
        out.push({ week, label: `${month}月` });
        lastWeek = week;
      }
      lastMonth = month;
    }
  }
  return out;
});

/** 汇总：活跃天数 / 累计答题 / 当前连续（取最后一条有记录的 streak 由后端 today 提供，这里只算活跃与总量）。 */
const stats = computed(() => {
  const active = days.value.filter((d) => d.doneCount > 0);
  const total = active.reduce((sum, d) => sum + d.doneCount, 0);
  const completed = active.filter((d) => d.completed).length;
  return { activeDays: active.length, totalAnswers: total, completedDays: completed };
});

onMounted(async () => {
  try {
    days.value = await apiFetch<CheckinHistoryDay[]>('/client/checkin/history', {
      query: { days: 371 },
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80">
    <div class="mb-3 flex items-center justify-between gap-2">
      <h3 class="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <UIcon name="i-lucide-calendar-days" class="h-4 w-4 text-emerald-500" />
        学习热力图
      </h3>
      <span class="text-xs text-slate-400">最近一年</span>
    </div>

    <div v-if="loading" class="flex h-28 items-center justify-center gap-2 text-xs text-slate-400">
      <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin" />
      加载中…
    </div>
    <p v-else-if="error" class="py-8 text-center text-xs text-rose-500">{{ error }}</p>
    <template v-else>
      <!-- 汇总数字 -->
      <div class="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span
          >累计答题 <b class="font-semibold text-slate-800 dark:text-slate-100">{{ stats.totalAnswers }}</b> 次</span
        >
        <span
          >活跃 <b class="font-semibold text-slate-800 dark:text-slate-100">{{ stats.activeDays }}</b> 天</span
        >
        <span
          >达标 <b class="font-semibold text-slate-800 dark:text-slate-100">{{ stats.completedDays }}</b> 天</span
        >
      </div>

      <!-- 53 周网格：横向可滚，不挤压页面 -->
      <div class="overflow-x-auto pb-1">
        <div class="min-w-max">
          <!-- 月份标签：绝对定位到对应周的列，避免 flex 间距累加误差 -->
          <div class="relative mb-1 h-4 text-[10px] text-slate-400">
            <span
              v-for="m in monthLabels"
              :key="m.week"
              class="absolute top-0 whitespace-nowrap"
              :style="{ left: `${m.week * 14}px` }"
            >
              {{ m.label }}
            </span>
          </div>
          <!-- 方格：grid-flow-col 让 7 天为一列向下排 -->
          <div class="grid grid-flow-col grid-rows-7 gap-[3px]">
            <div
              v-for="cell in grid"
              :key="cell.date"
              class="size-[11px] rounded-[2px] transition-opacity"
              :class="[cell.inRange ? LEVEL_CLASS[levelOf(cell.doneCount, cell.goalCount)] : 'bg-transparent']"
              :title="cell.inRange ? `${cell.date}：${cell.doneCount} 题${cell.completed ? '（已达标）' : ''}` : ''"
            />
          </div>
        </div>
      </div>

      <!-- 图例 -->
      <div class="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-400">
        <span>少</span>
        <span v-for="i in 5" :key="i" class="size-[11px] rounded-[2px]" :class="LEVEL_CLASS[i - 1]" />
        <span>多</span>
      </div>
    </template>
  </div>
</template>
