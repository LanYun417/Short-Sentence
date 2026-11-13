<script setup lang="ts">
/**
 * 旧「题库」页已并入「功能」页（/features 的「题库」Tab）。
 * 保留路由仅做兼容：历史书签与站内旧链接仍然可用，内容不再在此维护。
 */
definePageMeta({ middleware: ['auth'], redirect: '/features?tab=banks' });
</script>

<template>
  <div />
</template>
