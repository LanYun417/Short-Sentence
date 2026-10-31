<script setup lang="ts">
/**
 * 首页刷题（核心页面）。
 * 布局：[今日进度 Hero] [难度] [题干 + 16:9 场景图 + 作答区] → 翻转 → [下一题]。
 * 作答方式切换在题卡顶栏（换一题右侧，见 QuestionCard）。
 * 作答支持两种模式（默写 / 拼词），页面不再放操作提示文案，只靠控件本身表达。
 * 达成每日目标后自动领取并展示「今日 AI 句签」。
 */
import type { SentenceCard, NextQuestion } from '~/types';
import { apiFetch } from '~/composables/useApi';
import { useQuestionSession } from '~/composables/useQuestionSession';

definePageMeta({ middleware: ['auth'] });

// 页面描述只进 <head>（SEO / 分享卡片），不在页面上渲染
usePageSeo({
  title: '刷题',
  description: '看图学地道英语：看中文写英文，提交后翻卡对照。每天 20 句，间隔重复记得住。',
});

const {
  question,
  result,
  loading,
  submitting,
  errorMessage,
  difficulty,
  mode,
  festival,
  festivals,
  loadNext,
  loadFestivals,
  setDifficulty,
  setMode,
  setFestival,
  prefill,
  submit,
  toggleFavorite,
} = useQuestionSession();

/**
 * 节日题库面板是否展开。
 *
 * 全年二十多个节日平铺会占掉小半屏、把题卡顶出首屏，所以默认收起成一个入口行：
 * 入口常驻可见（随时可刷），但不去抢题卡的位置。
 */
const festivalPanelOpen = ref(false);

// 选中某个节日后自动收起面板：此时顶部换成「节日模式」提示条，把空间让给题卡；
// 想换别的节日再点开入口即可。
watch(festival, (value) => {
  if (value) {
    festivalPanelOpen.value = false;
  }
});

/**
 * SSR 预抽题：服务端按 Cookie 令牌 + 难度偏好抽好卡，首屏 HTML 直接带题面
 * （拼词词块随题恒定下发）。预取失败（令牌过期等）返回 null，onMounted 走客户端流程兜底。
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

/* ------------------------------ 进度卡片的阶段效果 ------------------------------ */

/**
 * 进度阶段：卡片配色随完成度由冷到暖逐级升温，达标转金橙。
 *
 * 分五档而不是「线性插值」：色相跨太多时连续插值会经过一段浑浊的灰调，
 * 分段各自给一组和谐的起止色，档位之间再由 CSS 对色标插值平滑过渡。
 */
type HeroStageKey = 'idle' | 'warmup' | 'push' | 'sprint' | 'done';

/** 各阶段的渐变三色与投影色（与 main.css 的 --hero-* 变量对应）。 */
const HERO_STAGES: Record<HeroStageKey, { from: string; via: string; to: string; shadow: string }> = {
  // 还没开始：青蓝，冷静、不催人
  idle: { from: '#0284c7', via: '#0e7490', to: '#0f766e', shadow: 'rgb(8 145 178 / 25%)' },
  // 起步 1~33%：品牌蓝紫
  warmup: { from: '#0ea5e9', via: '#6366f1', to: '#8b5cf6', shadow: 'rgb(99 102 241 / 25%)' },
  // 推进 34~66%：紫
  push: { from: '#6366f1', via: '#8b5cf6', to: '#d946ef', shadow: 'rgb(168 85 247 / 30%)' },
  // 冲刺 67~99%：紫 → 玫红 → 橙，已经热起来了
  sprint: { from: '#8b5cf6', via: '#f43f5e', to: '#f97316', shadow: 'rgb(244 63 94 / 30%)' },
  // 达标：金橙，奖励感
  done: { from: '#fbbf24', via: '#f59e0b', to: '#f97316', shadow: 'rgb(249 115 22 / 35%)' },
};

/** 当前阶段（达标优先判定，避免 pct 取整到 100 但实际未达标时误判）。 */
const heroStage = computed<{ key: HeroStageKey } & (typeof HERO_STAGES)[HeroStageKey]>(() => {
  if (goalReached.value) {
    return { key: 'done', ...HERO_STAGES.done };
  }
  if (todayDone.value <= 0) {
    return { key: 'idle', ...HERO_STAGES.idle };
  }
  if (goalPct.value >= 67) {
    return { key: 'sprint', ...HERO_STAGES.sprint };
  }
  if (goalPct.value >= 34) {
    return { key: 'push', ...HERO_STAGES.push };
  }
  return { key: 'warmup', ...HERO_STAGES.warmup };
});

/**
 * 进度文案：还没开始时不说「还差 20 句」（像催作业），达标后交给右上的「已达标」徽标。
 */
const heroHint = computed(() => {
  if (goalReached.value) {
    return '';
  }
  if (todayDone.value <= 0) {
    return '今天还没开始';
  }
  return `还差 ${goalRemaining.value} 句`;
});

/**
 * 阶段升级时给卡片一次轻微「顶一下」的正反馈（scale 而非 animation：
 * 本元素已有 .anim-in 入场动画，再叠一个 animation 会互相覆盖）。
 */
const heroPulse = ref(false);
let pulseTimer: ReturnType<typeof setTimeout> | 0 = 0;
watch(
  () => heroStage.value.key,
  (next, prev) => {
    // 首帧不弹（SSR 水合时 prev 为 undefined）
    if (!prev || next === 'idle') {
      return;
    }
    heroPulse.value = true;
    clearTimeout(pulseTimer);
    pulseTimer = setTimeout(() => {
      heroPulse.value = false;
    }, 460);
  },
);

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
  // 有节日题库时展示可选入口（失败静默，不影响日常刷题）
  void loadFestivals();
  // 刷新页面时若今日目标已完成，自动领取当日句签
  if (goalReached.value) {
    void claimSentenceCard();
  }
});

onBeforeUnmount(() => {
  clearTimeout(closeTimer);
  clearTimeout(pulseTimer);
});

/** 提交答案。 */
async function onSubmit(answer: string): Promise<void> {
  await submit(answer);
}

/** 下一张卡。 */
function onNext(): void {
  void loadNext();
}

/** 换一题：跳过当前题直接抽下一张（与「下一题」同路径，未提交也能用）。 */
function onSkip(): void {
  void loadNext();
}

/** 收藏 / 取消。 */
function onFavorite(): void {
  void toggleFavorite();
}
</script>

<template>
  <div class="mx-auto max-w-xl px-4 py-6 md:py-8">
    <!-- 今日进度 Hero：配色随完成度升温（未开始青蓝 → 冲刺玫红 → 达标金橙），见 heroStage -->
    <section
      class="ss-hero anim-in relative mb-5 overflow-hidden rounded-3xl p-5 text-white"
      :class="{ 'ss-hero--done': heroStage.key === 'done', 'scale-[1.012]': heroPulse }"
      :style="{
        '--hero-from': heroStage.from,
        '--hero-via': heroStage.via,
        '--hero-to': heroStage.to,
        '--hero-shadow': heroStage.shadow,
      }"
    >
      <!-- 液态流体背景（WebGL 域扭曲，颜色随阶段升温）+ 星光 -->
      <HeroAurora :from="heroStage.from" :via="heroStage.via" :to="heroStage.to" />

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
        <span v-else-if="heroHint" class="text-xs text-white/80">{{ heroHint }}</span>
      </div>

      <!-- 进度条：末端光点跟住完成度，达标转金色 -->
      <div class="relative mt-4 h-2 w-full rounded-full bg-white/25">
        <div
          class="h-full rounded-full bg-white/95 transition-all duration-700 ease-out"
          :style="{ width: `${goalPct}%` }"
        />
        <span
          class="ss-hero-dot absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
          :class="
            heroStage.key === 'done'
              ? 'bg-amber-200 shadow-[0_0_10px_2px_rgba(251,191,36,0.75)]'
              : 'bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.5)]'
          "
          :style="{ left: `${goalPct}%` }"
          aria-hidden="true"
        />
      </div>
    </section>

    <!-- 节日题库：常驻入口，有题就能专门刷；展开可看到全年所有节日 -->
    <div v-if="festivals.length" class="anim-in mb-4" :style="{ animationDelay: '40ms' }">
      <button
        type="button"
        class="mb-1.5 flex w-full items-center justify-between text-xs font-medium text-slate-400 transition-colors hover:text-slate-500 dark:hover:text-slate-300"
        :aria-expanded="festivalPanelOpen"
        @click="festivalPanelOpen = !festivalPanelOpen"
      >
        <span>节日题库</span>
        <span class="flex items-center gap-1.5">
          <span class="text-[11px] font-normal opacity-80">全年 {{ festivals.length }} 个 · 随时可刷</span>
          <UIcon
            name="i-lucide-chevron-down"
            class="h-3.5 w-3.5 transition-transform duration-200"
            :class="{ 'rotate-180': festivalPanelOpen }"
          />
        </span>
      </button>
      <div v-show="festivalPanelOpen" class="flex flex-wrap gap-1.5">
        <UButton
          size="sm"
          :color="festival === null ? 'primary' : 'neutral'"
          :variant="festival === null ? 'solid' : 'soft'"
          @click="setFestival(null)"
        >
          全部
        </UButton>
        <UButton
          v-for="item in festivals"
          :key="item.name"
          size="sm"
          :color="festival === item.name ? 'primary' : 'neutral'"
          :variant="festival === item.name ? 'solid' : 'soft'"
          @click="setFestival(item.name)"
        >
          {{ item.name }}
          <span class="ml-1 text-[11px] opacity-70">{{ item.count }}</span>
        </UButton>
      </div>
    </div>

    <!-- 难度选择：只在日常混抽时可用（节日题库是一套固定题，不按难度筛） -->
    <div v-if="!festival" class="anim-in mb-4" :style="{ animationDelay: '40ms' }">
      <DifficultyPicker :model-value="difficulty" @update:model-value="setDifficulty" />
    </div>

    <!-- 节日模式：正在专门刷某个节日的题库（难度选择器此时隐藏，这里给出明确状态与退出入口） -->
    <div
      v-else
      class="anim-in mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-400/30 dark:bg-amber-400/10"
      :style="{ animationDelay: '40ms' }"
    >
      <div class="flex min-w-0 items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
        <UIcon name="i-lucide-sparkles" class="h-4 w-4 shrink-0" />
        <span class="truncate">正在刷「{{ festival }}」节日题库</span>
      </div>
      <UButton size="xs" color="neutral" variant="soft" @click="setFestival(null)">退出</UButton>
    </div>

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
          :mode="mode"
          can-skip
          @submit="onSubmit"
          @next="onNext"
          @favorite="onFavorite"
          @skip="onSkip"
          @change-mode="setMode"
        />
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
