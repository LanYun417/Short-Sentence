<script setup lang="ts">
/**
 * AI 私教页（路由 /ai-coach）：从「我的 → 成长面板」提为独立页面，
 * 由「功能」页顶部 AI 私教入口直达——画像 + 计划 + AI 点评都在一个页面里。
 *
 * 内容全部由 AiCoachCard 组件承载（规则画像始终可用、AI 点评可降级），
 * 这里只负责外壳（页头、SEO、鉴权），避免两处维护同一份逻辑。
 */
definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: 'AI 私教',
  description: '根据你的作答数据生成薄弱点画像与今日复习计划，还能听一句 AI 点评。',
});
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6 md:py-8">
    <!-- 页头：与 /features、/ipa 等二级页保持同一套视觉 -->
    <div class="anim-in mb-5 flex items-center gap-3">
      <span
        class="grid h-11 w-11 place-items-center rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/25"
      >
        <UIcon name="i-lucide-graduation-cap" class="h-6 w-6" />
      </span>
      <div>
        <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">AI 私教</h1>
        <p class="text-sm text-slate-400">按你的作答数据，排今天的复习计划</p>
      </div>
    </div>

    <div class="anim-in" style="animation-delay: 60ms">
      <AiCoachCard />
    </div>
  </div>
</template>
