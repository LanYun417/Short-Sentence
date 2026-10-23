<script setup lang="ts">
/**
 * 作答方式切换（滑块式分段控件）。
 *
 * 与难度选择器同一套视觉语言：一块底槽 + 一个平移滑块，切换时平滑滑过去。
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
  <div>
    <div class="mb-1.5 flex items-center justify-between">
      <span class="text-xs font-medium text-slate-400">作答方式</span>
      <span class="text-xs text-slate-400">可随时切换</span>
    </div>

    <div
      class="relative grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100/80 p-1.5 ring-1 ring-slate-200/70 dark:bg-slate-800/60 dark:ring-slate-700/60"
      role="radiogroup"
      aria-label="作答方式"
    >
      <!-- 滑块：宽 = 单格（底槽宽减左右内边距与一个间隙后二等分）。
           位移用 `calc(下标 * (100% + 0.375rem))`——transform 的百分比相对元素自身尺寸，
           所以 100% 恰好是「一格」，再加一个 gap（0.375rem = gap-1.5）就落在下一格起点。 -->
      <span
        aria-hidden="true"
        class="pointer-events-none absolute inset-y-1.5 left-1.5 w-[calc((100%-1.125rem)/2)] rounded-xl bg-linear-to-br from-sky-500 to-indigo-500 shadow-md shadow-indigo-500/30 transition-transform duration-300 ease-out"
        :style="{ transform: `translateX(calc(${activeIndex} * (100% + 0.375rem)))` }"
      />

      <button
        v-for="item in ANSWER_MODES"
        :key="item.value"
        type="button"
        role="radio"
        :aria-checked="model === item.value"
        class="relative z-10 flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-medium transition-colors duration-300"
        :class="
          model === item.value
            ? 'text-white'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
        "
        @click="model = item.value"
      >
        <UIcon :name="item.icon" class="h-4 w-4" />
        {{ item.label }}
      </button>
    </div>
  </div>
</template>
