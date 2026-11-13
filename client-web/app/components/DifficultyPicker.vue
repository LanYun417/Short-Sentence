<script setup lang="ts">
/**
 * 题目难度选择（滑块式分段控件）。
 *
 * 三档共用一块底槽，选中态由一个**绝对定位的滑块**承载：切换档位时滑块用
 * `translateX` 平滑滑到目标格（与个人中心 UTabs 的 pill 指示器、外壳底部 Tab
 * 是同一套手法）。
 *
 * 为什么手写滑块而不用 UTabs：UTabs 的 pill 变体只有**一个**指示器元素，
 * 而这里每档要各自的渐变（青绿 → 蓝紫 → 琥珀橙，按难度递进），
 * 单一指示器没法按档位换渐变，只能靠 hack 覆盖背景。
 *
 * 为什么不用三个 UButton：`solid` / `soft` 的按钮组是中后台观感，与产品
 * 「渐变色块 + 圆角卡片」的语言不搭，三个并列按钮也容易被误读成三个并列操作。
 */
import { DIFFICULTIES } from '~/composables/useQuestionSession';

const model = defineModel<number>({ required: true });

/**
 * 各档渐变的两个色标与投影色（按难度递进：生长 → 上升 → 炽热）。
 *
 * 用**色值**而不是 Tailwind 渐变类：渐变类一换就是整体替换，颜色只能硬切；
 * 交给 CSS 变量后，配合 main.css 里 `@property` 注册的同名属性，浏览器可以对
 * 色标插值，于是切换档位时渐变是平滑过渡的（同时位置也在滑动）。
 */
const TONE_FALLBACK = { from: '#34d399', to: '#14b8a6', shadow: 'rgb(16 185 129 / 35%)' };

const TONES: Record<number, typeof TONE_FALLBACK> = {
  // emerald-400 → teal-500
  1: TONE_FALLBACK,
  // sky-500 → indigo-500
  2: { from: '#0ea5e9', to: '#6366f1', shadow: 'rgb(99 102 241 / 35%)' },
  // amber-500 → orange-500
  3: { from: '#f59e0b', to: '#f97316', shadow: 'rgb(249 115 22 / 35%)' },
};

/** 当前档位下标（滑块位置由它决定；取值异常时兜底到第一档）。 */
const activeIndex = computed(() => {
  const index = DIFFICULTIES.findIndex((level) => level.value === model.value);
  return index < 0 ? 0 : index;
});

/** 滑块当前该用哪一档的色标。 */
const activeTone = computed(() => TONES[DIFFICULTIES[activeIndex.value]?.value ?? 1] ?? TONE_FALLBACK);
</script>

<template>
  <div>
    <div class="mb-1.5 text-xs font-medium text-slate-400">题目难度</div>

    <div
      class="relative grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-100/80 p-1.5 ring-1 ring-slate-200/70 dark:bg-slate-800/60 dark:ring-slate-700/60"
      role="radiogroup"
      aria-label="题目难度"
    >
      <!-- 滑块：宽度 = 单格宽（底槽宽减去左右内边距与两个间隙，再三等分）。
           位移用 `calc(下标 * (100% + 0.375rem))`——transform 的百分比相对元素**自身**尺寸，
           所以 100% 恰好是「一格」，再加一个 gap（0.375rem = gap-1.5）就落在下一格起点。
           渐变与位移的过渡都在 .ss-difficulty-slider 里（含 @property 色标插值）。 -->
      <span
        aria-hidden="true"
        class="ss-difficulty-slider pointer-events-none absolute inset-y-1.5 left-1.5 w-[calc((100%-1.5rem)/3)] rounded-xl"
        :style="{
          '--tone-from': activeTone.from,
          '--tone-to': activeTone.to,
          '--tone-shadow': activeTone.shadow,
          transform: `translateX(calc(${activeIndex} * (100% + 0.375rem)))`,
        }"
      />

      <button
        v-for="level in DIFFICULTIES"
        :key="level.value"
        type="button"
        role="radio"
        :aria-checked="model === level.value"
        class="relative z-10 flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-medium transition-colors duration-300"
        :class="
          model === level.value
            ? 'text-white'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
        "
        @click="model = level.value"
      >
        <UIcon :name="level.icon" class="h-4 w-4" />
        {{ level.label }}
      </button>
    </div>
  </div>
</template>
