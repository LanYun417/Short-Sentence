<script setup lang="ts">
/**
 * 认证页布局（登录 / 注册）。
 *
 * 只做一件事：给页面一块**独占视口的全屏画布**，不渲染顶栏与底部 Tab。
 * 页面自己按 `h-dvh` 分栏，因此这里必须保证外层没有任何占位元素——
 * 之前两页用 `definePageMeta({ layout: false })` 想表达同一意图，但外壳写死在
 * app.vue 里，layout:false 根本去不掉，结果页面 `h-dvh` 比可用高度多出一个顶栏，
 * 内容底部被裁（品牌栏最后一项露一半）。
 */
</script>

<template>
  <div class="h-dvh overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <slot />
  </div>
</template>
