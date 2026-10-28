<script setup lang="ts">
/**
 * 今日进度 Hero 的「星光流体渐变」背景层（纯 CSS、零依赖）。
 *
 * - 流体：多团取用父级阶段色（--hero-from / --hero-via / --hero-to）的柔光球，
 *   各自以不同周期 / 相位 / 路径独立漂移 + 缩放，互相交融又分离，形成连续流动感
 *   （而非一整块纹理刚性的平移）。阶段升温时颜色随父级平滑过渡。
 *   只动 transform（合成层），模糊纹理一次栅格化后复用，滚动不重绘、不掉帧。
 * - 星光：星点被「流体」带着缓慢漂移（外圈：位移 + 末端淡出，循环无缝），
 *   同时自身呼吸闪烁（内圈：缩放 + 明暗）。
 *
 * 父级需为 .ss-hero（提供 --hero-* 变量）。减弱动效时由 main.css 媒体查询关闭动画，
 * 退化为静态柔光团 + 微亮星点。星点位置 / 流动参数均确定性派生，避免 SSR 与客户端
 * 随机不一致导致水合错位。
 */
// 星点：固定位置 / 尺寸 / 闪烁相位（确定性，不随机）
const BASE_STARS = [
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

// 流动参数：按索引确定性派生（不随机），每颗星的漂移距离 / 速度 / 相位错开，
// 整体形成一股缓慢上飘的「星流」，而不是齐步走。
const STARS = BASE_STARS.map((star, i) => ({
  ...star,
  fx: 40 + (i % 4) * 14, // 水平漂移 40 ~ 82px
  fy: -26 + (i % 3) * 13, // 垂直漂移 -26 ~ 0px（上飘为主）
  fdur: 8 + (i % 5) * 1.4, // 8 ~ 13.6s
  fd: -(i % 7) * 1.4, // 负延迟：开局即处于不同相位
}));
</script>

<template>
  <div class="pointer-events-none absolute inset-0 overflow-hidden">
    <!-- 流体 mesh：多团柔光球各自独立缓动、互相交融，形成连续流动的渐变
         （而非整屏刚性平移）。每团取用一个阶段色，模糊后叠加。 -->
    <div class="ss-hero-blobs absolute inset-0">
      <span class="ss-hero-blob ss-hero-blob--from" />
      <span class="ss-hero-blob ss-hero-blob--via" />
      <span class="ss-hero-blob ss-hero-blob--to" />
      <span class="ss-hero-blob ss-hero-blob--glow" />
    </div>

    <!-- 星光：外圈随流体漂移（位移 + 末端淡出），内圈原地呼吸闪烁 -->
    <span
      v-for="(star, i) in STARS"
      :key="i"
      class="ss-star-flow absolute"
      :style="{
        left: `${star.x}%`,
        top: `${star.y}%`,
        '--fx': `${star.fx}px`,
        '--fy': `${star.fy}px`,
        '--fdur': `${star.fdur}s`,
        '--fdelay': `${star.fd}s`,
      }"
    >
      <span
        class="ss-star block rounded-full bg-white"
        :style="{
          width: `${star.s}px`,
          height: `${star.s}px`,
          boxShadow: `0 0 ${star.s + 2}px rgba(255, 255, 255, 0.9)`,
          '--twk-dur': `${star.dur}s`,
          '--twk-delay': `${star.d}s`,
        }"
      />
    </span>
  </div>
</template>
