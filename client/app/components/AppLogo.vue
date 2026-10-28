<script setup lang="ts">
/**
 * 品牌吉祥物（气泡小人）内联 SVG 组件。
 *
 * 瞳孔随鼠标移动转向光标方向——「眼睛跟手」。零依赖；SSR 安全：服务端渲染静止居中瞳孔，
 * 客户端挂载后才接管鼠标跟踪并用 rAF 缓动逼近，跨浏览器一致（不依赖 CSS 过渡 cx/cy）。
 * 系统开启「减弱动效」时自动关闭跟踪，回归静态图标。
 *
 * 用法：<AppLogo class="h-8 w-8" />（尺寸由外部 class 控制，viewBox 为 160×160 的方形图标区）。
 */
import { onBeforeUnmount, onMounted, ref, useId } from 'vue';
import { pupilOffset } from '~/utils/pupil';

withDefaults(
  defineProps<{
    /** 额外类名（通常传尺寸，如 h-8 w-8） */
    class?: string;
  }>(),
  {},
);

// 双眼在 viewBox(0 0 160 160) 中的中心；取中点作为朝向参考，两眼同向偏移更自然
const EYE_LEFT = { x: 62, y: 70 };
const EYE_RIGHT = { x: 98, y: 70 };
const REF = { x: (EYE_LEFT.x + EYE_RIGHT.x) / 2, y: (EYE_LEFT.y + EYE_RIGHT.y) / 2 };
const PUPIL_MAX = 4; // 瞳孔相对眼白偏移上限（viewBox 单位），保证瞳孔不越出眼白

// 响应式偏移（viewBox 单位），默认 0 = 静止居中
const ox = ref(0);
const oy = ref(0);
const target = { x: 0, y: 0 };

const svgEl = ref<SVGSVGElement | null>(null);
let raf = 0;
let reduced = false;

function onMove(e: MouseEvent): void {
  const svg = svgEl.value;
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  // 光标相对 SVG 左上角，换算到 viewBox(160×160) 坐标
  const mx = ((e.clientX - rect.left) / rect.width) * 160;
  const my = ((e.clientY - rect.top) / rect.height) * 160;
  const off = pupilOffset(mx, my, REF.x, REF.y, PUPIL_MAX);
  target.x = off.x;
  target.y = off.y;
}

function onOut(e: MouseEvent): void {
  // 光标移出窗口（relatedTarget 为空）时瞳孔回正
  if (!e.relatedTarget) {
    target.x = 0;
    target.y = 0;
  }
}

function tick(): void {
  ox.value += (target.x - ox.value) * 0.2;
  oy.value += (target.y - oy.value) * 0.2;
  raf = requestAnimationFrame(tick);
}

// 唯一 id 前缀，避免同页多实例时 <defs> 渐变 id 冲突（useId 为每实例提供 SSR 安全的稳定唯一值）
const uid = `ss-logo-${useId()}`;

onMounted(() => {
  reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (reduced) return;
  window.addEventListener('mousemove', onMove, { passive: true });
  document.addEventListener('mouseout', onOut);
  raf = requestAnimationFrame(tick);
});

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMove);
  document.removeEventListener('mouseout', onOut);
  if (raf) cancelAnimationFrame(raf);
});
</script>

<template>
  <svg
    ref="svgEl"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 160 160"
    :class="$props.class"
    role="img"
    aria-label="短句"
  >
    <defs>
      <linearGradient :id="`${uid}-main`" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3B82F6" />
        <stop offset="100%" stop-color="#06B6D4" />
      </linearGradient>
      <radialGradient :id="`${uid}-blush`" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FF8A8A" stop-opacity="0.8" />
        <stop offset="100%" stop-color="#FF8A8A" stop-opacity="0" />
      </radialGradient>
      <filter :id="`${uid}-shadow`" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.15" />
      </filter>
    </defs>

    <!-- 背景圆角方形 -->
    <rect x="0" y="0" width="160" height="160" rx="40" fill="#F0F9FF" />
    <!-- 气泡主体 -->
    <g :filter="`url(#${uid}-shadow)`">
      <path
        d="M 40 35 L 120 35 C 133 35 140 42 140 55 L 140 90 C 140 103 133 110 120 110 L 65 110 L 42 128 C 41 129 39 128 40 126 L 45 110 L 40 110 C 27 110 20 103 20 90 L 20 55 C 20 42 27 35 40 35 Z"
        :fill="`url(#${uid}-main)`"
      />
    </g>

    <!-- 腮红 -->
    <circle cx="55" cy="82" r="10" :fill="`url(#${uid}-blush)`" />
    <circle cx="105" cy="82" r="10" :fill="`url(#${uid}-blush)`" />

    <!-- 左眼：眼白 + 瞳孔 + 高光（瞳孔与高光随鼠标偏移） -->
    <circle cx="62" cy="70" r="10" fill="#FFFFFF" />
    <circle :cx="62 + ox" :cy="70 + oy" r="5" fill="#1E3A8A" />
    <circle :cx="60 + ox" :cy="68 + oy" r="2" fill="#FFFFFF" />

    <!-- 右眼 -->
    <circle cx="98" cy="70" r="10" fill="#FFFFFF" />
    <circle :cx="98 + ox" :cy="70 + oy" r="5" fill="#1E3A8A" />
    <circle :cx="96 + ox" :cy="68 + oy" r="2" fill="#FFFFFF" />

    <!-- 微笑 -->
    <path d="M 75 85 Q 80 92 85 85" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" />
  </svg>
</template>
