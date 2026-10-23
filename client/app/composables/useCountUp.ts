/**
 * 数字滚动动画（rAF 实现，零第三方依赖）。
 *
 * 用于统计卡等「数字跳动」效果：目标值变化时从当前显示值平滑滚到目标值。
 * @param target 目标值（响应式 ref 或普通数字）
 * @param duration 动画时长（毫秒）
 */
import { computed, isRef, onScopeDispose, ref, watch, type Ref } from 'vue';

export function useCountUp(target: Ref<number> | number, duration = 900): Ref<number> {
  const targetRef = computed(() => (isRef(target) ? target.value : target));
  const display = ref(0);
  let raf = 0;

  function animateTo(to: number): void {
    if (typeof requestAnimationFrame === 'undefined') {
      display.value = to;
      return;
    }
    cancelAnimationFrame(raf);
    const from = display.value;
    const start = performance.now();
    const step = (now: number): void => {
      const p = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
      const eased = 1 - (1 - p) ** 3; // easeOutCubic
      display.value = Math.round(from + (to - from) * eased);
      if (p < 1) {
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
  }

  watch(
    targetRef,
    (to) => {
      animateTo(to);
    },
    { immediate: true },
  );

  onScopeDispose(() => cancelAnimationFrame(raf));

  return display;
}
