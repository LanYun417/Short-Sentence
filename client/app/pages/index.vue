<script setup lang="ts">
/**
 * 首页刷题（核心页面）。
 * 布局：[今日进度 Hero] [题干] [16:9 场景图] [输入框] [确定] → 翻转 → [下一题]。
 * 达成每日目标后自动领取并展示「今日 AI 句签」。
 */
import type { SentenceCard, NextQuestion } from '~/types';
import { apiFetch } from '~/composables/useApi';
import { useQuestionSession } from '~/composables/useQuestionSession';

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

const { status: todayCard, markObtained } = useTodayCard();

/** 领取中的 loading 态。 */
const claiming = ref(false);
/** 庆祝弹层：领取成功后播放一次（卡片居中 → 光束飞向头像 → 自动关闭）。 */
const celebrating = ref(false);
const celebrationCard = ref<SentenceCard | null>(null);
const beamStyle = ref<Record<string, string>>({});
const cardAnchorRef = useTemplateRef<HTMLElement>('cardAnchor');
let closeTimer: ReturnType<typeof setTimeout> | 0 = 0;

/** 关闭庆祝层。 */
function closeCelebration(): void {
  clearTimeout(closeTimer);
  celebrating.value = false;
}

/** 播放领取庆祝：卡片居中放大 → 光束飞向导航头像 → 自动收起。 */
function startCelebration(card: SentenceCard): void {
  celebrationCard.value = card;
  celebrating.value = true;
  nextTick(() => {
    // 量出卡片中心与头像中心，作为光束的起止点
    const anchor = cardAnchorRef.value;
    const avatar = document.querySelector('[data-avatar]');
    if (!anchor || !avatar) {
      return;
    }
    const from = anchor.getBoundingClientRect();
    const to = avatar.getBoundingClientRect();
    beamStyle.value = {
      '--from-x': `${from.left + from.width / 2}px`,
      '--from-y': `${from.top + from.height / 2}px`,
      '--to-x': `${to.left + to.width / 2}px`,
      '--to-y': `${to.top + to.height / 2}px`,
    };
  });
  clearTimeout(closeTimer);
  closeTimer = setTimeout(closeCelebration, 2600);
}

/** 领取今日句签（达标后自动调用；幂等，失败静默不影响刷题）。 */
async function claimSentenceCard(): Promise<void> {
  if (claiming.value || !goalReached.value) {
    return;
  }
  // 今日已获得（刷新进入等）：补一次幂等领取即可，不重复播特效
  if (todayCard.value.obtained) {
    void apiFetch<SentenceCard | null>('/client/sentence-card/claim', { method: 'POST' }).catch(() => null);
    return;
  }
  claiming.value = true;
  try {
    const card = await apiFetch<SentenceCard | null>('/client/sentence-card/claim', { method: 'POST' });
    if (card) {
      markObtained(card.bizDate);
      startCelebration(card);
    }
  } catch {
    // 静默：句签领取失败不打扰用户（下次达标/进入页面会再试）
  } finally {
    claiming.value = false;
  }
}

// 达标瞬间自动领取（提交答案跨过目标线时触发）
watch(goalReached, (reached) => {
  if (reached) {
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

onBeforeUnmount(() => {
  clearTimeout(closeTimer);
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
      <DifficultyPicker :model-value="difficulty" @update:model-value="setDifficulty" />
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

      <!-- 达标提示（句签已收入囊中，庆祝特效播完即收起，不再常驻展示） -->
      <div v-if="goalReached" class="anim-pop mt-5">
        <div
          class="flex flex-col items-center gap-2 rounded-3xl border border-amber-200/70 bg-amber-50/80 p-5 text-center dark:border-amber-500/20 dark:bg-amber-500/10"
        >
          <div class="anim-float flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <UIcon name="i-lucide-party-popper" class="h-5 w-5" />
            <span class="font-semibold">今日目标已完成！</span>
          </div>
          <p class="text-sm text-amber-700/80 dark:text-amber-200/80">
            {{
              claiming
                ? '正在为你解锁今日句签…'
                : todayCard.obtained
                  ? '今日句签已收入囊中，头像已点亮 ✨'
                  : '今日句签还在准备中，稍后再来看看'
            }}
          </p>
          <UIcon v-if="claiming" name="i-lucide-loader-circle" class="h-5 w-5 animate-spin text-amber-500" />
        </div>
      </div>
    </template>

    <!-- 领取句签的庆祝层：卡片居中 → 光束飞向导航头像 → 自动关闭 -->
    <Teleport to="body">
      <Transition name="ss-celebrate">
        <div
          v-if="celebrating"
          class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-[2px]"
          @click.self="closeCelebration"
        >
          <div ref="cardAnchor" class="ss-celebrate-card relative w-[min(90vw,24rem)]">
            <SentenceCard v-if="celebrationCard" :card="celebrationCard" />
          </div>
          <p class="absolute bottom-[14%] text-center text-sm font-medium text-white/90 drop-shadow-sm">
            今日句签已收入囊中
          </p>
        </div>
      </Transition>
      <!-- 光束：盖在遮罩之上，飞向右上角头像 -->
      <span v-if="celebrating" class="ss-beam" :style="beamStyle" />
    </Teleport>
  </div>
</template>
