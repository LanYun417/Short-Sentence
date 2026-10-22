<script setup lang="ts">
/** 收藏夹页（路由 /favorites）。列表逻辑复用 SentenceLibraryList。 */
definePageMeta({ middleware: ['auth'] });
</script>

<template>
  <SentenceLibraryList mode="favorites" />
</template>
