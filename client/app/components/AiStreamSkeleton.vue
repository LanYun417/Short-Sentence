<script setup lang="ts">
/**
 * AI 生成中的结构化骨架（场景造句 / 词根拆解共用）。
 * 为什么用骨架而不是把流式原文铺出来：这两个 Tab 的输出已是**单行 JSON**，
 * 原文对人类不可读；用与最终卡片同构的骨架占位，生成完直接「换上」真卡片。
 */
withDefaults(defineProps<{ /** 正文骨架行数 */ lines?: number }>(), { lines: 3 });
</script>

<template>
  <UCard :ui="{ body: 'p-5' }">
    <div class="space-y-3">
      <USkeleton class="h-7 w-2/3 rounded-lg" />
      <USkeleton class="h-4 w-24 rounded" />
      <USkeleton v-for="n in lines" :key="n" class="h-4 w-full rounded" />
    </div>
    <p class="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
      <UIcon name="i-lucide-loader-circle" class="h-3.5 w-3.5 animate-spin" />
      AI 正在生成…
    </p>
  </UCard>
</template>
