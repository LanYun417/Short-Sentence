<script setup lang="ts">
/**
 * 词根词条卡（词根词典 / AI 词根拆解**共用同一张卡**）。
 * 呈现：单词 + 音标 + 来源 + 释义 + 构件彩带（前缀/词根/后缀分色）+ 构词详解 + 同根词。
 *
 * 之所以抽成组件：AI 拆解页过去是一坨流式纯文本，用户要求「像词根字典那样结构清晰」。
 * 最彻底的做法就是让两边渲染**同一个组件**——数据同构（WordRootItem），呈现自然一致。
 */
import type { WordRootItem } from '~/types';

defineProps<{ item: WordRootItem }>();

/** 构件配色：前缀 / 词根 / 后缀三色区分。 */
const PART_CLASS: Record<string, string> = {
  prefix: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  root: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
  suffix: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
};

/** 构件类型中文名（彩带上多一行小字，避免「pt」这类缩写看不懂）。 */
const PART_LABEL: Record<string, string> = { prefix: '前缀', root: '词根', suffix: '后缀' };

/** 来源说明。 */
const SOURCE_LABEL: Record<string, string> = { daily: '每日入库', ai: 'AI 解析' };
</script>

<template>
  <UCard :ui="{ body: 'p-5' }">
    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h3 class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ item.word }}</h3>
      <span v-if="item.phonetic" class="font-mono text-sm text-sky-600 dark:text-sky-400">{{ item.phonetic }}</span>
      <UBadge v-if="SOURCE_LABEL[item.source]" color="neutral" variant="subtle" size="sm">
        {{ SOURCE_LABEL[item.source] }}
      </UBadge>
    </div>

    <p v-if="item.meaning" class="mt-1 text-sm text-slate-600 dark:text-slate-300">{{ item.meaning }}</p>

    <!-- 构件拆解 -->
    <div v-if="item.parts.length" class="mt-4 flex flex-wrap gap-2">
      <span
        v-for="part in item.parts"
        :key="`${part.type}-${part.text}`"
        class="rounded-xl px-2.5 py-1.5 text-sm"
        :class="PART_CLASS[part.type] ?? PART_CLASS.root"
      >
        <span class="mr-1 text-[11px] font-medium opacity-70">{{ PART_LABEL[part.type] ?? part.type }}</span>
        <span class="font-semibold">{{ part.text }}</span>
        <span class="ml-1 opacity-80">{{ part.meaning }}</span>
      </span>
    </div>

    <p v-if="item.explanation" class="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
      {{ item.explanation }}
    </p>

    <div v-if="item.related.length" class="mt-3 flex flex-wrap items-center gap-1.5">
      <span class="text-xs text-slate-400">同根词</span>
      <UBadge v-for="w in item.related" :key="w" color="neutral" variant="subtle" size="sm">{{ w }}</UBadge>
    </div>
  </UCard>
</template>
