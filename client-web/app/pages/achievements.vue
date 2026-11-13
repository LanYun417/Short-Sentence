<script setup lang="ts">
/**
 * 全部成就页（路由 /achievements）：按分类分组展示所有成就勋章。
 *
 * 从成长面板「全部」进入。私有页：不进 sitemap / 禁止抓取（nuxt.config.ts 已排除）。
 */
import { computed, ref, watch } from 'vue';
import type { GamifyAchievement, GamifyOverview } from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '全部成就',
  description: '查看你的全部成就勋章，按分类分组。',
});

const { data: overview } = await useSsrApi<GamifyOverview>('ss:gamify', '/client/gamify/overview');

/** 成就图标映射（与 GrowthPanel 的 ICON_MAP 保持一致，静态字面量保证被扫描打包）。 */
const ICON_MAP: Record<string, string> = {
  footprints: 'i-lucide-footprints',
  flame: 'i-lucide-flame',
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
  'list-ordered': 'i-lucide-list-ordered',
  zap: 'i-lucide-zap',
  'badge-check': 'i-lucide-badge-check',
  star: 'i-lucide-star',
  'calendar-days': 'i-lucide-calendar-days',
  sparkles: 'i-lucide-sparkles',
  flag: 'i-lucide-flag',
  'chevrons-up': 'i-lucide-chevrons-up',
  'users-round': 'i-lucide-users-round',
  handshake: 'i-lucide-handshake',
  route: 'i-lucide-route',
};

function iconOf(name: string): string {
  return ICON_MAP[name] ?? 'i-lucide-award';
}

/** 成就分类的展示名与排序（与后端 seed 的 category 对应）。 */
const CATEGORY_LABELS: Record<string, string> = {
  behavior: '日常行为',
  persist: '坚持打卡',
  explore: '探索发现',
  luck: '运气',
};
const CATEGORY_ORDER = ['behavior', 'persist', 'explore', 'luck'];

/** 筛选：全部 / 已解锁 / 未解锁。 */
const filter = ref<'all' | 'unlocked' | 'locked'>('all');

const FILTERS: Array<{ key: 'all' | 'unlocked' | 'locked'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'unlocked', label: '已解锁' },
  { key: 'locked', label: '未解锁' },
];

const filteredAchievements = computed(() => {
  const list = overview.value?.achievements ?? [];
  if (filter.value === 'unlocked') return list.filter((a) => a.unlocked);
  if (filter.value === 'locked') return list.filter((a) => !a.unlocked);
  return list;
});

const groupedAchievements = computed(() => {
  const list = filteredAchievements.value;
  const map = new Map<string, GamifyAchievement[]>();
  for (const a of list) {
    const c = a.category || 'other';
    const arr = map.get(c);
    if (arr) arr.push(a);
    else map.set(c, [a]);
  }
  const groups = [...map.entries()].map(([category, items]) => ({
    category,
    label: CATEGORY_LABELS[category] ?? '其他',
    items,
    unlocked: items.filter((i) => i.unlocked).length,
  }));
  groups.sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return groups;
});

const selected = ref<GamifyAchievement | null>(null);

/** 分类默认折叠，但第一个分类默认展开：记录展开中的分类 label。 */
const expanded = ref<Set<string>>(new Set<string>());

function toggleCategory(label: string): void {
  const next = new Set(expanded.value);
  if (next.has(label)) next.delete(label);
  else next.add(label);
  expanded.value = next;
}

// 数据就绪后默认展开第一个分类
watch(
  groupedAchievements,
  (groups) => {
    if (expanded.value.size === 0 && groups.length > 0) {
      expanded.value = new Set([groups[0].label]);
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6 sm:py-8">
    <header class="mb-5 flex items-center gap-2">
      <button
        type="button"
        class="grid size-8 place-items-center rounded-full transition hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="返回"
        @click="navigateTo('/profile')"
      >
        <UIcon name="i-lucide-chevron-left" class="h-5 w-5 text-slate-500" />
      </button>
      <div>
        <h1 class="flex items-center gap-1.5 text-lg font-bold text-slate-800 dark:text-slate-100">
          <UIcon name="i-lucide-trophy" class="h-5 w-5 text-amber-500" />
          全部成就
        </h1>
        <p v-if="overview" class="mt-0.5 text-xs text-slate-400">
          已解锁 {{ overview.unlockedAchievements }} / {{ overview.totalAchievements }}
        </p>
      </div>
    </header>

    <!-- 筛选：全部 / 已解锁 / 未解锁 -->
    <div v-if="overview" class="mb-4 flex gap-2">
      <button
        v-for="f in FILTERS"
        :key="f.key"
        type="button"
        class="rounded-full px-3 py-1.5 text-xs font-medium transition ring-1"
        :class="
          filter === f.key
            ? 'bg-sky-600 text-white ring-sky-600'
            : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700 dark:hover:bg-slate-800'
        "
        @click="filter = f.key"
      >
        {{ f.label }}
      </button>
    </div>

    <p v-if="!overview" class="py-16 text-center text-sm text-slate-400">加载中…</p>

    <div v-else-if="groupedAchievements.length === 0" class="py-16 text-center text-sm text-slate-400">
      该筛选下暂无成就
    </div>

    <div v-else class="space-y-6">
      <section
        v-for="group in groupedAchievements"
        :key="group.category"
        class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
      >
        <button
          type="button"
          class="flex w-full items-center gap-2 py-1"
          :aria-expanded="expanded.has(group.label)"
          @click="toggleCategory(group.label)"
        >
          <UIcon
            :name="expanded.has(group.label) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
            class="h-4 w-4 shrink-0 text-slate-400"
          />
          <h2 class="text-sm font-bold text-slate-800 dark:text-slate-100">{{ group.label }}</h2>
          <span class="text-[11px] tabular-nums text-slate-400">{{ group.unlocked }}/{{ group.items.length }}</span>
          <span class="h-px flex-1 bg-slate-100 dark:bg-slate-800"></span>
        </button>
        <ul v-show="expanded.has(group.label)" class="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
          <li v-for="item in group.items" :key="item.code">
            <button
              type="button"
              class="flex w-full items-center gap-3 py-3 text-left transition hover:opacity-80"
              :class="!item.unlocked && 'opacity-50'"
              @click="selected = item"
            >
              <span
                class="grid size-11 shrink-0 place-items-center rounded-xl"
                :class="
                  item.unlocked
                    ? 'bg-amber-50 text-amber-500 ring-1 ring-amber-200/70 dark:bg-amber-500/10 dark:ring-amber-500/20'
                    : 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600'
                "
              >
                <UIcon :name="iconOf(item.icon)" class="h-5 w-5" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {{ item.name }}
                </span>
                <span class="block truncate text-xs text-slate-400">{{ item.description }}</span>
              </span>
              <span
                class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium"
                :class="
                  item.unlocked
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                "
              >
                {{ item.unlocked ? `+${item.rewardXp} XP` : '未解锁' }}
              </span>
            </button>
          </li>
        </ul>
      </section>
    </div>

    <!-- 勋章详情弹窗 -->
    <div
      v-if="selected"
      class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      @click.self="selected = null"
    >
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
  </div>
</template>
