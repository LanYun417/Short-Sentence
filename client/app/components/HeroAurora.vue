<script setup lang="ts">
/**
 * 今日进度 Hero 的「星光流体渐变」背景层（纯 CSS、零依赖）。
 *
 * - 流体：四团取用父级阶段色（--hero-from / --hero-via / --hero-to）的径向光斑，
 *   缓缓游动、互相交融，叠在底色之上形成 mesh 流动感；阶段升温时颜色随父级平滑过渡。
 * - 星光：散布的白色星点呼吸闪烁。
 *
 * 父级需为 .ss-hero（提供 --hero-* 变量）。减弱动效时由 main.css 媒体查询关闭动画，
 * 退化为静态光斑 + 微亮星点。星点位置固定，避免 SSR 与客户端随机不一致导致水合错位。
 */
// 星点：固定位置 / 尺寸 / 相位（确定性，不随机）
const STARS = [
  { x: 7, y: 18, s: 2, d: 0, dur: 3.6 },
  { x: 16, y: 62, s: 1.5, d: 1.2, dur: 4.4 },
  { x: 24, y: 33, s: 2.4, d: 2.1, dur: 3.2 },
  { x: 33, y: 78, s: 1.6, d: 0.6, dur: 5 },
  { x: 41, y: 22, s: 2, d: 3, dur: 4 },
  { x: 52, y: 55, s: 1.4, d: 1.8, dur: 4.8 },
  { x: 58, y: 14, s: 2.2, d: 0.3, dur: 3.4 },
  { x: 66, y: 70, s: 1.6, d: 2.6, dur: 5.2 },
  { x: 73, y: 38, s: 2, d: 1, dur: 3.8 },
  { x: 81, y: 20, s: 1.5, d: 3.4, dur: 4.6 },
  { x: 86, y: 60, s: 2.2, d: 0.9, dur: 3.5 },
  { x: 92, y: 33, s: 1.6, d: 2.3, dur: 5.4 },
  { x: 12, y: 44, s: 1.4, d: 1.5, dur: 4.2 },
  { x: 47, y: 84, s: 1.8, d: 0.4, dur: 4 },
  { x: 78, y: 82, s: 1.4, d: 2.8, dur: 5 },
  { x: 38, y: 48, s: 1.6, d: 1.1, dur: 4.4 },
] as const;
</script>

<template>
  <div class="pointer-events-none absolute inset-0 overflow-hidden">
    <!-- 流体光斑：四团不同阶段的色，缓慢游动交融 -->
    <div
      class="anim-blob-a absolute -left-10 -top-12 h-56 w-56 rounded-full opacity-60 blur-3xl"
      style="background: radial-gradient(circle at 50% 50%, var(--hero-from), transparent 70%)"
    />
    <div
      class="anim-blob-b absolute -right-12 -bottom-16 h-64 w-64 rounded-full opacity-55 blur-3xl"
      style="background: radial-gradient(circle at 50% 50%, var(--hero-via), transparent 70%)"
    />
    <div
      class="anim-blob-c absolute left-1/3 -bottom-10 h-52 w-52 rounded-full opacity-50 blur-3xl"
      style="background: radial-gradient(circle at 50% 50%, var(--hero-to), transparent 70%)"
    />
    <div
      class="anim-blob-a absolute right-1/4 -top-8 h-44 w-44 rounded-full opacity-45 blur-3xl"
      style="background: radial-gradient(circle at 50% 50%, #fff, transparent 70%); animation-delay: -7s"
    />

    <!-- 星光：白色星点呼吸闪烁 -->
    <span
      v-for="(star, i) in STARS"
      :key="i"
      class="ss-star absolute rounded-full bg-white"
      :style="{
        left: `${star.x}%`,
        top: `${star.y}%`,
        width: `${star.s}px`,
        height: `${star.s}px`,
        boxShadow: `0 0 ${star.s + 2}px rgba(255, 255, 255, 0.9)`,
        '--twk-dur': `${star.dur}s`,
        '--twk-delay': `${star.d}s`,
      }"
    />
  </div>
</template>
