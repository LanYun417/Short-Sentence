<script setup lang="ts">
/**
 * 成长面板（微游戏化）：XP / CEFR 等级、成就勋章墙、场景探索地图。
 * 数据来自 GET /client/gamify/overview（服务端权威、幂等发放）。
 */
import { computed, ref } from 'vue';
import type { GamifyAchievement, GamifyOverview } from '~/types';

const { data: overview } = await useSsrApi<GamifyOverview>('ss:gamify', '/client/gamify/overview');

/** 首页勋章墙展示的个数（其余进「全部」页），图标-only 布局一行即可放下很多。 */
const VISIBLE_ACHIEVEMENTS = 9;
const visibleAchievements = computed(() => overview.value?.achievements.slice(0, VISIBLE_ACHIEVEMENTS) ?? []);

/** 首页场景探索预览的个数（其余进「查看全部」/scenes 页，不用横向滚动）。 */
const PREVIEW_SCENES = 6;
const previewScenes = computed(() => overview.value?.sceneMap.slice(0, PREVIEW_SCENES) ?? []);
/** 点开某枚勋章看详情（首页勋章墙点开用）。「全部」入口跳转 /achievements 页。 */
const selected = ref<GamifyAchievement | null>(null);

/**
 * 成就图标映射：DB 存的是 lucide 名（不含前缀）。
 * 这里用**静态字面量**拼完整 `i-lucide-*`，确保 @nuxt/icon 构建期扫描进静态包
 * （动态 `i-lucide-${name}` 不会被扫描，会退化为运行时拉取）。
 *
 * ⚠️ 新增图标要三处同步：本表、`client-android/lib/theme/icon_map.dart`、后端种子
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
  // 弱连接小队成就（与后端种子、Android icon_map.dart 三处同步）
  'users-round': 'i-lucide-users-round',
  handshake: 'i-lucide-handshake',
  // 情景闯关成就（map 已在上面映射过；与后端种子、Android icon_map.dart 三处同步）
  route: 'i-lucide-route',
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

    <!-- 学习小队：放在成长页靠前位置，「就差你啦」是最强的即时行动召唤 -->
    <TeamCard />

    <!-- 情景闯关：给「下一步练什么」一个带剧情的答案（关卡 = 场景） -->
    <StageCard />

    <!-- 成就勋章墙：紧凑图标格（点开看详情），超过 VISIBLE_ACHIEVEMENTS 的收进「全部」弹窗 -->
    <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">成就勋章</h3>
        <div class="flex items-center gap-2.5">
          <span class="text-xs tabular-nums text-slate-400">
            {{ overview.unlockedAchievements }} / {{ overview.totalAchievements }}
          </span>
          <button
            v-if="overview.achievements.length > VISIBLE_ACHIEVEMENTS"
            type="button"
            class="text-xs font-medium text-sky-600 transition hover:underline dark:text-sky-400"
            @click="navigateTo('/achievements')"
          >
            全部
          </button>
        </div>
      </div>
      <div class="grid grid-cols-6 gap-3 sm:grid-cols-9">
        <button
          v-for="item in visibleAchievements"
          :key="item.code"
          type="button"
          class="group grid place-items-center"
          :title="`${item.name} · ${item.description}`"
          :aria-label="item.name"
          @click="selected = item"
        >
          <span
            class="grid size-11 place-items-center rounded-xl transition group-active:scale-90"
            :class="
              item.unlocked
                ? 'bg-amber-50 text-amber-500 ring-1 ring-amber-200/70 dark:bg-amber-500/10 dark:ring-amber-500/20'
                : 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600'
            "
          >
            <UIcon :name="iconOf(item.icon)" class="h-5 w-5" />
          </span>
        </button>
      </div>
    </div>

    <!-- 场景探索地图 -->
    <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">场景探索</h3>
        <div class="flex items-center gap-2.5">
          <span class="text-xs tabular-nums text-slate-400">
            {{ overview.unlockedScenes }} / {{ overview.totalScenes }}
          </span>
          <button
            v-if="overview.sceneMap.length > PREVIEW_SCENES"
            type="button"
            class="text-xs font-medium text-sky-600 transition hover:underline dark:text-sky-400"
            @click="navigateTo('/scenes')"
          >
            查看全部
          </button>
        </div>
      </div>
      <!-- 预览前 6 个场景；全部场景进 /scenes 页，不用横向滚动 -->
      <div class="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        <div
          v-for="scene in previewScenes"
          :key="scene.id"
          class="rounded-xl border p-2.5 transition"
          :class="
            scene.unlocked
              ? 'border-sky-200 bg-sky-50/50 dark:border-sky-500/20 dark:bg-sky-500/5'
              : 'border-dashed border-slate-200 opacity-60 dark:border-slate-700'
          "
        >
          <div class="flex items-center gap-1.5">
            <UIcon
              :name="scene.unlocked ? 'i-lucide-map-pin' : 'i-lucide-lock'"
              class="h-4 w-4 shrink-0"
              :class="scene.unlocked ? 'text-sky-500' : 'text-slate-400'"
            />
            <span class="truncate text-[11px] font-medium text-slate-700 dark:text-slate-200">{{ scene.name }}</span>
          </div>
          <p class="mt-1 text-[9px] text-slate-400">
            {{ scene.unlocked ? `已练 ${scene.practicedCount} 句` : '未解锁' }}
          </p>
        </div>
      </div>
    </div>

    <!-- 周学习报告：把这一周的努力变成一张看得懂、可分享的卡 -->
    <WeeklyReportCard />

    <!-- 记忆巩固独立成卡，与上方「场景探索」卡片之间由外层 space-y 留出间隙 -->
    <MemoryHealthCard />

    <!-- AI 私教：把上面的记忆数据变成「今天具体练什么」，规则层始终可用 -->
    <AiCoachCard />
  </div>

  <div v-else class="py-10 text-center text-sm text-slate-400">成长数据加载中…</div>

  <!-- 勋章详情弹窗 -->
  <div v-if="selected" class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" @click.self="selected = null">
    <div
      class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800"
    >
      <div class="flex flex-col items-center text-center">
        <span
          class="grid size-16 place-items-center rounded-2xl"
          :class="
            selected.unlocked
              ? 'bg-amber-50 text-amber-500 ring-1 ring-amber-200/70 dark:bg-amber-500/10 dark:ring-amber-500/20'
              : 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600'
          "
        >
          <UIcon :name="iconOf(selected.icon)" class="h-8 w-8" />
        </span>
        <h3 class="mt-3 text-base font-bold text-slate-800 dark:text-slate-100">{{ selected.name }}</h3>
        <p class="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{{ selected.description }}</p>
        <div class="mt-3 flex items-center gap-2">
          <span
            class="rounded-full px-2.5 py-1 text-[11px] font-medium"
            :class="
              selected.unlocked
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
            "
          >
            {{ selected.unlocked ? '已解锁' : '未解锁' }}
          </span>
          <span
            class="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:bg-amber-500/10 dark:text-amber-300"
          >
            +{{ selected.rewardXp }} XP
          </span>
        </div>
      </div>
      <UButton class="mt-4 w-full" color="neutral" variant="outline" @click="selected = null">关闭</UButton>
    </div>
  </div>
</template>
