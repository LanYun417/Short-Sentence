<script setup lang="ts">
import { computed } from 'vue';

interface MemoryStats {
  reviewed: number;
  graduated: number;
  dueToday: number;
  dueIn7: number;
  dueIn30: number;
  distribution: number[];
  retentionCurve: Array<{ day: number; retention: number }>;
}

const { data } = await useFetch<MemoryStats>('/api/client/questions/memory-stats', {
  default: () => ({
    reviewed: 0,
    graduated: 0,
    dueToday: 0,
    dueIn7: 0,
    dueIn30: 0,
    distribution: [],
    retentionCurve: [],
  }),
});

const maxDist = computed(() => Math.max(1, ...(data.value?.distribution ?? [])));

// 柱状图：未来 30 天每天到期题数，viewBox 宽 300
const bars = computed(() =>
  (data.value?.distribution ?? []).map((v, i) => ({
    key: i,
    x: (i * 300) / 30 + 1.5,
    h: (v / maxDist.value) * 68,
  })),
);

// 曲线：R(day)=exp(-day/S)，viewBox 300×84，R=1→y=12、R=0→y=80
const curvePath = computed(() => {
  const pts = data.value?.retentionCurve ?? [];
  if (pts.length === 0) return '';
  return pts
    .map((p, i) => {
      const x = (i * 300) / 30;
      const y = 80 - p.retention * 68;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
});
</script>

<template>
  <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">记忆巩固</h3>
      <span class="text-xs text-slate-400">你的遗忘曲线</span>
    </div>

    <div class="grid grid-cols-4 gap-2 text-center">
      <div>
        <div class="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">{{ data?.reviewed ?? 0 }}</div>
        <div class="text-[10px] text-slate-400">已复习</div>
      </div>
      <div>
        <div class="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
          {{ data?.graduated ?? 0 }}
        </div>
        <div class="text-[10px] text-slate-400">已毕业</div>
      </div>
      <div>
        <div class="text-lg font-bold tabular-nums text-sky-600 dark:text-sky-400">{{ data?.dueToday ?? 0 }}</div>
        <div class="text-[10px] text-slate-400">今日待复习</div>
      </div>
      <div>
        <div class="text-lg font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{{ data?.dueIn7 ?? 0 }}</div>
        <div class="text-[10px] text-slate-400">7天待复习</div>
      </div>
    </div>

    <p class="mb-1 mt-4 text-xs text-slate-400">未来 30 天复习分布</p>
    <svg viewBox="0 0 300 76" class="h-16 w-full text-sky-400 dark:text-sky-500" preserveAspectRatio="none">
      <rect
        v-for="b in bars"
        :key="b.key"
        :x="b.x"
        :y="76 - b.h"
        width="7"
        :height="b.h"
        rx="2"
        fill="currentColor"
        opacity="0.8"
      />
    </svg>

    <p class="mb-1 mt-4 text-xs text-slate-400">记忆保留率（每复习一次即被拉平）</p>
    <svg viewBox="0 0 300 84" class="h-16 w-full text-indigo-400 dark:text-indigo-500">
      <line x1="0" y1="80" x2="300" y2="80" stroke="currentColor" stroke-opacity="0.15" />
      <path :d="curvePath" fill="none" stroke="currentColor" stroke-width="2" />
    </svg>
  </div>
</template>
