<script setup lang="ts">
/**
 * 记忆星系：把用户学过的每个句子画成一颗星，按场景聚成星座。
 *
 * 坐标 / 颜色 / 亮度全部由后端 GET /client/questions/memory-galaxy 确定性下发，
 * 这里只负责绘制——保证 Web 与 Android 看到的是同一片星空，刷新也不会跳位。
 * 星空的深色画布是刻意的视觉主题（宇宙），与外层卡片的明暗主题无关。
 */
import { computed } from 'vue';

interface GalaxyStar {
  x: number;
  y: number;
  radius: number;
  brightness: number;
  tone: 'gold' | 'stable' | 'faded';
  categoryId: number;
}
interface GalaxyCluster {
  categoryId: number;
  name: string;
  nameEn: string | null;
  x: number;
  y: number;
  starCount: number;
  graduated: number;
  dueCount: number;
  avgStrength: number;
}
interface MemoryGalaxy {
  stars: GalaxyStar[];
  clusters: GalaxyCluster[];
  totalLearned: number;
  graduated: number;
  dueCount: number;
  litClusters: number;
  totalClusters: number;
}

const { data } = await useFetch<MemoryGalaxy>('/api/client/questions/memory-galaxy', {
  default: () => ({
    stars: [],
    clusters: [],
    totalLearned: 0,
    graduated: 0,
    dueCount: 0,
    litClusters: 0,
    totalClusters: 0,
  }),
});

const TONE: Record<string, string> = {
  gold: '#fbbf24',
  stable: '#7dd3fc',
  faded: '#fb923c',
};

const stars = computed(() =>
  (data.value?.stars ?? []).map((s, i) => ({
    key: i,
    cx: s.x * 300,
    cy: s.y * 300,
    r: s.radius * 1.35,
    color: TONE[s.tone] ?? TONE.stable,
    opacity: 0.35 + s.brightness * 0.65,
    halo: s.tone === 'gold' || s.radius > 2.6,
    delay: `${((s.x * 7 + s.y * 13) % 3).toFixed(2)}s`,
  })),
);

const clusters = computed(() =>
  (data.value?.clusters ?? []).map((c) => {
    const ring = 12 + Math.min(26, c.starCount * 1.6);
    return {
      ...c,
      cx: c.x * 300,
      cy: c.y * 300,
      ring,
      labelY: Math.min(294, c.y * 300 + ring + 10),
    };
  }),
);

/** 背景星尘：固定 seed 生成，纯装饰，不参与记忆语义。 */
const dust = computed(() => {
  const out: Array<{ x: number; y: number; r: number; o: number }> = [];
  let seed = 20261108;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 70; i++) {
    out.push({ x: rnd() * 300, y: rnd() * 300, r: 0.35 + rnd() * 0.75, o: 0.12 + rnd() * 0.35 });
  }
  return out;
});
</script>

<template>
  <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">记忆星系</h3>
      <span class="text-xs text-slate-400">每一句都是一颗星</span>
    </div>

    <div class="grid grid-cols-3 gap-2 text-center">
      <div>
        <div class="text-lg font-bold tabular-nums text-sky-600 dark:text-sky-400">
          {{ data?.litClusters ?? 0
          }}<span class="text-xs font-normal text-slate-400">/{{ data?.totalClusters ?? 0 }}</span>
        </div>
        <div class="text-[10px] text-slate-400">已点亮星座</div>
      </div>
      <div>
        <div class="text-lg font-bold tabular-nums text-amber-500">{{ data?.graduated ?? 0 }}</div>
        <div class="text-[10px] text-slate-400">毕业之星</div>
      </div>
      <div>
        <div class="text-lg font-bold tabular-nums text-orange-500">{{ data?.dueCount ?? 0 }}</div>
        <div class="text-[10px] text-slate-400">该复习了</div>
      </div>
    </div>

    <div class="mt-4 overflow-hidden rounded-xl bg-[#0b1020] ring-1 ring-slate-800/80">
      <svg viewBox="0 0 300 300" class="block w-full" role="img" aria-label="记忆星系：按场景聚合的记忆强度星空">
        <defs>
          <radialGradient id="memoryGalaxyBg" cx="50%" cy="45%" r="72%">
            <stop offset="0%" stop-color="#1b2450" />
            <stop offset="60%" stop-color="#111832" />
            <stop offset="100%" stop-color="#080c1a" />
          </radialGradient>
        </defs>
        <rect width="300" height="300" fill="url(#memoryGalaxyBg)" />

        <!-- 背景星尘 -->
        <circle v-for="(d, i) in dust" :key="`d${i}`" :cx="d.x" :cy="d.y" :r="d.r" fill="#cbd5e1" :opacity="d.o" />

        <!-- 星座轮廓：点亮为实线、未探索为虚线 -->
        <circle
          v-for="c in clusters"
          :key="`c${c.categoryId}`"
          :cx="c.cx"
          :cy="c.cy"
          :r="c.ring"
          fill="none"
          :stroke="c.starCount > 0 ? '#60a5fa' : '#475569'"
          :stroke-opacity="c.starCount > 0 ? 0.22 : 0.16"
          stroke-width="0.8"
          :stroke-dasharray="c.starCount > 0 ? 'none' : '2 3'"
        />
        <text
          v-for="c in clusters"
          :key="`t${c.categoryId}`"
          :x="c.cx"
          :y="c.labelY"
          text-anchor="middle"
          font-size="7.5"
          :fill="c.starCount > 0 ? '#94a3b8' : '#475569'"
          :opacity="c.starCount > 0 ? 0.95 : 0.65"
        >
          {{ c.name }}
        </text>

        <!-- 记忆星：外层光晕 + 实心核 -->
        <g v-for="s in stars" :key="s.key" class="galaxy-star" :style="{ animationDelay: s.delay }">
          <circle v-if="s.halo" :cx="s.cx" :cy="s.cy" :r="s.r * 2.4" :fill="s.color" opacity="0.13" />
          <circle :cx="s.cx" :cy="s.cy" :r="s.r" :fill="s.color" :opacity="s.opacity" />
        </g>

        <text v-if="stars.length === 0" x="150" y="150" text-anchor="middle" font-size="11" fill="#64748b">
          星空还是空的，去练第一句吧
        </text>
      </svg>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
      <span class="flex items-center gap-1.5"><i class="size-2 rounded-full bg-amber-400" />已毕业</span>
      <span class="flex items-center gap-1.5"><i class="size-2 rounded-full bg-sky-300" />记忆稳固</span>
      <span class="flex items-center gap-1.5"><i class="size-2 rounded-full bg-orange-400" />到期该复习</span>
      <span class="ml-auto">越亮越大 = 记得越牢</span>
    </div>
  </div>
</template>

<style scoped>
.galaxy-star {
  animation: galaxy-twinkle 3.6s ease-in-out infinite alternate;
}

@keyframes galaxy-twinkle {
  from {
    opacity: 0.72;
  }

  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .galaxy-star {
    animation: none;
  }
}
</style>
