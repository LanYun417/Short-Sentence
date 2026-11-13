<script setup lang="ts">
/**
 * 认证页布局（登录 / 注册）。
 *
 * 只做一件事：给页面一块**没有顶栏与底部 Tab 的全屏画布**。
 * 这里不能再加 `overflow-hidden`——页面用 `min-h-dvh` 居中，内容比视口高时
 * 需要能正常的浏览器滚动（例如矮窗口 + 移动端键盘弹起）。
 *
 * 备注：此前两页用 `definePageMeta({ layout: false })` 想表达同一意图，但外壳写死在
 * app.vue 里，layout:false 根本去不掉，还会引发页面间 SPA 导航不渲染。
 */
</script>

<template>
  <div class="ss-auth-layout min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <slot />
    <!-- 认证页页脚同样展示备案号（备案要求登录页也可见） -->
    <SiteFooter class="mx-auto max-w-md px-4" />
  </div>
</template>
