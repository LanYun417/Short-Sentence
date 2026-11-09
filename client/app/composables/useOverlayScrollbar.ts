/**
 * 悬浮滚动条核心逻辑（客户端所有滚动容器共用）。
 *
 * 设计口径（与最初 AppScrollArea 一致，抽出来是为了「所有滚动条长得一样」）：
 * - 原生滚动条隐藏（见 main.css 的 .ss-viewport），避免 WebKit 占布局宽度导致页面抖动；
 * - 自绘一条**绝对定位悬浮**的细条，不参与布局；
 * - 默认透明，鼠标移入容器或滚动中淡入，停止滚动 700ms 后淡出；
 * - 滑块长度按「视口 / 内容」比例（最小 8%），位置按滚动进度；
 * - 支持点击 / 拖拽轨道跳转；ResizeObserver 监听容器与内容尺寸变化。
 *
 * @param viewportRef 滚动视口（带 overflow:auto 的元素）
 * @param trackRef 自绘轨道元素
 * @param options.axis y 纵向（默认）/ x 横向
 */
import type { Ref } from 'vue';

export interface OverlayScrollbarOptions {
  axis?: 'y' | 'x';
  /** 停止滚动后多久淡出（毫秒） */
  hideDelay?: number;
}

export function useOverlayScrollbar(
  viewportRef: Ref<HTMLElement | null>,
  trackRef: Ref<HTMLElement | null>,
  options: OverlayScrollbarOptions = {},
) {
  const axis = options.axis ?? 'y';
  const hideDelay = options.hideDelay ?? 700;

  /** 内容是否超出容器（不超出则不渲染滚动条） */
  const scrollable = ref(false);
  /** 滚动条可见：鼠标移入容器或滚动中 */
  const visible = ref(false);
  /** 视口 / 内容比例（决定滑块长度） */
  const ratio = ref(1);
  /** 滚动进度 0 ~ 1（决定滑块位置） */
  const progress = ref(0);

  let hideTimer: ReturnType<typeof setTimeout> | 0 = 0;
  let observer: ResizeObserver | null = null;

  /** 当前轴的视口尺寸 / 内容尺寸 / 滚动位置。 */
  function metrics(): { view: number; content: number; offset: number } | null {
    const vp = viewportRef.value;
    if (!vp) return null;
    return axis === 'y'
      ? { view: vp.clientHeight, content: vp.scrollHeight, offset: vp.scrollTop }
      : { view: vp.clientWidth, content: vp.scrollWidth, offset: vp.scrollLeft };
  }

  /** 重新测量（容器或内容尺寸变化时调用）。 */
  function measure(): void {
    const m = metrics();
    if (!m) return;
    scrollable.value = m.content - m.view > 1;
    ratio.value = m.content > 0 ? Math.min(1, m.view / m.content) : 1;
    // 内容缩短后滚动位置可能回退，进度也要跟着更新
    const max = m.content - m.view;
    progress.value = max > 0 ? Math.min(1, Math.max(0, m.offset / max)) : 0;
  }

  /** 滚动中：更新进度，并让滚动条短暂显示后淡出。 */
  function onScroll(): void {
    const m = metrics();
    if (!m) return;
    const max = m.content - m.view;
    progress.value = max > 0 ? Math.min(1, Math.max(0, m.offset / max)) : 0;
    visible.value = true;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      visible.value = false;
    }, hideDelay);
  }

  function onEnter(): void {
    visible.value = true;
  }

  function onLeave(): void {
    visible.value = false;
  }

  /** 点击 / 拖拽轨道：把指针位置映射为滚动位置。 */
  function onTrackPointerDown(event: PointerEvent): void {
    const vp = viewportRef.value;
    const track = trackRef.value;
    if (!vp || !track) return;
    const rect = track.getBoundingClientRect();
    const m = metrics();
    if (!m) return;
    const max = m.content - m.view;
    if (max <= 0) return;

    const apply = (clientPos: number): void => {
      const start = axis === 'y' ? rect.top : rect.left;
      const size = axis === 'y' ? rect.height : rect.width;
      const r = Math.min(1, Math.max(0, (clientPos - start) / size));
      if (axis === 'y') vp.scrollTop = r * max;
      else vp.scrollLeft = r * max;
    };
    apply(axis === 'y' ? event.clientY : event.clientX);

    const onMove = (e: PointerEvent): void => apply(axis === 'y' ? e.clientY : e.clientX);
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  /** 滑块样式：长度按内容比例（最小 8%），位置按滚动进度。 */
  const thumbStyle = computed(() => {
    const pct = Math.max(8, Math.min(100, ratio.value * 100));
    return axis === 'y'
      ? { height: `${pct}%`, top: `${progress.value * (100 - pct)}%` }
      : { width: `${pct}%`, left: `${progress.value * (100 - pct)}%` };
  });

  /** 滚动到末尾（聊天场景发完消息后吸底）。 */
  function scrollToEnd(smooth = false): void {
    const vp = viewportRef.value;
    if (!vp) return;
    if (axis === 'y') vp.scrollTo({ top: vp.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    else vp.scrollTo({ left: vp.scrollWidth, behavior: smooth ? 'smooth' : 'auto' });
  }

  /** 回到顶部 / 最左。 */
  function scrollToStart(smooth = false): void {
    const vp = viewportRef.value;
    if (!vp) return;
    if (axis === 'y') vp.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
    else vp.scrollTo({ left: 0, behavior: smooth ? 'smooth' : 'auto' });
  }

  onMounted(() => {
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => measure());
      if (viewportRef.value) observer.observe(viewportRef.value);
      // 内容（首个子元素）尺寸变化也要重新测量，否则动态增高后滑块长度不更新
      const content = viewportRef.value?.firstElementChild;
      if (content) observer.observe(content);
    }
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    clearTimeout(hideTimer);
  });

  return {
    scrollable,
    visible,
    ratio,
    progress,
    thumbStyle,
    measure,
    onScroll,
    onEnter,
    onLeave,
    onTrackPointerDown,
    scrollToEnd,
    scrollToStart,
  };
}
