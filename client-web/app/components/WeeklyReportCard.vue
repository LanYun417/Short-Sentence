<script setup lang="ts">
/**
 * 周学习报告卡片（成长面板内）。
 *
 * 数据由服务端聚合（/client/gamify/weekly-report）：答题、正确率、活跃天数、
 * 经验、新成就、连续打卡、每日明细与上周对比。前端只负责展示与分享文案，
 * 不自己算「本周」——时区边界与口径必须与服务端一致。
 */
interface WeeklyReport {
  answered: number;
  correct: number;
  accuracy: number;
  activeDays: number;
  xpGained: number;
  newAchievements: number;
  streak: number;
  daily: Array<{ date: string; weekday: string; answered: number; correct: number }>;
  topCategory: { name: string; count: number } | null;
  prevAnswered: number;
  deltaAnswered: number;
}

const { data } = await useSsrApi<WeeklyReport>('ss:weekly-report', '/client/gamify/weekly-report');

const accuracyPct = computed(() => Math.round((data.value?.accuracy ?? 0) * 100));
const maxDaily = computed(() => Math.max(1, ...(data.value?.daily ?? []).map((d) => d.answered)));
const isEmpty = computed(() => (data.value?.answered ?? 0) === 0);
const delta = computed(() => data.value?.deltaAnswered ?? 0);

/** 分享文案（复制到剪贴板，发群/朋友圈用）。 */
const shareText = computed(() => {
  const r = data.value;
  if (!r) return '';
  const parts = [`我在「短句」本周答对 ${r.correct} 句（正确率 ${accuracyPct.value}%）`];
  if (r.activeDays > 0) parts.push(`坚持 ${r.activeDays} 天`);
  if (r.streak > 0) parts.push(`连续打卡 ${r.streak} 天`);
  if (r.topCategory) parts.push(`最常练「${r.topCategory.name}」`);
  return `${parts.join('，')}。`;
});

const copied = ref(false);
async function copyShare(): Promise<void> {
  try {
    await navigator.clipboard.writeText(shareText.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1800);
  } catch {
    copied.value = false;
  }
}
</script>

<template>
  <UCard :ui="{ body: 'p-5' }">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span
            class="grid h-8 w-8 place-items-center rounded-xl bg-linear-to-br from-sky-500 to-indigo-600 text-white"
          >
            <UIcon name="i-lucide-calendar-range" class="h-4.5 w-4.5" />
          </span>
          <div>
            <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">本周学习报告</h3>
            <p class="text-xs text-slate-400">周一 00:00 至今</p>
          </div>
        </div>
        <UButton
          v-if="!isEmpty"
          size="xs"
          color="neutral"
          variant="soft"
          :icon="copied ? 'i-lucide-check' : 'i-lucide-share-2'"
          @click="copyShare"
        >
          {{ copied ? '已复制' : '分享' }}
        </UButton>
      </div>
    </template>

    <div v-if="isEmpty" class="py-6 text-center">
      <p class="text-sm text-slate-500">本周还没有学习记录</p>
      <p class="mt-1 text-xs text-slate-400">刷几道题，周日回来看看这一周攒下了什么</p>
      <UButton to="/" class="mt-4" icon="i-lucide-layers" size="sm">去刷题</UButton>
    </div>

    <template v-else>
      <div class="grid grid-cols-3 gap-3 text-center">
        <div>
          <div class="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{{ data?.answered ?? 0 }}</div>
          <div class="text-[11px] text-slate-400">本周答题</div>
        </div>
        <div>
          <div class="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{{ accuracyPct }}%</div>
          <div class="text-[11px] text-slate-400">正确率</div>
        </div>
        <div>
          <div class="text-xl font-bold tabular-nums text-sky-600 dark:text-sky-400">{{ data?.activeDays ?? 0 }}/7</div>
          <div class="text-[11px] text-slate-400">活跃天数</div>
        </div>
      </div>

      <!-- 每日迷你柱状图：高度按当日答题数归一，答对部分叠深色 -->
      <div class="mt-5 flex h-16 items-end justify-between gap-1.5">
        <div v-for="d in data?.daily ?? []" :key="d.date" class="flex flex-1 flex-col items-center gap-1">
          <div class="flex h-12 w-full items-end justify-center">
            <div
              class="w-full max-w-6 rounded-t-md bg-sky-200 transition-all dark:bg-sky-900"
              :style="{ height: `${Math.max(d.answered > 0 ? 12 : 2, (d.answered / maxDaily) * 100)}%` }"
              :title="`${d.weekday}：${d.answered} 题（对 ${d.correct}）`"
            >
              <div
                class="w-full rounded-t-md bg-sky-500 dark:bg-sky-400"
                :style="{ height: d.answered > 0 ? `${(d.correct / Math.max(1, d.answered)) * 100}%` : '0%' }"
              />
            </div>
          </div>
          <span class="text-[10px] text-slate-400">{{ d.weekday.replace('周', '') }}</span>
        </div>
      </div>

      <div class="mt-4 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
        <p class="flex items-center gap-1.5">
          <UIcon name="i-lucide-sparkles" class="h-3.5 w-3.5 text-amber-500" />
          本周获得 {{ data?.xpGained ?? 0 }} 经验
          <span v-if="(data?.newAchievements ?? 0) > 0" class="text-amber-600 dark:text-amber-400">
            · 新解锁 {{ data?.newAchievements }} 个成就
          </span>
        </p>
        <p v-if="(data?.streak ?? 0) > 0" class="flex items-center gap-1.5">
          <UIcon name="i-lucide-flame" class="h-3.5 w-3.5 text-orange-500" />
          连续打卡 {{ data?.streak }} 天
        </p>
        <p v-if="data?.topCategory" class="flex items-center gap-1.5">
          <UIcon name="i-lucide-map-pin" class="h-3.5 w-3.5 text-sky-500" />
          最常练「{{ data?.topCategory.name }}」（{{ data?.topCategory.count }} 题）
        </p>
        <p class="flex items-center gap-1.5">
          <UIcon
            :name="delta >= 0 ? 'i-lucide-trending-up' : 'i-lucide-trending-down'"
            class="h-3.5 w-3.5"
            :class="delta >= 0 ? 'text-emerald-500' : 'text-slate-400'"
          />
          比上周 {{ delta >= 0 ? '多' : '少' }} {{ Math.abs(delta) }} 题（上周 {{ data?.prevAnswered ?? 0 }} 题）
        </p>
      </div>
    </template>
  </UCard>
</template>
