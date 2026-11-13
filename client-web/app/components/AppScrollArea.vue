<script setup lang="ts">
/**
 * AppScrollArea —— 页面主内容区滚动容器。
 *
 * 与 AppScrollbar / useOverlayScrollbar 共用同一套悬浮滚动条效果（客户端统一口径）：
 * 隐藏原生滚动条、自绘绝对定位细条、移入或滚动时淡入、可点击拖拽轨道。
 * 本组件额外负责：内容区撑满高度、路由切换自动回顶、对外暴露 scrollToTop。
 */
import { useOverlayScrollbar } from '~/composables/useOverlayScrollbar';

const viewportRef = ref<HTMLElement | null>(null);
const trackRef = ref<HTMLElement | null>(null);
const route = useRoute();

const { scrollable, visible, thumbStyle, onScroll, onEnter, onLeave, onTrackPointerDown, scrollToStart } =
  useOverlayScrollbar(viewportRef, trackRef, { axis: 'y' });

// 路由切换回到顶部（与后台管理一致）
watch(
  () => route.fullPath,
  () => {
    if (viewportRef.value) viewportRef.value.scrollTop = 0;
  },
);

defineExpose({
  /** 平滑回到顶部。 */
  scrollToTop(): void {
    scrollToStart(true);
  },
});
</script>

<template>
  <div class="relative h-full overflow-hidden" @mouseenter="onEnter" @mouseleave="onLeave">
    <!-- 视口：原生滚动条由 .ss-viewport 隐藏，仅保留滚动能力 -->
    <div
      ref="viewportRef"
      class="ss-viewport h-full w-full overflow-y-auto overscroll-contain"
      @scroll.passive="onScroll"
    >
      <slot />
    </div>

    <!-- 自绘滚动条：绝对定位悬浮、不占布局宽度；默认透明，移入 / 滚动中淡入 -->
    <div
      v-show="scrollable"
      ref="trackRef"
      class="absolute inset-y-1 right-1 z-10 w-1.5 touch-none rounded-full transition-opacity duration-200"
      :class="visible ? 'opacity-100' : 'opacity-0'"
      :style="{ pointerEvents: visible ? 'auto' : 'none' }"
      @pointerdown="onTrackPointerDown"
    >
      <div
        class="absolute w-full rounded-full bg-slate-400/45 transition-colors hover:bg-slate-500/70 dark:bg-slate-500/50 dark:hover:bg-slate-400/70"
        :style="thumbStyle"
      />
    </div>
  </div>
</template>
