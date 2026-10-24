<script setup lang="ts">
/** 收藏夹页（路由 /favorites）。列表逻辑复用 SentenceLibraryList。 */
definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '我的收藏',
  description: '收藏的句子随时回看，支持按难度、场景和收藏时间范围筛选。',
});
</script>

<template>
  <SentenceLibraryList mode="favorites" />
</template>
