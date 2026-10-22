<script setup lang="ts">
/**
 * 打卡海报（离屏渲染给 html2canvas）。
 * 内容：日期、连续天数、今日句数、代表句与场景图。
 */
import { posterHighlight } from '~/composables/usePoster';
import type { CheckinResult } from '~/types';

defineProps<{ checkin: CheckinResult }>();
</script>

<template>
  <div data-poster class="w-90 rounded-3xl bg-linear-to-br from-sky-500 to-indigo-600 p-6 text-white shadow-2xl">
    <div class="flex items-center justify-between text-sm opacity-90">
      <span>短句 · 每日英语</span>
      <span>{{ checkin.date }}</span>
    </div>

    <div class="mt-5 flex items-end gap-6">
      <div>
        <p class="text-5xl font-bold leading-none">{{ checkin.doneCount }}</p>
        <p class="mt-1 text-xs opacity-80">今日完成句数</p>
      </div>
      <div>
        <p class="text-5xl font-bold leading-none">{{ checkin.streak }}</p>
        <p class="mt-1 text-xs opacity-80">连续打卡（天）</p>
      </div>
    </div>

    <div v-if="posterHighlight(checkin)" class="mt-6 rounded-2xl bg-white/10 p-4 backdrop-blur">
      <p class="text-lg font-semibold leading-snug">{{ posterHighlight(checkin)?.sentenceEn }}</p>
      <p class="mt-1 text-sm opacity-80">{{ posterHighlight(checkin)?.translationZh }}</p>
    </div>

    <p class="mt-6 text-center text-xs opacity-70">每天 20 句，看图学地道英语</p>
  </div>
</template>
