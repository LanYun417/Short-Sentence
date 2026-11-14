<script setup lang="ts">
/**
 * 复习页（路由 /review）：答错且到期的句子，按记忆曲线到期时间就近安排。
 * 列表复用 SentenceLibraryList（mode=review → /client/review）。
 *
 * 与 App 端「语句库 → 复习」Tab 同一口径；全量作答历史在 /history。
 */
definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '复习',
  description: '答错且到期的句子按记忆曲线安排，刷完这一轮，薄弱的句子就扎实一分。',
});
</script>

<template>
  <SentenceLibraryList mode="review" />
</template>
