<script setup lang="ts">
/**
 * 情景闯关地图（路由 /stages）。
 *
 * 关卡 = 场景分类：每关有剧情引入、通关剧情与「累计答对 N 句」的通关线。
 * **每章首关默认解锁，章内顺序解锁**——四章是平行入口，不逼用户从第一关顺序刷到底。
 *
 * 进度来自 GET /client/stages，由独立的 study_stage_progress 表维护：
 * 不从答题记录派生，因为答题记录只保留 30 天，派生会让通关进度倒退、关卡重新上锁。
 *
 * 私有页：不进 sitemap / 禁止抓取（nuxt.config.ts 的 robots/sitemap 已排除）。
 */
import { computed, ref } from 'vue';
import { apiFetch } from '~/composables/useApi';
import type { StageClaimResult, StageOverview, StageView } from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '情景闯关',
  description: '把城市生活拆成十四个情景关卡，答对一个场景的句子，就往前走一段故事。',
});

const { data: overview, refresh } = await useFetch<StageOverview | null>('/api/client/stages', {
  default: () => null,
});

const chapters = computed(() => overview.value?.chapters ?? []);
const claiming = ref<number | null>(null);
const flash = ref('');

function toneOf(unlocked: boolean, cleared: boolean): string {
  if (cleared) return 'bg-emerald-500 text-white';
  if (unlocked) return 'bg-linear-to-br from-sky-500 to-indigo-600 text-white';
  return 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500';
}

/** 关卡图标：已通关打勾、未解锁上锁，其余用场景自己的图标。 */
function iconOf(stage: StageView): string {
  if (stage.cleared) return 'i-lucide-check';
  if (!stage.unlocked) return 'i-lucide-lock';
  return 'i-lucide-play';
}

async function claim(stage: StageView): Promise<void> {
  if (claiming.value !== null) return;
  claiming.value = stage.id;
  flash.value = '';
  try {
    const result = await apiFetch<StageClaimResult>(`/client/stages/${stage.id}/claim`, { method: 'POST' });
    flash.value = result.alreadyClaimed
      ? '这一关的奖励已经领过了'
      : result.awarded
        ? `领取成功，+${result.rewardXp} XP`
        : '今日经验已达上限，明天再来领取';
    await refresh();
  } catch (error) {
    flash.value = error instanceof Error ? error.message : '领取失败，请稍后重试';
  } finally {
    claiming.value = null;
  }
}

/** 去刷该场景：主刷题页按 category 参数限定范围。 */
async function goPractice(stage: StageView): Promise<void> {
  await navigateTo(`/?category=${stage.id}`);
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6 sm:py-8">
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
        一个场景就是一关。在该场景答对够数，故事就往前走一段——四章可以任选起点。
      </p>
      <p
        v-if="flash"
        class="mt-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
      >
        {{ flash }}
      </p>
    </header>

    <div v-if="!overview" class="py-16 text-center text-sm text-slate-400">正在加载关卡…</div>

    <template v-else>
      <section v-for="chapter in chapters" :key="chapter.key" class="mb-8 last:mb-0">
        <div class="mb-3 flex items-baseline justify-between gap-2">
          <h2 class="text-base font-bold text-slate-800 dark:text-slate-100">{{ chapter.name }}</h2>
          <span class="text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {{ chapter.clearedCount }} / {{ chapter.total }}
          </span>
        </div>
        <p class="mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{{ chapter.subtitle }}</p>

        <ol class="space-y-3">
          <li
            v-for="(stage, index) in chapter.stages"
            :key="stage.id"
            class="flex gap-3"
            :class="stage.unlocked ? '' : 'opacity-70'"
          >
            <!-- 时间轴：图标 + 向下的连线 -->
            <div class="flex w-10 shrink-0 flex-col items-center">
              <span
                class="grid size-10 shrink-0 place-items-center rounded-2xl shadow-sm"
                :class="toneOf(stage.unlocked, stage.cleared)"
              >
                <UIcon :name="iconOf(stage)" class="h-4 w-4" />
              </span>
              <span v-if="index < chapter.stages.length - 1" class="mt-1 w-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            <div
              class="min-w-0 flex-1 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-[11px] text-slate-400 dark:text-slate-500">
                    {{ stage.name }}
                    <span v-if="stage.nameEn"> · {{ stage.nameEn }}</span>
                  </p>
                  <h3 class="mt-0.5 text-sm font-bold text-slate-800 dark:text-slate-100">
                    {{ stage.title }}
                  </h3>
                </div>
                <span
                  v-if="stage.cleared"
                  class="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                >
                  已通关
                </span>
                <span
                  v-else-if="!stage.unlocked"
                  class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                >
                  未解锁
                </span>
              </div>

              <p class="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {{ stage.cleared ? stage.outro : stage.unlocked ? stage.intro : '通关上一关，这一页才会翻开。' }}
              </p>

              <!-- 进度：锁定关卡不显示，避免「怎么还差这么多」的挫败 -->
              <div v-if="stage.unlocked" class="mt-2.5 flex items-center gap-2">
                <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    class="h-full rounded-full transition-all duration-700"
                    :class="stage.cleared ? 'bg-emerald-500' : 'bg-sky-500'"
                    :style="{ width: `${stage.progress}%` }"
                  />
                </div>
                <span class="shrink-0 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {{ stage.correctCount }} / {{ stage.target }} 句
                </span>
              </div>

              <div class="mt-2.5 flex items-center justify-between gap-2">
                <span class="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  +{{ stage.rewardXp }} XP
                </span>

                <UButton
                  v-if="stage.cleared && !stage.claimed"
                  size="xs"
                  icon="i-lucide-gift"
                  :loading="claiming === stage.id"
                  @click="claim(stage)"
                >
                  领取奖励
                </UButton>
                <span v-else-if="stage.cleared" class="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  奖励已领取
                </span>
                <UButton
                  v-else-if="stage.unlocked && stage.bankCount > 0"
                  size="xs"
                  variant="soft"
                  trailing-icon="i-lucide-arrow-right"
                  @click="goPractice(stage)"
                >
                  去闯关
                </UButton>
                <span v-else-if="stage.unlocked" class="text-[11px] text-slate-400"> 该场景题目准备中 </span>
                <span v-else class="text-[11px] text-slate-400">通关上一关解锁</span>
              </div>
            </div>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>
