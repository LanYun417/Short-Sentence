<script setup lang="ts">
/** 收藏夹页（路由 /favorites）。列表逻辑复用 SentenceLibraryList。 */
definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '我的收藏',
  description: '收藏的句子随时回看，按收藏时间倒序排列。',
});
</script>

<template>
  <SentenceLibraryList mode="favorites" />
</template>
