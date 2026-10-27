<script setup lang="ts">
/**
 * 留存漏斗图（注册 → 激活 → 打卡 → 领句签）。
 * 模块职责：把各阶段人数画成漏斗，标注相对上一阶段的转化率；跟随主题重绘。
 */
import { throttle } from 'lodash-es';

import echarts from '@/utils/echarts';
import { getChartPalette } from '@/utils/chartTheme';
import { useAppStore } from '@/store/modules/app';
import type { FunnelStage } from '@/types/api';

defineOptions({ name: 'FunnelChart' });

const props = defineProps<{
  /** 漏斗各阶段（按顺序，首阶段为基数） */
  stages: FunnelStage[];
}>();

/** 阶段配色（由深到浅，视觉上呈「收窄」趋势）。 */
const STAGE_COLORS = ['#2563eb', '#0891b2', '#0d9488', '#7c3aed'];

const appStore = useAppStore();
const chartRef = ref<HTMLDivElement>();
let chart: ReturnType<typeof echarts.init> | null = null;

/** 渲染图表 */
function render(): void {
  if (!chart) {
    return;
  }
  const palette = getChartPalette(appStore.dark);
  const rateByName = new Map(props.stages.map((stage) => [stage.name, stage.rate]));

  chart.setOption(
    {
      tooltip: {
        trigger: 'item',
        backgroundColor: palette.tooltipBg,
        borderColor: palette.tooltipBorder,
        textStyle: { color: palette.tooltipText },
        formatter: (params: { name: string; value: number }) =>
          `${params.name}<br/>${params.value} 人 · 转化 ${rateByName.get(params.name) ?? 0}%`,
      },
      series: [
        {
          type: 'funnel',
          left: '6%',
          right: '6%',
          top: 12,
          bottom: 12,
          minSize: '22%',
          gap: 2,
          sort: 'descending',
          label: {
            show: true,
            position: 'inside',
            color: '#fff',
            fontSize: 12,
            formatter: (params: { name: string; value: number }) =>
              `${params.name} ${params.value}（${rateByName.get(params.name) ?? 0}%）`,
          },
          itemStyle: { borderColor: palette.cardBg, borderWidth: 1 },
          data: props.stages.map((stage, index) => ({
            name: stage.name,
            value: stage.users,
            itemStyle: { color: STAGE_COLORS[index % STAGE_COLORS.length] },
          })),
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

watch(() => props.stages, render, { deep: true });
watch(() => [appStore.dark, appStore.primaryColor], render);
</script>

<template>
  <div ref="chartRef" class="w-full h-75" />
</template>
