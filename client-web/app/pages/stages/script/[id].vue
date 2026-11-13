<script setup lang="ts">
/**
 * 剧本详情（路由 /stages/script/:scriptId）：点开场景里的剧本卡后到这里。
 *
 * 上面是剧本封面横幅 + 场景/进度，下面这本剧本所有关卡的紧凑卡片（双列）。
 * 关卡卡片逻辑与旧版章节详情页完全一致，只是数据源改成剧本维度。
 *
 * 为什么拆页而不是在地图上展开：地图要保持「一场景一屏卡」的一览感，
 * 关卡卡片本身有高度，全铺开就把封面墙冲没了；关卡随运营增加时也更可控。
 */
import { computed, onMounted, ref } from 'vue';
import { apiFetch } from '~/composables/useApi';
import { sceneCoverOf } from '~/utils/stage-chapters';
import type { StageClaimResult, StageScriptDetail, StageView } from '~/types';

definePageMeta({ middleware: ['auth'] });

const route = useRoute();
const scriptId = computed(() => Number(route.params.id));

const detail = ref<StageScriptDetail | null>(null);

onMounted(async () => {
  detail.value = await apiFetch<StageScriptDetail>(`/client/stages/scripts/${scriptId.value}`).catch(() => null);
});

const script = computed(() => detail.value?.script ?? null);
const stages = computed<StageView[]>(() => detail.value?.stages ?? []);
/** 封面兜底：剧本没生成封面时按场景 id 轮换渐变 + 大图标。 */
const cover = computed(() => sceneCoverOf(script.value?.categoryId ?? 0));

const claiming = ref<number | null>(null);
const flash = ref('');

/** 私有页：noindex；浏览器标签前缀用剧本名（数据到位后由下方 useHead 覆盖）。 */
usePageSeo({
  title: '剧本详情',
  description: '进入这本剧本的真实场景，和里面的人用英语把目标聊成。',
});
useHead({ title: computed(() => (script.value ? script.value.name : '剧本详情')) });

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
  } catch (error) {
    flash.value = error instanceof Error ? error.message : '领取失败，请稍后重试';
  } finally {
    claiming.value = null;
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-6 sm:py-8">
    <div v-if="!detail" class="py-16 text-center text-sm text-slate-400">
      <p>正在加载剧本…</p>
    </div>

    <div v-else-if="!script" class="py-16 text-center text-sm text-slate-400">
      <p>
        没找到这本剧本。
        <NuxtLink to="/stages" class="text-sky-600 dark:text-sky-400">返回闯关地图</NuxtLink>
      </p>
    </div>

    <template v-else>
      <!-- 封面横幅：有 AI 封面图则铺底图（压一层暗色保证白字可读），否则渐变 + 大图标 -->
      <header
        class="anim-in relative overflow-hidden rounded-3xl p-5 text-white shadow-sm"
        :class="[cover.gradient, cover.gradientDark]"
      >
        <img
          v-if="script.coverUrl"
          :src="script.coverUrl"
          :alt="script.name"
          class="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
        <div v-if="script.coverUrl" class="absolute inset-0 bg-black/40" />
        <div class="relative">
          <NuxtLink
            :to="`/stages/scene/${script.categoryId}`"
            class="inline-flex items-center gap-0.5 text-xs font-medium text-white/80 transition hover:text-white"
          >
            <UIcon name="i-lucide-chevron-left" class="h-3.5 w-3.5" />
            {{ detail.scene.name || '全部场景' }}
          </NuxtLink>
          <div class="mt-2 flex items-end justify-between gap-3">
            <div class="min-w-0">
              <h1 class="text-xl font-bold drop-shadow-sm">{{ script.name }}</h1>
              <p class="mt-1 max-w-md text-xs leading-relaxed text-white/85">{{ script.blurb }}</p>
            </div>
            <span v-if="!script.coverUrl" class="shrink-0 text-4xl drop-shadow-sm" aria-hidden="true">{{
              cover.emoji
            }}</span>
          </div>
          <div class="mt-3 flex items-center gap-2">
            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
              <div
                class="h-full rounded-full bg-white transition-all duration-500"
                :style="{ width: `${detail.total > 0 ? (detail.clearedCount / detail.total) * 100 : 0}%` }"
              />
            </div>
            <span class="shrink-0 text-[11px] font-semibold text-white/90">
              {{ detail.clearedCount }} / {{ detail.total }} 关
            </span>
          </div>
        </div>
      </header>

      <p
        v-if="flash"
        class="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
      >
        {{ flash }}
      </p>

      <p class="mt-3 mb-3 inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-300">
        <UIcon name="i-lucide-languages" class="h-3 w-3" />
        对话里关掉「翻译」开关，通关时经验 +50%
      </p>

      <!-- 本剧本关卡：紧凑卡片 + 宽屏双列 -->
      <ol class="grid gap-2.5 sm:grid-cols-2">
        <li
          v-for="stage in stages"
          :key="stage.id"
          class="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
          :class="stage.unlocked ? '' : 'opacity-70'"
        >
          <div class="flex items-center gap-2">
            <span
              class="grid size-8 shrink-0 place-items-center rounded-xl shadow-sm"
              :class="toneOf(stage.unlocked, stage.cleared)"
            >
              <UIcon :name="iconOf(stage)" class="h-3.5 w-3.5" />
            </span>
            <h2
              class="min-w-0 flex-1 truncate text-sm font-bold text-slate-800 dark:text-slate-100"
              :title="stage.name"
            >
              {{ stage.title }}
            </h2>
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

          <p class="mt-1.5 line-clamp-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {{ stage.intro }}
          </p>

          <div class="mt-1 flex items-center gap-2 overflow-hidden">
            <span
              v-for="role in stage.roles"
              :key="role.nameEn"
              class="shrink-0 text-[10px] text-slate-500 dark:text-slate-400"
              :title="role.name"
            >
              <span aria-hidden="true">{{ role.emoji }}</span
              >{{ role.name }}
            </span>
          </div>

          <p class="mt-1.5 line-clamp-1 text-[11px] leading-relaxed text-sky-700 dark:text-sky-300">
            <span class="font-semibold">目标：</span>{{ stage.goal }}
          </p>

          <div class="mt-2 flex items-center gap-2">
            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                class="h-full rounded-full bg-linear-to-r from-sky-400 to-indigo-500 transition-all duration-500"
                :style="{ width: `${stage.progress}%` }"
              />
            </div>
            <span class="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
              {{ stage.minTurns }}~{{ stage.maxTurns }} 轮
            </span>
          </div>

          <div class="mt-2 flex items-center gap-2">
            <UButton v-if="stage.unlocked" size="xs" @click="enter(stage)">
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
            <span
              v-if="stage.legacyCorrectCount > 0"
              class="min-w-0 flex-1 truncate text-[10px] text-slate-300 dark:text-slate-600"
            >
              旧版练习 {{ stage.legacyCorrectCount }} 句
            </span>
          </div>
        </li>
      </ol>
    </template>
  </div>
</template>
