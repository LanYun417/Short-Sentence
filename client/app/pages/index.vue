<script setup lang="ts">
/**
 * 首页刷题（核心页面）。
 * 布局：[今日进度 Hero] [题干] [16:9 场景图] [输入框] [确定] → 翻转 → [下一题]。
 * 达成每日目标后自动领取并展示「今日 AI 句签」。
 */
import type { SentenceCard, NextQuestion } from '~/types';
import { apiFetch } from '~/composables/useApi';
import { useQuestionSession, DIFFICULTIES } from '~/composables/useQuestionSession';
import { withUploadToken } from '~/utils/upload-token';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '今日刷题',
  description: '看中文想英文，提交后翻卡对照。每天 20 句，看图学地道英语口语。',
});

const {
  question,
  result,
  loading,
  submitting,
  errorMessage,
  difficulty,
  loadNext,
  setDifficulty,
  prefill,
  submit,
  toggleFavorite,
} = useQuestionSession();

/**
 * SSR 预抽题：服务端按 Cookie 令牌 + 难度偏好抽好卡，首屏 HTML 直接带题面
 * （todayDone/todayGoal 快照也在里面，进度 Hero 一并 SSR）。
 * 预取失败（令牌过期等）返回 null，onMounted 走客户端流程兜底。
 */
const { data: ssrQuestion } = await useSsrApi<NextQuestion>('ss:question', '/client/questions/next', {
  difficulty: difficulty.value,
});
if (ssrQuestion.value) {
  prefill(ssrQuestion.value);
}

/** 今日完成 / 目标（优先取提交后的实时结果，其次题目上的快照）。 */
const todayDone = computed(() => result.value?.todayDone ?? question.value?.todayDone ?? 0);
const todayGoal = computed(() => result.value?.todayGoal ?? question.value?.todayGoal ?? 0);
const goalReached = computed(() => todayGoal.value > 0 && todayDone.value >= todayGoal.value);
const goalPct = computed(() =>
  todayGoal.value > 0 ? Math.min(100, Math.round((todayDone.value / todayGoal.value) * 100)) : 0,
);
const goalRemaining = computed(() => Math.max(0, todayGoal.value - todayDone.value));

/** 完成数滚动动画。 */
const doneDisplay = useCountUp(todayDone);

/* ------------------------------ 今日 AI 句签 ------------------------------ */

const sentenceCard = ref<SentenceCard | null>(null);
const claiming = ref(false);
// 句签图片走 /static，需带令牌（Cookie 令牌，SSR 与客户端同源一致）
const tokenCookie = useCookie<string | null>('ss_token');
const sentenceCardImageSrc = computed(() =>
  sentenceCard.value?.imageUrl ? withUploadToken(sentenceCard.value.imageUrl, tokenCookie.value) : undefined,
);

/** 领取今日句签（达标后自动调用；幂等，失败静默不影响刷题）。 */
async function claimSentenceCard(): Promise<void> {
  if (claiming.value || !goalReached.value) {
    return;
  }
  claiming.value = true;
  try {
    sentenceCard.value = await apiFetch<SentenceCard | null>('/client/sentence-card/claim', { method: 'POST' });
  } catch {
    // 静默：句签领取失败不打扰用户（下次达标/进入页面会再试）
  } finally {
    claiming.value = false;
  }
}

// 达标瞬间自动领取（提交答案跨过目标线时触发）
watch(goalReached, (reached) => {
  if (reached && !sentenceCard.value) {
    void claimSentenceCard();
  }
});

onMounted(() => {
  // SSR 已预抽题时直接用；失败/客户端路由进入时才现场拉取
  if (!question.value) {
    void loadNext();
  }
  // 刷新页面时若今日目标已完成，自动领取当日句签
  if (goalReached.value) {
    void claimSentenceCard();
  }
});

/** 提交答案。 */
async function onSubmit(answer: string): Promise<void> {
  await submit(answer);
}

/** 下一张卡。 */
function onNext(): void {
  void loadNext();
}

/** 收藏 / 取消。 */
function onFavorite(): void {
  void toggleFavorite();
}
</script>

<template>
  <div class="mx-auto max-w-xl px-4 py-6 md:py-8">
    <!-- 今日进度 Hero -->
    <section
      class="anim-in anim-gradient relative mb-5 overflow-hidden rounded-3xl bg-linear-to-br from-sky-500 via-indigo-500 to-violet-500 bg-size-[200%_200%] p-5 text-white shadow-lg shadow-indigo-500/25"
    >
      <!-- 装饰光斑（缓慢漂移，让渐变区块不死板） -->
      <div
        class="anim-drift pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl"
      />
      <div
        class="anim-drift pointer-events-none absolute -bottom-12 -left-6 h-28 w-28 rounded-full bg-sky-300/25 blur-2xl"
        style="animation-delay: -6s"
      />

      <div class="relative flex items-end justify-between">
        <div>
          <p class="flex items-center gap-1.5 text-xs font-medium text-white/80">
            <UIcon name="i-lucide-flame" class="h-4 w-4" />
            今日刷题
          </p>
          <p class="mt-1 text-3xl font-bold leading-none">
            <span class="tabular-nums">{{ doneDisplay }}</span
            ><span class="ml-1 text-base font-medium text-white/80">/ {{ todayGoal }} 句</span>
          </p>
        </div>
        <span
          v-if="goalReached"
          class="anim-pop inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium backdrop-blur"
        >
          <UIcon name="i-lucide-check-circle-2" class="h-3.5 w-3.5" /> 已达标
        </span>
        <span v-else-if="todayGoal > 0" class="text-xs text-white/80">还差 {{ goalRemaining }} 句</span>
      </div>

      <!-- 进度条 -->
      <div class="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-white/25">
        <div
          class="h-full rounded-full bg-white shadow-sm transition-all duration-700 ease-out"
          :style="{ width: `${goalPct}%` }"
        />
      </div>
    </section>

    <!-- 难度选择：开始刷题前选，中途也可随时切换（切换后立刻按新难度抽题） -->
    <div class="anim-in mb-4" :style="{ animationDelay: '40ms' }">
      <div class="mb-1.5 flex items-center justify-between">
        <span class="text-xs font-medium text-slate-400">题目难度</span>
        <span class="text-xs text-slate-400">可随时切换</span>
      </div>
      <div class="flex gap-2">
        <UButton
          v-for="level in DIFFICULTIES"
          :key="level.value"
          :color="difficulty === level.value ? 'primary' : 'neutral'"
          :variant="difficulty === level.value ? 'solid' : 'soft'"
          :icon="level.icon"
          size="sm"
          class="flex-1 transition-transform active:scale-95"
          @click="setDifficulty(level.value)"
        >
          {{ level.label }}
        </UButton>
      </div>
    </div>

    <p class="anim-in mb-4 text-center text-sm text-slate-400" :style="{ animationDelay: '80ms' }">
      看中文，想英文；提交后翻卡对照。回车 = 确定 / 下一题
    </p>

    <!-- 错误态 -->
    <UAlert
      v-if="errorMessage && !question"
      color="error"
      variant="subtle"
      orientation="vertical"
      :description="errorMessage"
      class="mx-auto max-w-xl"
    >
      <template #actions>
        <UButton size="sm" color="error" variant="outline" @click="loadNext">重试</UButton>
      </template>
    </UAlert>

    <!-- 加载态 -->
    <div v-else-if="loading && !question" class="mx-auto max-w-xl space-y-4 py-6">
      <USkeleton class="h-8 w-full rounded-2xl" />
      <USkeleton class="aspect-video w-full rounded-2xl" />
      <USkeleton class="h-12 w-full rounded-2xl" />
    </div>

    <!-- 闪卡 -->
    <template v-else-if="question">
      <!-- 闪卡（不加 :key：换题要走翻牌动画，重建 DOM 会让 transition 没有起点） -->
      <div class="anim-in" :style="{ animationDelay: '140ms' }">
        <QuestionCard
          :question="question"
          :result="result"
          :submitting="submitting"
          :loading="loading"
          @submit="onSubmit"
          @next="onNext"
          @favorite="onFavorite"
        />
      </div>

      <!-- 达标 → 今日 AI 句签（自动领取并展示） -->
      <div v-if="goalReached" class="anim-pop mt-5">
        <!-- 已领取：精美闪卡 -->
        <div
          v-if="sentenceCard"
          class="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-amber-200/60 dark:bg-slate-800 dark:ring-amber-500/20"
        >
          <div class="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-700">
            <img
              v-if="sentenceCardImageSrc"
              :src="sentenceCardImageSrc"
              :alt="sentenceCard.title"
              class="h-full w-full object-cover"
            />
            <div v-else class="flex h-full items-center justify-center text-slate-400">
              <UIcon name="i-lucide-image-off" class="h-8 w-8" />
            </div>
            <span
              class="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur"
            >
              <UIcon name="i-lucide-sparkles" class="h-3.5 w-3.5" />
              今日句签 · 已获得
            </span>
          </div>
          <div class="p-5">
            <div class="flex items-baseline gap-2">
              <h3 class="text-lg font-bold text-slate-800 dark:text-slate-100">{{ sentenceCard.titleZh }}</h3>
              <span class="text-sm text-slate-400">{{ sentenceCard.title }}</span>
            </div>
            <p class="mt-2 text-base font-medium text-slate-700 dark:text-slate-200">{{ sentenceCard.sentenceEn }}</p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ sentenceCard.translationZh }}</p>
            <p class="mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <UIcon name="i-lucide-party-popper" class="h-4 w-4" />
              完成今日目标，收下这张属于你的闪卡
            </p>
          </div>
        </div>

        <!-- 领取中 / 今日句签尚未生成 -->
        <div
          v-else
          class="flex flex-col items-center gap-3 rounded-3xl border border-amber-200/70 bg-amber-50/80 p-5 text-center dark:border-amber-500/20 dark:bg-amber-500/10"
        >
          <div class="anim-float flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <UIcon name="i-lucide-party-popper" class="h-5 w-5" />
            <span class="font-semibold">今日目标已完成！</span>
          </div>
          <p class="text-sm text-amber-700/80 dark:text-amber-200/80">
            {{ claiming ? '正在为你解锁今日句签…' : '今日句签还在准备中，稍后再来看看' }}
          </p>
          <UIcon v-if="claiming" name="i-lucide-loader-circle" class="h-5 w-5 animate-spin text-amber-500" />
        </div>
      </div>
    </template>
  </div>
</template>
