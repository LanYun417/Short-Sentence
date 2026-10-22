<script setup lang="ts">
/** 错题复习池页（路由 /review）。列表逻辑复用 SentenceLibraryList。 */
definePageMeta({ middleware: ['auth'] });
</script>

<template>
  <SentenceLibraryList mode="review" />
</template>
