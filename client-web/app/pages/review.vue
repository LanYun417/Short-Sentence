<script setup lang="ts">
/**
 * 复习页（路由 /review）：先看今日复习计划，再看到期题列表。
 *
 * 计划卡的数据来自 /client/questions/review-plan，候选条件与「一键开刷」
 * 的 next(source=review) 完全一致——卡片显示 N 题，点进去就是这 N 题。
 * 列表复用 SentenceLibraryList（mode=review → /client/review）；全量作答历史在 /history。
 */
import type { ReviewPlan } from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '复习',
  description: '按遗忘曲线安排的今日复习计划：先补逾期，再巩固到期句子。',
});

const { data: plan } = await useSsrApi<ReviewPlan>('ss:review-plan', '/client/questions/review-plan', { limit: 10 });

/** 今日进度 = 已复习 / (已复习 + 待复习)，避免刷完后分母为 0。 */
const progress = computed(() => {
  const value = plan.value;
  if (!value) return 0;
  const denominator = value.completedToday + value.total;
  return denominator > 0 ? Math.min(100, Math.round((value.completedToday / denominator) * 100)) : 100;
});
</script>

<template>
  <div>
    <UCard v-if="plan && plan.total > 0" :ui="{ body: 'p-5' }" class="mb-4">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-repeat" class="h-4 w-4 text-sky-500" />
          <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">今日复习计划</span>
        </div>
      </template>

      <div class="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ plan.total }}</p>
          <p class="text-xs text-slate-400">到期待复习</p>
        </div>
        <div>
          <p class="text-2xl font-bold text-amber-500">{{ plan.overdue }}</p>
          <p class="text-xs text-slate-400">其中已逾期</p>
        </div>
        <div>
          <p class="text-2xl font-bold text-emerald-500">{{ plan.completedToday }}</p>
          <p class="text-xs text-slate-400">今天已复习</p>
        </div>
        <div class="ml-auto w-full sm:w-48">
          <div class="mb-1 flex justify-between text-xs text-slate-400">
            <span>今日进度</span>
            <span>{{ progress }}%</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div class="h-full rounded-full bg-sky-500 transition-all" :style="{ width: `${progress}%` }" />
          </div>
        </div>
      </div>

      <div v-if="plan.byCategory.length > 0" class="mt-4 flex flex-wrap gap-2">
        <span
          v-for="group in plan.byCategory.slice(0, 6)"
          :key="group.name"
          class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        >
          {{ group.name }} · {{ group.count }}
        </span>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <UButton to="/?source=review" icon="i-lucide-repeat" size="sm">一键开刷到期题</UButton>
        <UButton to="/weakness" variant="soft" icon="i-lucide-target" size="sm">查看弱点词根</UButton>
        <span class="self-center text-xs text-slate-400">建议一轮 {{ plan.suggestedLimit }} 题，刷完可继续</span>
      </div>
    </UCard>

    <SentenceLibraryList mode="review" />
  </div>
</template>
