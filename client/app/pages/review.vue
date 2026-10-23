<script setup lang="ts">
/** 错题复习池页（路由 /review）。列表逻辑复用 SentenceLibraryList。 */
definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '错题复习池',
  description: '答错且到期的句子按间隔重复出现，滚动巩固。',
});
</script>

<template>
  <SentenceLibraryList mode="review" />
</template>
