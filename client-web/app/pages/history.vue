<script setup lang="ts">
/**
 * 学习记录页（路由 /history）：全量作答历史。
 * 列表复用 SentenceLibraryList（mode=history → /client/history）。
 *
 * 原实现曾挂在 /review 上，与「复习池」抢语义：个人中心写着「复习」的入口
 * 点进去却是历史记录，而真正的复习池始终没有露面。现在 /review 归复习，
 * 历史记录独立到此页，与 App 端「语句库」三 Tab（收藏/复习/历史）口径一致。
 */
definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '学习记录',
  description: '回顾你答过的每一句，按时间、对错、难度与场景筛选，滚动到底自动加载。',
});
</script>

<template>
  <SentenceLibraryList mode="history" />
</template>
