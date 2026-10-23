<script setup lang="ts">
/**
 * AppScrollArea —— 内容区滚动容器（el-scrollbar 风格）。
 *
 * 为什么不用原生滚动条：
 * 1. WebKit 原生滚动条会**占用布局宽度**——从「无滚动条页面」切到「有滚动条页面」时
 *    内容会被挤动，产生页面抖动；
 * 2. 原生滚动条常驻可见，与产品极简基调不符。
 *
 * 方案：隐藏原生滚动条（Firefox 用 scrollbar-width:none，WebKit 用 ::-webkit-scrollbar），
 * 自绘一条**绝对定位（悬浮）**的细滚动条：默认透明，鼠标移入容器或滚动中淡入；
 * 绝对定位不参与布局，因此永远不挤内容。支持点击 / 拖拽轨道跳转，路由切换自动回顶。
 */
const viewportRef = useTemplateRef<HTMLElement>('viewport');
const trackRef = useTemplateRef<HTMLElement>('track');

const route = useRoute();

/** 内容是否超出容器（不超出则不渲染滚动条） */
const scrollable = ref(false);
/** 滚动条可见：鼠标移入容器或滚动中 */
const visible = ref(false);
/** 视口高度 / 内容高度（决定滑块长度） */
const ratio = ref(1);
/** 滚动进度 0 ~ 1（决定滑块位置） */
const progress = ref(0);

let hideTimer: ReturnType<typeof setTimeout> | 0 = 0;
let observer: ResizeObserver | null = null;

/** 重新测量（容器或内容尺寸变化时调用）。 */
function measure(): void {
  const vp = viewportRef.value;
  if (!vp) {
    return;
  }
  const { scrollHeight, clientHeight } = vp;
  scrollable.value = scrollHeight - clientHeight > 1;
  ratio.value = scrollHeight > 0 ? Math.min(1, clientHeight / scrollHeight) : 1;
}

/** 滚动中：更新进度，并让滚动条短暂显示后淡出。 */
function onScroll(): void {
  const vp = viewportRef.value;
  if (!vp) {
    return;
  }
  const max = vp.scrollHeight - vp.clientHeight;
  progress.value = max > 0 ? Math.min(1, Math.max(0, vp.scrollTop / max)) : 0;
  visible.value = true;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    visible.value = false;
  }, 700);
}

function onEnter(): void {
  visible.value = true;
}

function onLeave(): void {
  visible.value = false;
}

/** 点击 / 拖拽轨道：把点击位置映射为滚动位置。 */
function onTrackPointerDown(event: PointerEvent): void {
  const vp = viewportRef.value;
  const track = trackRef.value;
  if (!vp || !track) {
    return;
  }
  const rect = track.getBoundingClientRect();
  const max = vp.scrollHeight - vp.clientHeight;
  const apply = (clientY: number): void => {
    const r = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    vp.scrollTop = r * max;
  };
  apply(event.clientY);

  const onMove = (e: PointerEvent): void => apply(e.clientY);
  const onUp = (): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

/** 滑块样式：长度按内容比例（最小 8%），位置按滚动进度。 */
const thumbStyle = computed(() => {
  const heightPct = Math.max(8, Math.min(100, ratio.value * 100));
  return {
    height: `${heightPct}%`,
    top: `${progress.value * (100 - heightPct)}%`,
  };
});

onMounted(() => {
  measure();
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => measure());
    if (viewportRef.value) {
      observer.observe(viewportRef.value);
    }
    // 内容（首个子元素）尺寸变化也要重新测量，否则动态增高后滑块长度不更新
    const content = viewportRef.value?.firstElementChild;
    if (content) {
      observer.observe(content);
    }
  }
});

// 路由切换回到顶部（与后台管理一致）
watch(
  () => route.fullPath,
  () => {
    if (viewportRef.value) {
      viewportRef.value.scrollTop = 0;
    }
    progress.value = 0;
  },
);

onBeforeUnmount(() => {
  observer?.disconnect();
  clearTimeout(hideTimer);
});

defineExpose({
  /** 平滑回到顶部。 */
  scrollToTop(): void {
    viewportRef.value?.scrollTo({ top: 0, behavior: 'smooth' });
  },
});
</script>

<template>
  <div class="relative h-full overflow-hidden" @mouseenter="onEnter" @mouseleave="onLeave">
    <!-- 视口：原生滚动条已被 CSS 隐藏，仅保留滚动能力 -->
    <div ref="viewport" class="ss-viewport h-full w-full overflow-y-auto overscroll-contain" @scroll.passive="onScroll">
      <slot />
    </div>

    <!-- 自绘滚动条：绝对定位悬浮、不占布局宽度；默认透明，移入 / 滚动中淡入 -->
    <div
      v-show="scrollable"
      ref="track"
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
