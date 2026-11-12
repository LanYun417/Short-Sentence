<script setup lang="ts">
/**
 * 记忆星系：把用户学过的每个句子画成一颗星，按场景聚成星座。
 *
 * 坐标 / 颜色 / 亮度全部由后端 GET /client/questions/memory-galaxy 确定性下发，
 * 这里只负责绘制——保证 Web 与 Android 看到的是同一片星空，刷新也不会跳位。
 * 星空的深色画布是刻意的视觉主题（宇宙），与外层卡片的明暗主题无关。
 *
 * 视觉构成（Web 与 Android 两端同源）：
 * - 深空径向渐变 + 固定 seed 星尘 + 两团装饰星云；
 * - 每个场景一团星云（按记忆主色调着色）+ 未探索场景为虚线圈；
 * - 同一场景的星星按「绕质心角度」连成星座线，像真正的星图；
 * - 星 = 径向渐变光晕 + 实心核；毕业/大星额外带四角星芒；
 * - 偶发流星（尊重 prefers-reduced-motion）；
 * - 悬停星座显示该场景的复习概览，点击进入场景列表。
 */
import { computed, ref } from 'vue';

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

const { data } = await useSsrApi<MemoryGalaxy>('ss:memory-galaxy', '/client/questions/memory-galaxy');

const SIZE = 300;

const TONE: Record<string, string> = {
  gold: '#fbbf24',
  stable: '#7dd3fc',
  faded: '#fb923c',
};

/** 按 categoryId 分组的星星（含所属星座），下面画星座线/星云都用它。 */
const byCluster = computed(() => {
  const raw = data.value?.stars ?? [];
  const map = new Map<number, GalaxyStar[]>();
  for (const s of raw) {
    const list = map.get(s.categoryId) ?? [];
    list.push(s);
    map.set(s.categoryId, list);
  }
  return map;
});

/** 一个星座内占比最高的色调（星云与星座线用它着色）。 */
function dominantTone(stars: GalaxyStar[]): string {
  const count: Record<string, number> = {};
  for (const s of stars) count[s.tone] = (count[s.tone] ?? 0) + 1;
  return Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'stable';
}

const clusters = computed(() =>
  (data.value?.clusters ?? []).map((c) => {
    const ring = 12 + Math.min(26, c.starCount * 1.6);
    return {
      ...c,
      cx: c.x * SIZE,
      cy: c.y * SIZE,
      ring,
      tone: dominantTone(byCluster.value.get(c.categoryId) ?? []),
      lit: c.starCount > 0,
      labelY: Math.min(SIZE - 4, c.y * SIZE + ring + 10),
    };
  }),
);

/** 星座线：同场景星星绕质心按角度排序后连成折线（≥3 颗才连，两点连线没有意义）。 */
const constellationPaths = computed(() => {
  const out: Array<{ categoryId: number; d: string; color: string }> = [];
  for (const [categoryId, list] of byCluster.value) {
    if (list.length < 3) continue;
    const cx = list.reduce((sum, s) => sum + s.x * SIZE, 0) / list.length;
    const cy = list.reduce((sum, s) => sum + s.y * SIZE, 0) / list.length;
    const sorted = [...list].sort(
      (a, b) => Math.atan2(a.y * SIZE - cy, a.x * SIZE - cx) - Math.atan2(b.y * SIZE - cy, b.x * SIZE - cx),
    );
    const d = sorted
      .map((s, i) => `${i === 0 ? 'M' : 'L'}${(s.x * SIZE).toFixed(1)},${(s.y * SIZE).toFixed(1)}`)
      .join(' ');
    out.push({
      categoryId,
      d,
      color: TONE[dominantTone(list)] ?? TONE.stable,
    });
  }
  return out;
});

const stars = computed(() =>
  (data.value?.stars ?? []).map((s, i) => ({
    key: i,
    tone: s.tone,
    cx: s.x * SIZE,
    cy: s.y * SIZE,
    r: s.radius * 1.35,
    color: TONE[s.tone] ?? TONE.stable,
    /** 光晕半径：大星/毕业星光晕更明显 */
    haloR: s.radius * (s.tone === 'gold' || s.radius > 2.6 ? 3.4 : 2.4),
    opacity: 0.35 + s.brightness * 0.65,
    /** 四角星芒：毕业星或较大星才有 */
    sparkle: s.tone === 'gold' || s.radius > 2.8,
    delay: `${((s.x * 7 + s.y * 13) % 3).toFixed(2)}s`,
  })),
);

/** 背景星尘：固定 seed 生成，纯装饰，不参与记忆语义（与 Android 端同 seed 同算法）。 */
const dust = computed(() => {
  const out: Array<{ x: number; y: number; r: number; o: number }> = [];
  let seed = 20261108;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 70; i++) {
    out.push({ x: rnd() * SIZE, y: rnd() * SIZE, r: 0.35 + rnd() * 0.75, o: 0.12 + rnd() * 0.35 });
  }
  return out;
});

/** 悬停/点开的星座（展示该场景概览；点击进场景列表）。 */
const active = ref<(typeof clusters.value)[number] | null>(null);

function showTip(c: (typeof clusters.value)[number]): void {
  active.value = c;
}
function hideTip(): void {
  active.value = null;
}
function openScenes(): void {
  navigateTo('/scenes');
}
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

    <!-- 星空画布：悬停星座看概览，点击进场景列表 -->
    <div class="relative mt-4">
      <div class="overflow-hidden rounded-2xl bg-[#0b1020] ring-1 ring-slate-800/80">
        <svg viewBox="0 0 300 300" class="block w-full" role="img" aria-label="记忆星系：按场景聚合的记忆强度星空">
          <defs>
            <radialGradient id="memoryGalaxyBg" cx="50%" cy="45%" r="72%">
              <stop offset="0%" stop-color="#1b2450" />
              <stop offset="60%" stop-color="#111832" />
              <stop offset="100%" stop-color="#080c1a" />
            </radialGradient>
            <!-- 装饰星云：两团固定的紫/蓝云雾，增加纵深 -->
            <radialGradient id="memoryNebulaA">
              <stop offset="0%" stop-color="#6366f1" stop-opacity="0.16" />
              <stop offset="100%" stop-color="#6366f1" stop-opacity="0" />
            </radialGradient>
            <radialGradient id="memoryNebulaB">
              <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.12" />
              <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0" />
            </radialGradient>
            <!-- 每种色调一团星云渐变（按场景着色） -->
            <radialGradient v-for="(color, tone) in TONE" :id="`nebula-${tone}`" :key="tone">
              <stop offset="0%" :stop-color="color" stop-opacity="0.22" />
              <stop offset="55%" :stop-color="color" stop-opacity="0.07" />
              <stop offset="100%" :stop-color="color" stop-opacity="0" />
            </radialGradient>
            <!-- 星星光晕：径向渐变（比模糊滤镜便宜，且观感一致） -->
            <radialGradient v-for="(color, tone) in TONE" :id="`halo-${tone}`" :key="`halo-${tone}`">
              <stop offset="0%" :stop-color="color" stop-opacity="0.5" />
              <stop offset="45%" :stop-color="color" stop-opacity="0.14" />
              <stop offset="100%" :stop-color="color" stop-opacity="0" />
            </radialGradient>
          </defs>

          <rect width="300" height="300" fill="url(#memoryGalaxyBg)" />
          <!-- 装饰星云 + 星尘 -->
          <ellipse cx="58" cy="52" rx="90" ry="62" fill="url(#memoryNebulaA)" />
          <ellipse cx="248" cy="252" rx="86" ry="70" fill="url(#memoryNebulaB)" />
          <circle v-for="(d, i) in dust" :key="`d${i}`" :cx="d.x" :cy="d.y" :r="d.r" fill="#cbd5e1" :opacity="d.o" />

          <!-- 场景星云：按该星座的主色调着色，点亮才显示 -->
          <circle
            v-for="c in clusters"
            v-show="c.lit"
            :key="`n${c.categoryId}`"
            :cx="c.cx"
            :cy="c.cy"
            :r="c.ring * 1.8"
            :fill="`url(#nebula-${c.tone})`"
          />

          <!-- 星座线：同场景的星星连成的折线 -->
          <path
            v-for="line in constellationPaths"
            :key="`l${line.categoryId}`"
            :d="line.d"
            fill="none"
            :stroke="line.color"
            stroke-opacity="0.3"
            stroke-width="0.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <!-- 星座轮廓：点亮为实线圈、未探索为虚线圈；同时是悬停热区 -->
          <g
            v-for="c in clusters"
            :key="`c${c.categoryId}`"
            class="cluster-hit"
            @mouseenter="showTip(c)"
            @mouseleave="hideTip"
            @click="openScenes"
          >
            <circle
              :cx="c.cx"
              :cy="c.cy"
              :r="c.ring"
              fill="none"
              :stroke="c.lit ? '#60a5fa' : '#475569'"
              :stroke-opacity="c.lit ? 0.22 : 0.16"
              stroke-width="0.8"
              :stroke-dasharray="c.lit ? 'none' : '2 3'"
            />
            <circle :cx="c.cx" :cy="c.cy" :r="Math.max(c.ring, 10) + 6" fill="transparent" />
            <text
              :x="c.cx"
              :y="c.labelY"
              text-anchor="middle"
              font-size="7.5"
              :fill="c.lit ? '#cbd5e1' : '#475569'"
              :opacity="c.lit ? 0.9 : 0.65"
              style="stroke: #0b1020; stroke-width: 2px; paint-order: stroke"
            >
              {{ c.name }}
            </text>
          </g>

          <!-- 记忆星：径向渐变光晕 + 实心核 + 四角星芒 -->
          <g v-for="s in stars" :key="s.key" class="galaxy-star" :style="{ animationDelay: s.delay }">
            <circle :cx="s.cx" :cy="s.cy" :r="s.haloR" :fill="`url(#halo-${s.tone})`" />
            <path
              v-if="s.sparkle"
              :d="`M${s.cx},${s.cy - s.r * 3.2} L${s.cx + s.r * 0.7},${s.cy - s.r * 0.7} L${s.cx + s.r * 3.2},${s.cy} L${s.cx + s.r * 0.7},${s.cy + s.r * 0.7} L${s.cx},${s.cy + s.r * 3.2} L${s.cx - s.r * 0.7},${s.cy + s.r * 0.7} L${s.cx - s.r * 3.2},${s.cy} L${s.cx - s.r * 0.7},${s.cy - s.r * 0.7} Z`"
              :fill="s.color"
              opacity="0.75"
            />
            <circle :cx="s.cx" :cy="s.cy" :r="s.r" :fill="s.color" :opacity="s.opacity" />
          </g>

          <!-- 偶发流星 -->
          <line
            class="shooting-star"
            x1="0"
            y1="0"
            x2="26"
            y2="26"
            stroke="#e2e8f0"
            stroke-width="1"
            stroke-linecap="round"
          />

          <text v-if="stars.length === 0" x="150" y="150" text-anchor="middle" font-size="11" fill="#64748b">
            星空还是空的，去练第一句吧
          </text>
        </svg>
      </div>

      <!-- 星座悬停卡片 -->
      <div
        v-if="active"
        class="pointer-events-none absolute z-10 w-36 -translate-x-1/2 -translate-y-full rounded-xl bg-slate-900/95 px-3 py-2 text-left shadow-lg ring-1 ring-white/10"
        :style="{ left: `${(active.cx / 300) * 100}%`, top: `${(active.cy / 300) * 100 - 4}%` }"
      >
        <p class="truncate text-xs font-semibold text-slate-100">{{ active.name }}</p>
        <p class="mt-0.5 text-[10px] text-slate-400">
          已学 {{ active.starCount }} 句 · 毕业 {{ active.graduated }} · 待复习 {{ active.dueCount }}
        </p>
        <p class="mt-0.5 text-[10px] text-sky-400">点击进入场景列表 →</p>
      </div>
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
.cluster-hit {
  cursor: pointer;
}

.cluster-hit circle[fill='transparent'] {
  pointer-events: all;
}

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

/* 偶发流星：斜向划过 + 淡出，7.5s 一轮 */
.shooting-star {
  opacity: 0;
  transform-origin: 0 0;
  animation: shooting 7.5s ease-in infinite 2s;
}

@keyframes shooting {
  0% {
    opacity: 0;
    transform: translate(-40px, -40px);
  }

  4% {
    opacity: 0.9;
  }

  14% {
    opacity: 0;
    transform: translate(300px, 300px);
  }

  100% {
    opacity: 0;
    transform: translate(300px, 300px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .galaxy-star,
  .shooting-star {
    animation: none;
  }
}
</style>
