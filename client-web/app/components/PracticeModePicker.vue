<script setup lang="ts">
/**
 * 作答方式切换（滑块式分段控件，紧凑版）。
 *
 * 与难度选择器同一套视觉语言：一块底槽 + 一个平移滑块，切换时平滑滑过去。
 * 现在常驻题卡顶栏、「换一题」右侧，所以是内联自适应宽度的小尺寸：
 * 极窄屏（<460px）只显图标，悬停 / 读屏靠 title 与 aria-label 补足语义。
 *
 * 两档之间没有「难度递进」的语义，所以用统一的品牌渐变，不按档换色。
 */
import { ANSWER_MODES, type AnswerMode } from '~/composables/useQuestionSession';

const model = defineModel<AnswerMode>({ required: true });

/** 当前档位下标（取值异常时兜底到第一档）。 */
const activeIndex = computed(() => {
  const index = ANSWER_MODES.findIndex((item) => item.value === model.value);
  return index < 0 ? 0 : index;
});
</script>

<template>
  <!-- p-1(0.5rem) + gap-1(0.25rem) = 0.75rem，滑块宽 = (100% - 0.75rem) / 2；
       位移用 `calc(下标 * (100% + 0.25rem))`——transform 的百分比相对元素自身尺寸，
       所以 100% 恰好是「一格」，再加一个 gap 就落在下一格起点。 -->
  <div
    class="relative inline-grid grid-cols-2 gap-1 rounded-lg bg-slate-100/80 p-1 ring-1 ring-slate-200/70 dark:bg-slate-800/60 dark:ring-slate-700/60"
    role="radiogroup"
    aria-label="作答方式"
  >
    <span
      aria-hidden="true"
      class="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.75rem)/2)] rounded-md bg-linear-to-br from-sky-500 to-indigo-500 shadow-md shadow-indigo-500/30 transition-transform duration-300 ease-out"
      :style="{ transform: `translateX(calc(${activeIndex} * (100% + 0.25rem)))` }"
    />

    <button
      v-for="item in ANSWER_MODES"
      :key="item.value"
      type="button"
      role="radio"
      :aria-checked="model === item.value"
      :aria-label="`作答方式：${item.label}`"
      :title="`作答方式：${item.label}`"
      class="relative z-10 flex items-center justify-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium transition-colors duration-300"
      :class="
        model === item.value
          ? 'text-white'
          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
      "
      @click="model = item.value"
    >
      <UIcon :name="item.icon" class="h-3.5 w-3.5" />
      <span class="hidden min-[460px]:inline">{{ item.label }}</span>
    </button>
  </div>
</template>
