<script setup lang="ts">
/**
 * 答题趋势折线图（答题数 / 答对数双系列）。
 * 与首页 TrendChart 同一套配色与自适应策略，只是多一条系列。
 */
import { throttle } from 'lodash-es';

import echarts from '@/utils/echarts';
import { GRID_AXIS_LABEL_FIT, getChartPalette, hexToRgba, verticalGradient } from '@/utils/chartTheme';
import { useAppStore } from '@/store/modules/app';
import type { AnswerTrend } from '@/types/api';

defineOptions({ name: 'AnswerTrendChart' });

const props = defineProps<{
  /** 趋势数据 */
  data: AnswerTrend;
}>();

/** 第二条系列（答对数）的固定色：绿色语义更直观 */
const CORRECT_COLOR = '#10b981';

const appStore = useAppStore();
const chartRef = ref<HTMLDivElement>();
let chart: ReturnType<typeof echarts.init> | null = null;

/** 渲染图表 */
function render(): void {
  if (!chart) {
    return;
  }
  const palette = getChartPalette(appStore.dark);
  const primary = appStore.primaryColor;

  chart.setOption(
    {
      tooltip: {
        trigger: 'axis',
        backgroundColor: palette.tooltipBg,
        borderColor: palette.tooltipBorder,
        textStyle: { color: palette.tooltipText },
        axisPointer: { type: 'line', lineStyle: { color: hexToRgba(primary, 0.4) } },
      },
      legend: {
        data: ['答题数', '答对数'],
        right: 0,
        top: 0,
        icon: 'roundRect',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: palette.textSecondary, fontSize: 12 },
      },
      grid: { left: 8, right: 16, top: 44, bottom: 8, ...GRID_AXIS_LABEL_FIT },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: props.data.dates,
        axisLine: { lineStyle: { color: palette.axisLine } },
        axisTick: { show: false },
        axisLabel: { color: palette.textSecondary, fontSize: 12, margin: 12 },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: palette.textSecondary, fontSize: 12 },
        splitLine: { lineStyle: { color: palette.splitLine, type: 'dashed' } },
      },
      series: [
        {
          name: '答题数',
          type: 'line',
          smooth: 0.4,
          symbol: 'circle',
          symbolSize: 8,
          showSymbol: false,
          lineStyle: { width: 3, color: primary },
          itemStyle: { color: primary, borderColor: palette.cardBg, borderWidth: 2 },
          emphasis: { focus: 'series' },
          areaStyle: { color: verticalGradient(hexToRgba(primary, 0.3), hexToRgba(primary, 0.02)) },
          data: props.data.answers,
        },
        {
          name: '答对数',
          type: 'line',
          smooth: 0.4,
          symbol: 'circle',
          symbolSize: 8,
          showSymbol: false,
          lineStyle: { width: 2, color: CORRECT_COLOR },
          itemStyle: { color: CORRECT_COLOR, borderColor: palette.cardBg, borderWidth: 2 },
          emphasis: { focus: 'series' },
          data: props.data.corrects,
        },
      ],
    },
    true,
  );
}

/** 自适应尺寸（限频，避免侧边栏折叠时高频重排） */
const resize = throttle(
  (): void => {
    chart?.resize();
  },
  100,
  { leading: true, trailing: true },
);

useResizeObserver(chartRef, resize);

onMounted(() => {
  if (chartRef.value) {
    chart = echarts.init(chartRef.value);
    render();
  }
});

onBeforeUnmount(() => {
  resize.cancel();
  chart?.dispose();
  chart = null;
});

watch(() => props.data, render, { deep: true });
watch(() => [appStore.dark, appStore.primaryColor], render);
</script>

<template>
  <div ref="chartRef" class="w-full h-75" />
</template>
