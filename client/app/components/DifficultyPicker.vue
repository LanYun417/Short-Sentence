<script setup lang="ts">
/**
 * 题目难度选择（一体式分段控件）。
 *
 * 为什么不用三个 UButton 拼：`solid` / `soft` 的按钮组是典型的中后台观感，
 * 与本产品「渐变色块 + 圆角卡片」的语言不搭；三个独立按钮还容易被误读成三个并列操作。
 * 这里做成一个带底槽的分段控件：语义上是一组互斥选项（radiogroup），
 * 选中项用**该档专属的渐变**填充——色彩按难度递进（青绿 → 蓝紫 → 琥珀橙），
 * 既延续 Hero 的渐变语言，也让「进阶一档」在视觉上自解释。
 */
import { DIFFICULTIES } from '~/composables/useQuestionSession';

const model = defineModel<number>({ required: true });

/** 各档选中态的渐变与投影色（按难度递进：生长 → 上升 → 炽热）。 */
const TONES: Record<number, string> = {
  1: 'bg-linear-to-br from-emerald-400 to-teal-500 shadow-emerald-500/35',
  2: 'bg-linear-to-br from-sky-500 to-indigo-500 shadow-indigo-500/35',
  3: 'bg-linear-to-br from-amber-500 to-orange-500 shadow-orange-500/35',
};
</script>

<template>
  <div>
    <div class="mb-1.5 flex items-center justify-between">
      <span class="text-xs font-medium text-slate-400">题目难度</span>
      <span class="text-xs text-slate-400">可随时切换</span>
    </div>

    <div
      class="grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-100/80 p-1.5 ring-1 ring-slate-200/70 dark:bg-slate-800/60 dark:ring-slate-700/60"
      role="radiogroup"
      aria-label="题目难度"
    >
      <button
        v-for="level in DIFFICULTIES"
        :key="level.value"
        type="button"
        role="radio"
        :aria-checked="model === level.value"
        class="group flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-medium transition-all duration-300 active:scale-95"
        :class="
          model === level.value
            ? ['text-white shadow-md', TONES[level.value]]
            : 'text-slate-500 hover:bg-white hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-slate-200'
        "
        @click="model = level.value"
      >
        <UIcon
          :name="level.icon"
          class="h-4 w-4 transition-transform duration-300"
          :class="model === level.value ? 'scale-110' : 'group-hover:scale-110'"
        />
        {{ level.label }}
      </button>
    </div>
  </div>
</template>
