<script setup lang="ts">
/**
 * 情景闯关地图（路由 /stages）。
 *
 * 玩法：每关是一段**场景长对话**——用户扮演场景里的自己，和 1~3 个 AI 角色
 * 围绕目标把话聊完。聊够最少轮数且达成目标才通关；四章平行，章内顺序解锁。
 *
 * 进度来自 GET /client/stages（study_stage_progress.dialogueClearedAt），
 * 与答题记录完全解耦；旧版答对句数只作历史展示。
 *
 * 私有页：不进 sitemap / 禁止抓取（nuxt.config.ts 的 robots/sitemap 已排除）。
 */
import { computed, onMounted, ref } from 'vue';
import { apiFetch } from '~/composables/useApi';
import type { StageClaimResult, StageOverview, StageView } from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '情景闯关',
  description: '进入真实生活场景，和里面的人用英语把一件事聊成。',
});

const { data: overview, refresh } = await useSsrApi<StageOverview>('ss:stages', '/client/stages');

onMounted(async () => {
  if (!overview.value) {
    overview.value = await apiFetch<StageOverview>('/client/stages').catch(() => null);
  }
});

const chapters = computed(() => overview.value?.chapters ?? []);
const claiming = ref<number | null>(null);
const flash = ref('');

function toneOf(unlocked: boolean, cleared: boolean): string {
  if (cleared) return 'bg-emerald-500 text-white';
  if (unlocked) return 'bg-linear-to-br from-sky-500 to-indigo-600 text-white';
  return 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500';
}

function iconOf(stage: StageView): string {
  if (stage.cleared) return 'i-lucide-check';
  if (!stage.unlocked) return 'i-lucide-lock';
  return 'i-lucide-message-circle';
}

/** 进入（或继续）这一关的场景对话。 */
async function enter(stage: StageView): Promise<void> {
  if (!stage.unlocked) return;
  await navigateTo(`/stages/${stage.id}`);
}

/** 领取通关奖励（幂等，重复领取由后端兜底）。 */
async function claim(stage: StageView): Promise<void> {
  if (claiming.value !== null) return;
  claiming.value = stage.id;
  flash.value = '';
  try {
    const result = await apiFetch<StageClaimResult>(`/client/stages/${stage.id}/claim`, { method: 'POST' });
    const bonusPart = result.bonusXp > 0 ? `（无翻译加成 +${result.bonusXp}）` : '';
    flash.value = result.alreadyClaimed
      ? '这一关的奖励已经领过了'
      : result.awarded
        ? `领取成功，+${result.rewardXp} XP${bonusPart}`
        : '今日经验已达上限，明天再来领取';
    await refresh();
  } catch (error) {
    flash.value = error instanceof Error ? error.message : '领取失败，请稍后重试';
  } finally {
    claiming.value = null;
  }
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
        每一关都是一段真实场景的长对话。进入场景，和里面的人把目标聊成，故事就往前走。
      </p>
      <p class="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-300">
        <UIcon name="i-lucide-languages" class="h-3 w-3" />
        对话里关掉「翻译」开关，通关时经验 +50%
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
            v-for="stage in chapter.stages"
            :key="stage.id"
            class="flex gap-3"
            :class="stage.unlocked ? '' : 'opacity-70'"
          >
            <div class="flex w-10 shrink-0 flex-col items-center">
              <span
                class="grid size-10 shrink-0 place-items-center rounded-2xl shadow-sm"
                :class="toneOf(stage.unlocked, stage.cleared)"
              >
                <UIcon :name="iconOf(stage)" class="h-4 w-4" />
              </span>
              <span class="mt-1 w-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            <div
              class="mb-1 flex-1 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
            >
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="text-[11px] font-medium text-slate-400 dark:text-slate-500">{{ stage.name }}</p>
                  <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">{{ stage.title }}</h3>
                </div>
                <span
                  v-if="stage.cleared"
                  class="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                >
                  已通关
                </span>
                <span
                  v-else-if="!stage.unlocked"
                  class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                >
                  未解锁
                </span>
              </div>

              <p class="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{{ stage.intro }}</p>

              <!-- 出场角色：一个场景 1~3 人 -->
              <div class="mt-2 flex flex-wrap gap-1.5">
                <span
                  v-for="role in stage.roles"
                  :key="role.nameEn"
                  class="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  <span aria-hidden="true">{{ role.emoji }}</span>
                  {{ role.name }}
                </span>
              </div>

              <p class="mt-2 text-[11px] leading-relaxed text-sky-700 dark:text-sky-300">
                <span class="font-semibold">目标：</span>{{ stage.goal }}
              </p>

              <div class="mt-2.5 flex items-center gap-2">
                <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    class="h-full rounded-full bg-linear-to-r from-sky-400 to-indigo-500 transition-all duration-500"
                    :style="{ width: `${stage.progress}%` }"
                  />
                </div>
                <span class="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                  至少 {{ stage.minTurns }} 轮 · 最多 {{ stage.maxTurns }} 轮
                </span>
              </div>

              <div class="mt-3 flex flex-wrap items-center gap-2">
                <UButton v-if="stage.unlocked" size="xs" :disabled="!stage.unlocked" @click="enter(stage)">
                  {{ stage.activeSessionId ? '继续对话' : stage.cleared ? '再聊一次' : '进入对话' }}
                </UButton>
                <UButton
                  v-if="stage.cleared && !stage.claimed"
                  size="xs"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-gift"
                  :loading="claiming === stage.id"
                  @click="claim(stage)"
                >
                  领 +{{ stage.rewardXp }} XP
                </UButton>
                <span v-if="stage.legacyCorrectCount > 0" class="text-[10px] text-slate-300 dark:text-slate-600">
                  旧版练习 {{ stage.legacyCorrectCount }} 句
                </span>
              </div>
            </div>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>
