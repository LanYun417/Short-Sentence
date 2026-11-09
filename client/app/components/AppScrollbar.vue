<script setup lang="ts">
/**
 * AppScrollbar —— 通用悬浮滚动条容器（客户端所有局部滚动区统一用它）。
 *
 * 与页面主滚动区 AppScrollArea 共用同一套自绘逻辑（useOverlayScrollbar）：
 * 原生滚动条隐藏、自绘细条绝对定位不占布局、移入或滚动时淡入、可点击拖拽轨道。
 *
 * 用法：
 *   <AppScrollbar class="min-h-0 flex-1" viewport-class="space-y-3 p-3" ...>
 *     ...内容...
 *   </AppScrollbar>
 * 根元素 class 透传（决定组件在外部布局里的尺寸），viewport-class 决定视口外观。
 *
 * @example 聊天页消息区
 *   <AppScrollbar ref="scroller" class="min-h-0 flex-1" viewport-class="space-y-3 p-3">
 *   ...
 *   scroller.value?.scrollToEnd();
 */
import { useOverlayScrollbar } from '~/composables/useOverlayScrollbar';

const props = withDefaults(
  defineProps<{
    /** 滚动方向：y 纵向（默认）/ x 横向 */
    axis?: 'y' | 'x';
    /** 透传给视口的 class（内边距、圆角、背景等） */
    viewportClass?: string;
  }>(),
  { axis: 'y', viewportClass: '' },
);

const viewportRef = ref<HTMLElement | null>(null);
const trackRef = ref<HTMLElement | null>(null);

const {
  scrollable,
  visible,
  thumbStyle,
  canScrollStart,
  canScrollEnd,
  measure,
  onScroll,
  onEnter,
  onLeave,
  onTrackPointerDown,
  scrollToEnd,
  scrollToStart,
} = useOverlayScrollbar(viewportRef, trackRef, { axis: props.axis });

defineExpose({
  /** 滚到末尾（聊天发完消息后吸底） */
  scrollToEnd,
  /** 回到开头 */
  scrollToStart,
  /** 内容动态变化后重新测量滑块 */
  measure,
});
</script>

<template>
  <div class="relative overflow-hidden" @mouseenter="onEnter" @mouseleave="onLeave">
    <!-- 视口：原生滚动条由 .ss-viewport 隐藏，仅保留滚动能力 -->
    <div
      ref="viewportRef"
      class="ss-viewport h-full w-full overscroll-contain"
      :class="[axis === 'y' ? 'overflow-y-auto' : 'overflow-x-auto', viewportClass]"
      @scroll.passive="onScroll"
    >
      <slot />
    </div>

    <!-- 自绘滚动条：绝对定位悬浮、不占布局；默认透明，移入 / 滚动中淡入 -->
    <div
      v-show="scrollable"
      ref="trackRef"
      class="absolute z-10 touch-none rounded-full transition-opacity duration-200"
      :class="[
        axis === 'y' ? 'inset-y-1 right-1 w-1.5' : 'inset-x-1 bottom-1 h-1.5',
        visible ? 'opacity-100' : 'opacity-0',
      ]"
      :style="{ pointerEvents: visible ? 'auto' : 'none' }"
      @pointerdown="onTrackPointerDown"
    >
      <div
        class="absolute rounded-full bg-slate-400/45 transition-colors hover:bg-slate-500/70 dark:bg-slate-500/50 dark:hover:bg-slate-400/70"
        :class="axis === 'y' ? 'w-full' : 'h-full'"
        :style="thumbStyle"
      />
    </div>

    <!-- 边缘柔化：仅纵向、且仅当该侧还有被遮住的内容时，给个隐约的渐隐，避免生硬截断 -->
    <div
      v-if="axis === 'y' && canScrollStart"
      class="pointer-events-none absolute inset-x-0 top-0 z-[5] h-7 bg-gradient-to-b from-slate-50/95 to-transparent dark:from-slate-950/80"
    />
    <div
      v-if="axis === 'y' && canScrollEnd"
      class="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-7 bg-gradient-to-t from-slate-50/95 to-transparent dark:from-slate-950/80"
    />
  </div>
</template>
