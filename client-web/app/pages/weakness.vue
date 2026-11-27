<script setup lang="ts">
/**
 * 弱点词根页（路由 /weakness）：近 30 天错题按词自动归类。
 *
 * 数据完全来自服务端（/client/questions/weakness）：功能词被过滤、释义取题库
 * 逐词释义、词根解析取词根词典；前端只做展示，不自己拆词或算错次。
 */
import type { WeaknessReport } from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '弱点词根',
  description: '把最近答错的句子按词归类，一眼看出哪几个词最该补。',
});

const { data: report } = await useSsrApi<WeaknessReport>('ss:weakness', '/client/questions/weakness', { limit: 30 });

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('zh-CN');
}
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">弱点词根</h1>
        <p class="mt-1 text-xs text-slate-400">
          近 {{ report?.windowDays ?? 30 }} 天答错 {{ report?.totalWrong ?? 0 }} 次，按错词归类
        </p>
      </div>
      <UButton to="/?source=review" size="sm" icon="i-lucide-repeat">去复习</UButton>
    </div>

    <div
      v-if="!report || report.items.length === 0"
      class="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
    >
      <UIcon name="i-lucide-target" class="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
      <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">最近没有需要补的词，继续保持！</p>
      <UButton to="/" class="mt-4" size="sm">去刷两句</UButton>
    </div>

    <div v-else class="space-y-3">
      <UCard v-for="item in report.items" :key="item.word" :ui="{ body: 'p-4' }">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-baseline gap-2">
              <span class="text-lg font-bold text-slate-800 dark:text-slate-100">{{ item.word }}</span>
              <span v-if="item.meaning" class="text-sm text-slate-500 dark:text-slate-400">{{ item.meaning }}</span>
            </div>
            <p v-if="item.rootAnalysis" class="mt-1 text-xs text-sky-600 dark:text-sky-400">
              {{ item.rootAnalysis }}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <span
              class="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
            >
              错 {{ item.wrongCount }} 次
            </span>
            <span class="text-xs text-slate-400">共 {{ item.totalCount }} 次</span>
          </div>
        </div>

        <div class="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div
            v-for="example in item.examples"
            :key="`${example.sentenceId}-${example.userAnswer}`"
            class="flex items-start gap-3"
          >
            <img
              v-if="example.imageUrl"
              :src="example.imageUrl"
              :alt="example.translationZh"
              class="h-14 w-20 shrink-0 rounded-lg object-cover"
            />
            <div class="min-w-0">
              <p class="text-sm text-slate-700 dark:text-slate-200">{{ example.translationZh }}</p>
              <p class="mt-0.5 text-xs text-slate-400">
                你的作答：{{ example.userAnswer || '（空）' }} · {{ formatDate(item.lastWrongAt) }}
              </p>
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
