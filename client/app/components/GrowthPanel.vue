<script setup lang="ts">
/**
 * 成长面板（微游戏化）：XP / CEFR 等级、成就勋章墙、场景探索地图。
 * 数据来自 GET /client/gamify/overview（服务端权威、幂等发放）。
 */
import type { GamifyOverview } from '~/types';

const { data: overview } = await useSsrApi<GamifyOverview>('ss:gamify', '/client/gamify/overview');

/**
 * 成就图标映射：DB 存的是 lucide 名（不含前缀）。
 * 这里用**静态字面量**拼完整 `i-lucide-*`，确保 @nuxt/icon 构建期扫描进静态包
 * （动态 `i-lucide-${name}` 不会被扫描，会退化为运行时拉取）。
 */
const ICON_MAP: Record<string, string> = {
  footprints: 'i-lucide-footprints',
  flame: 'i-lucide-flame',
  fire: 'i-lucide-fire',
  trophy: 'i-lucide-trophy',
  target: 'i-lucide-target',
  award: 'i-lucide-award',
  bookmark: 'i-lucide-bookmark',
  map: 'i-lucide-map',
  globe: 'i-lucide-globe',
  'trending-up': 'i-lucide-trending-up',
};

/** 成就图标名（未知回退到奖章）。 */
function iconOf(name: string): string {
  return ICON_MAP[name] ?? 'i-lucide-award';
}
</script>

<template>
  <div v-if="overview" class="space-y-4">
    <!-- XP + 等级 -->
    <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80">
      <div class="flex items-center gap-4">
        <div
          class="anim-pop grid size-16 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-sky-500 to-indigo-600 text-xl font-black text-white shadow-lg shadow-indigo-500/25"
        >
          {{ overview.level.code }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-2">
            <span class="text-lg font-bold text-slate-900 dark:text-slate-50">{{ overview.level.name }}</span>
            <span class="text-sm tabular-nums text-slate-400">{{ overview.xp }} XP</span>
          </div>
          <div class="mt-2">
            <UProgress :model-value="overview.level.progress" size="sm" />
            <p class="mt-1 text-xs text-slate-400">
              {{ overview.level.next ? `距下一等级还需 ${overview.level.toNext} XP` : '已达最高等级 🎉' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 成就勋章墙 -->
    <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">成就勋章</h3>
        <span class="text-xs tabular-nums text-slate-400">
          {{ overview.unlockedAchievements }} / {{ overview.totalAchievements }}
        </span>
      </div>
      <div class="grid grid-cols-3 gap-3 sm:grid-cols-5">
        <div
          v-for="item in overview.achievements"
          :key="item.code"
          class="flex flex-col items-center gap-1.5 text-center"
          :class="!item.unlocked && 'opacity-40'"
          :title="`${item.name} · ${item.description}`"
        >
          <div
            class="grid size-12 place-items-center rounded-2xl transition"
            :class="
              item.unlocked
                ? 'bg-amber-50 text-amber-500 ring-1 ring-amber-200/70 dark:bg-amber-500/10 dark:ring-amber-500/20'
                : 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600'
            "
          >
            <UIcon :name="iconOf(item.icon)" class="h-6 w-6" />
          </div>
          <span class="text-xs font-medium text-slate-700 dark:text-slate-200">{{ item.name }}</span>
          <span class="line-clamp-2 text-[10px] leading-tight text-slate-400">{{ item.description }}</span>
        </div>
      </div>
    </div>

    <!-- 场景探索地图 -->
    <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">场景探索</h3>
        <span class="text-xs tabular-nums text-slate-400">
          {{ overview.unlockedScenes }} / {{ overview.totalScenes }}
        </span>
      </div>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div
          v-for="scene in overview.sceneMap"
          :key="scene.id"
          class="rounded-xl border p-3 transition"
          :class="
            scene.unlocked
              ? 'border-sky-200 bg-sky-50/50 dark:border-sky-500/20 dark:bg-sky-500/5'
              : 'border-dashed border-slate-200 opacity-60 dark:border-slate-700'
          "
        >
          <div class="flex items-center gap-2">
            <UIcon
              :name="scene.unlocked ? 'i-lucide-map-pin' : 'i-lucide-lock'"
              class="h-4 w-4"
              :class="scene.unlocked ? 'text-sky-500' : 'text-slate-400'"
            />
            <span class="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{{ scene.name }}</span>
          </div>
          <p class="mt-1 text-xs text-slate-400">
            {{ scene.unlocked ? `已练 ${scene.practicedCount} 句` : '未解锁' }}
          </p>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="py-10 text-center text-sm text-slate-400">成长数据加载中…</div>
</template>
