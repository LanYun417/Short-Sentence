<script setup lang="ts">
/**
 * AI 场景造句结果卡：英文句子（主）+ IPA 音标 + 中文场景说明。
 * 与词根卡同一套语言：大号主内容、等宽音标、分隔线下的说明区。
 */
import type { AiExpandResult } from '~/types';

const props = defineProps<{ result: AiExpandResult }>();

/** 复制成功反馈（1.6s 后自动还原图标）。 */
const copied = ref(false);

async function copySentence(): Promise<void> {
  if (!props.result.sentence) {
    return;
  }
  try {
    await navigator.clipboard.writeText(props.result.sentence);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1600);
  } catch {
    // 剪贴板不可用（非安全上下文 / 无权限）：静默失败，不影响查看
  }
}
</script>

<template>
  <UCard :ui="{ body: 'p-5' }">
    <div class="flex items-start justify-between gap-3">
      <p class="text-lg font-semibold leading-snug text-slate-800 dark:text-slate-100">{{ result.sentence }}</p>
      <button
        type="button"
        class="shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-slate-800 dark:hover:text-sky-300"
        :aria-label="copied ? '已复制' : '复制句子'"
        :title="copied ? '已复制' : '复制句子'"
        @click="copySentence"
      >
        <UIcon :name="copied ? 'i-lucide-check' : 'i-lucide-copy'" class="h-4 w-4" />
      </button>
    </div>

    <p v-if="result.phonetic" class="mt-1 font-mono text-sm text-sky-600 dark:text-sky-400">{{ result.phonetic }}</p>

    <div v-if="result.note" class="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
      <p class="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{{ result.note }}</p>
    </div>
  </UCard>
</template>
