<script setup lang="ts">
/** 学习记录页（路由 /review）。列表逻辑复用 SentenceLibraryList，呈现全量作答历史。 */
definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '学习记录',
  description: '回顾你答过的每一句，按时间、对错、难度与场景筛选，滚动到底自动加载。',
});
</script>

<template>
  <SentenceLibraryList mode="history" />
</template>
