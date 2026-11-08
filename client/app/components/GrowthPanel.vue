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
 *
 * ⚠️ 新增图标要三处同步：本表、`android/lib/theme/icon_map.dart`、后端种子
 * （`prisma/seed.service.ts`）。名字必须是 lucide 里**真实存在**的，
 * 否则 Web 端这枚勋章会画成空白（`fire` 就踩过这个坑）。
 */
const ICON_MAP: Record<string, string> = {
  footprints: 'i-lucide-footprints',
  flame: 'i-lucide-flame',
  // 旧的 'fire' 在 lucide 里并不存在（只有 flame / flame-kindling），保留映射只为止旧数据不空白
  fire: 'i-lucide-flame',
  'flame-kindling': 'i-lucide-flame-kindling',
  trophy: 'i-lucide-trophy',
  target: 'i-lucide-target',
  award: 'i-lucide-award',
  medal: 'i-lucide-medal',
  crown: 'i-lucide-crown',
  gem: 'i-lucide-gem',
  compass: 'i-lucide-compass',
  rocket: 'i-lucide-rocket',
  swords: 'i-lucide-swords',
  'notebook-pen': 'i-lucide-notebook-pen',
  'calendar-check': 'i-lucide-calendar-check',
  bookmark: 'i-lucide-bookmark',
  map: 'i-lucide-map',
  globe: 'i-lucide-globe',
  'trending-up': 'i-lucide-trending-up',
  // 排行榜配套成就图标（静态字面量，动态拼接不会被构建期打包）
  'list-ordered': 'i-lucide-list-ordered',
  zap: 'i-lucide-zap',
  'badge-check': 'i-lucide-badge-check',
  star: 'i-lucide-star',
  'calendar-days': 'i-lucide-calendar-days',
  sparkles: 'i-lucide-sparkles',
  // 首次上榜 / 十强（名次型成就）
  flag: 'i-lucide-flag',
  'chevrons-up': 'i-lucide-chevrons-up',
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
        <!-- 等级徽标显示具体名称（入门/基础/进阶/高阶/精通/母语级），
             不再显示 B1 这类 CEFR 代码——对用户没有意义。 -->
        <div
          class="anim-pop grid size-16 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/25"
        >
          <span class="font-black tracking-tight" :class="overview.level.name.length > 2 ? 'text-[15px]' : 'text-xl'">
            {{ overview.level.name }}
          </span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-1.5">
            <span class="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{{ overview.xp }}</span>
            <span class="text-sm font-medium text-slate-400">XP</span>
          </div>
          <div class="mt-2">
            <UProgress :model-value="overview.level.progress" size="sm" />
            <p class="mt-1 text-xs text-slate-400">
              {{
                overview.level.next
                  ? `距${overview.level.nextName ?? '下一等级'}还需 ${overview.level.toNext} XP`
                  : '已达最高等级 🎉'
              }}
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

      <MemoryHealthCard />
    </div>
  </div>

  <div v-else class="py-10 text-center text-sm text-slate-400">成长数据加载中…</div>
</template>
