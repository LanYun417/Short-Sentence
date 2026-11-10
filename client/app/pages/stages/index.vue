<script setup lang="ts">
/**
 * 情景闯关地图（路由 /stages）——**章节封面墙**。
 *
 * 一章一张封面（渐变 + 大图标 + 导语 + 进度），点开进入 `/stages/chapter/:key`
 * 看这一章的关卡。关卡卡片本身有高度，全铺在地图上会把封面墙冲散，所以拆成两级：
 * 地图只负责「选章节」，关卡收在章节详情页（关卡随运营增加时也更可控）。
 *
 * 玩法：每关是一段**场景长对话**——用户扮演场景里的自己，和 1~3 个 AI 角色
 * 围绕目标把话聊完。聊够最少轮数且达成目标才通关；四章平行，章内顺序解锁。
 *
 * 进度来自 GET /client/stages（study_stage_progress.dialogueClearedAt），
 * 与答题记录完全解耦；旧版答对句数只作历史展示。
 *
 * 私有页：不进 sitemap / 禁止抓取（nuxt.config.ts 的 robots/sitemap 已排除，
 * `/stages/*` 同时覆盖章节详情页）。
 */
import { computed, onMounted } from 'vue';
import { apiFetch } from '~/composables/useApi';
import { chapterCoverOf } from '~/utils/stage-chapters';
import type { StageOverview, StageView } from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '情景闯关',
  description: '每一章是一段生活。进入真实场景，和里面的人用英语把一件事聊成。',
});

const { data: overview } = await useSsrApi<StageOverview>('ss:stages', '/client/stages');

onMounted(async () => {
  if (!overview.value) {
    overview.value = await apiFetch<StageOverview>('/client/stages').catch(() => null);
  }
});

const chapters = computed(() => overview.value?.chapters ?? []);
const allStages = computed<StageView[]>(() => chapters.value.flatMap((item) => item.stages));
/** 推荐关卡（第一个已解锁未通关）：给老用户一条「直奔当前关」的捷径。 */
const recommendedStage = computed<StageView | null>(
  () => allStages.value.find((item) => item.id === overview.value?.recommendedId) ?? null,
);
/** 第一个「已通关未领奖」的关卡（用于「N 关奖励待领取」提示的跳转目标）。 */
const firstClaimable = computed<StageView | null>(
  () => allStages.value.find((item) => item.cleared && !item.claimed) ?? null,
);
const firstClaimableChapter = computed<string | null>(() => {
  const stage = firstClaimable.value;
  if (!stage) return null;
  return chapters.value.find((item) => item.stages.some((s) => s.id === stage.id))?.key ?? null;
});
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-6 sm:py-8">
    <header class="mb-5">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-map" class="h-5 w-5 text-sky-500" />
          <h1 class="text-lg font-bold text-slate-800 dark:text-slate-100">情景闯关</h1>
        </div>
        <span v-if="overview" class="text-xs font-medium text-slate-500 dark:text-slate-400">
          已通关
          <b class="text-sky-600 dark:text-sky-400">{{ overview.clearedStages }}</b>
          / {{ overview.totalStages }}
        </span>
      </div>
      <p class="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        每一章是一段生活。点开封面进入章节，和场景里的人用英语把目标聊成，故事就往前走。
      </p>
      <p class="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-300">
        <UIcon name="i-lucide-languages" class="h-3 w-3" />
        对话里关掉「翻译」开关，通关时经验 +50%
      </p>

      <!-- 直奔当前推荐关；有奖励待领时给一条提示 -->
      <div class="mt-3 space-y-2">
        <NuxtLink
          v-if="recommendedStage"
          :to="`/stages/${recommendedStage.id}`"
          class="flex items-center gap-2.5 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 transition hover:ring-sky-300 dark:bg-slate-900 dark:ring-slate-800/80 dark:hover:ring-sky-500/40"
        >
          <span
            class="grid size-9 shrink-0 place-items-center rounded-xl bg-linear-to-br from-sky-500 to-indigo-600 text-white shadow-sm"
          >
            <UIcon name="i-lucide-play" class="h-4 w-4" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[11px] text-slate-400 dark:text-slate-500">
              {{ recommendedStage.activeSessionId ? '继续对话' : '当前推荐' }}
            </span>
            <span class="block truncate text-sm font-bold text-slate-800 dark:text-slate-100">
              {{ recommendedStage.title }}
            </span>
          </span>
          <span class="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
            {{ recommendedStage.progress }}%
          </span>
          <UIcon name="i-lucide-chevron-right" class="h-4 w-4 shrink-0 text-slate-400" />
        </NuxtLink>

        <NuxtLink
          v-if="overview && overview.claimable > 0 && firstClaimableChapter"
          :to="`/stages/chapter/${firstClaimableChapter}`"
          class="flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2.5 ring-1 ring-amber-200/70 transition hover:ring-amber-300 dark:bg-amber-950/30 dark:ring-amber-900/60"
        >
          <UIcon name="i-lucide-gift" class="h-4 w-4 shrink-0 text-amber-500" />
          <span class="min-w-0 flex-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            {{ overview.claimable }} 关奖励待领取，去 {{ firstClaimable?.title }} 领奖
          </span>
          <UIcon name="i-lucide-chevron-right" class="h-3.5 w-3.5 shrink-0 text-amber-500" />
        </NuxtLink>
      </div>
    </header>

    <div v-if="!overview" class="py-16 text-center text-sm text-slate-400">正在加载关卡…</div>

    <!-- 章节封面墙：一章一张，双列；章节多了就往下一排排，不会把页面拖长 -->
    <div v-else class="grid gap-3 sm:grid-cols-2">
      <NuxtLink
        v-for="chapter in chapters"
        :key="chapter.key"
        :to="`/stages/chapter/${chapter.key}`"
        class="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200/70 transition hover:ring-sky-300 dark:bg-slate-900 dark:ring-slate-800/80 dark:hover:ring-sky-500/40"
      >
        <!-- 封面：有 AI 生成图就用图，否则回落渐变 + 大图标；进度角标压在深色底上保证可读 -->
        <div
          class="relative flex aspect-[4/3] items-center justify-center overflow-hidden"
          :class="[chapterCoverOf(chapter.key).gradient, chapterCoverOf(chapter.key).gradientDark]"
        >
          <img
            v-if="chapter.coverUrl"
            :src="chapter.coverUrl"
            :alt="chapter.name"
            class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          <div
            v-if="chapter.coverUrl"
            class="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10"
          />
          <span
            v-if="!chapter.coverUrl"
            class="text-5xl drop-shadow-sm transition-transform duration-300 group-hover:scale-110"
            aria-hidden="true"
          >
            {{ chapterCoverOf(chapter.key).emoji }}
          </span>
          <span
            class="absolute right-2.5 top-2.5 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm"
          >
            {{ chapter.clearedCount }} / {{ chapter.total }}
          </span>
          <span
            v-if="chapter.total > 0 && chapter.clearedCount === chapter.total"
            class="absolute left-2.5 top-2.5 inline-flex items-center gap-0.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
          >
            <UIcon name="i-lucide-check" class="h-3 w-3" />已通关
          </span>
          <span class="absolute bottom-2.5 left-2.5 text-[11px] font-medium text-white/85">
            {{ chapter.total }} 个场景
          </span>
        </div>

        <!-- 章节文案 -->
        <div class="p-3.5">
          <div class="flex items-baseline justify-between gap-2">
            <h2 class="min-w-0 truncate text-sm font-bold text-slate-800 dark:text-slate-100">
              {{ chapter.name }}
            </h2>
          </div>
          <p class="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {{ chapter.subtitle }}
          </p>
          <div class="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400">
            查看章节
            <UIcon
              name="i-lucide-chevron-right"
              class="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
            />
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
