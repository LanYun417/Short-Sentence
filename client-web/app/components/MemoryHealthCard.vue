<script setup lang="ts">
/**
 * 记忆巩固卡片：统计数字 + 未来 30 天复习分布（柱状图）+ 遗忘曲线（折线面积图）。
 * 图表统一走 echarts（按需引入，见 utils/echarts.ts），不再手绘 SVG，深色模式自动换色。
 */
import { computed, ref } from 'vue';

interface MemoryStats {
  reviewed: number;
  graduated: number;
  dueToday: number;
  dueIn7: number;
  dueIn30: number;
  distribution: number[];
  retentionCurve: Array<{ day: number; retention: number }>;
}

const { data } = await useSsrApi<MemoryStats>('ss:memory-stats', '/client/questions/memory-stats');

/* ------------------------------ 主题（跟随深色模式） ------------------------------ */

const colorMode = useColorMode();
const isDark = computed(() => {
  const v = colorMode.value;
  if (v === 'dark') return true;
  if (v === 'light') return false;
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
});

const palette = computed(() =>
  isDark.value
    ? {
        tooltipBg: '#1e293b',
        tooltipBorder: '#334155',
        tooltipText: '#e2e8f0',
        axis: '#64748b',
      }
    : {
        tooltipBg: '#ffffff',
        tooltipBorder: '#e2e8f0',
        tooltipText: '#0f172a',
        axis: '#94a3b8',
      },
);

/* ------------------------------ 数据 ------------------------------ */

const distData = computed(() => data.value?.distribution ?? []);
const curvePts = computed(() => data.value?.retentionCurve ?? []);

const barRef = ref<HTMLElement>();
const curveRef = ref<HTMLElement>();

type AxisTipItem = { dataIndex: number; axisValue?: unknown; data?: unknown };

useEchart(barRef, () => {
  const p = palette.value;
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: p.tooltipBg,
      borderColor: p.tooltipBorder,
      textStyle: { color: p.tooltipText, fontSize: 11 },
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as AxisTipItem[];
        const f = list[0];
        if (!f) return '';
        return `第 ${f.dataIndex + 1} 天：<b>${String(f.data)}</b> 题待复习`;
      },
    },
    grid: { left: 2, right: 2, top: 10, bottom: 2 },
    xAxis: { type: 'category', data: distData.value.map((_, i) => i + 1), show: false },
    yAxis: { type: 'value', show: false, minInterval: 1 },
    series: [
      {
        type: 'bar',
        data: distData.value,
        barWidth: '55%',
        itemStyle: { color: '#0ea5e9', borderRadius: [3, 3, 0, 0] },
        emphasis: { itemStyle: { color: '#0284c7' } },
      },
    ],
  } as Record<string, unknown>;
});

useEchart(curveRef, () => {
  const p = palette.value;
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: p.tooltipBg,
      borderColor: p.tooltipBorder,
      textStyle: { color: p.tooltipText, fontSize: 11 },
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as AxisTipItem[];
        const f = list[0];
        if (!f) return '';
        const retention = typeof f.data === 'number' ? f.data : 0;
        return `第 ${String(f.axisValue ?? f.dataIndex + 1)} 天：保留 <b>${(retention * 100).toFixed(0)}%</b>`;
      },
    },
    grid: { left: 2, right: 2, top: 10, bottom: 2 },
    xAxis: { type: 'category', data: curvePts.value.map((c) => c.day), show: false },
    yAxis: { type: 'value', min: 0, max: 1, show: false },
    series: [
      {
        type: 'line',
        smooth: 0.4,
        symbol: 'none',
        data: curvePts.value.map((c) => c.retention),
        lineStyle: { width: 2.5, color: '#6366f1' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(99,102,241,0.28)' },
              { offset: 1, color: 'rgba(99,102,241,0.01)' },
            ],
          },
        },
      },
    ],
  } as Record<string, unknown>;
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
    <div ref="barRef" class="h-20 w-full"></div>

    <!-- 一键开刷：数字再好看，点得进去才算「复习中心」 -->
    <UButton v-if="(data?.dueToday ?? 0) > 0" to="/?source=review" block size="lg" class="mt-4" icon="i-lucide-repeat">
      开始复习（{{ data?.dueToday }} 张到期）
    </UButton>

    <p class="mb-1 mt-4 text-xs text-slate-400">记忆保留率（每复习一次即被拉平）</p>
    <div ref="curveRef" class="h-20 w-full"></div>
  </div>
</template>
