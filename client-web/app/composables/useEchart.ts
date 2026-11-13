/**
 * echarts 挂载小助手（Nuxt 自动引入）。
 *
 * 职责：挂载时 init、ResizeObserver 自适应容器宽度、option getter 变化（含深色切换）重绘、
 * 卸载时 disconnect + dispose，避免内存泄漏。用法：
 *
 * ```ts
 * const el = ref<HTMLElement>();
 * useEchart(el, () => buildOption(...));
 * ```
 */
import { onBeforeUnmount, onMounted, type Ref } from 'vue';
import { watch } from 'vue';
import echarts from '~/utils/echarts';

export function useEchart(target: Ref<HTMLElement | undefined>, option: () => Record<string, unknown>): void {
  let chart: ReturnType<typeof echarts.init> | null = null;
  let ro: ResizeObserver | null = null;

  const render = (): void => {
    if (chart) chart.setOption(option(), true);
  };

  onMounted(() => {
    if (!target.value) return;
    chart = echarts.init(target.value);
    render();
    ro = new ResizeObserver(() => chart?.resize());
    ro.observe(target.value);
  });

  onBeforeUnmount(() => {
    ro?.disconnect();
    ro = null;
    chart?.dispose();
    chart = null;
  });

  // option getter 里读到的响应式依赖（如 isDark）变化时自动重绘
  watch(option, render, { deep: true });
}
