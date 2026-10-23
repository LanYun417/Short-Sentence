<script setup lang="ts">
/**
 * 首页刷题（核心页面）。
 * 布局：[今日进度 Hero] [题干] [16:9 场景图] [输入框] [确定] → 翻转 → [下一题]。
 * 达成每日目标后出现「生成打卡海报」入口。
 */
import type { CheckinResult } from '~/types';
import { apiFetch } from '~/composables/useApi';
import { useQuestionSession, DIFFICULTIES } from '~/composables/useQuestionSession';
import { usePoster } from '~/composables/usePoster';

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
  submit,
  toggleFavorite,
} = useQuestionSession();
const { generating, generate } = usePoster();

/** 打卡数据（达标后由用户点击生成） */
const checkinData = ref<CheckinResult | null>(null);

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

onMounted(() => {
  void loadNext();
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

/** 打卡（幂等）。 */
async function onCheckin(): Promise<void> {
  const data = await apiFetch<CheckinResult>('/client/checkin', { method: 'POST' });
  checkinData.value = data;
  await nextTick();
  const element = document.querySelector<HTMLElement>('[data-poster]');
  if (element) {
    await generate(element);
  }
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

      <!-- 达标 → 打卡海报入口 -->
      <div v-if="goalReached" class="anim-pop mt-5">
        <div
          class="flex flex-col items-center gap-3 rounded-3xl border border-amber-200/70 bg-amber-50/80 p-5 text-center dark:border-amber-500/20 dark:bg-amber-500/10"
        >
          <div class="anim-float flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <UIcon name="i-lucide-party-popper" class="h-5 w-5" />
            <span class="font-semibold">今日目标已完成！</span>
          </div>
          <p class="text-sm text-amber-700/80 dark:text-amber-200/80">生成一张打卡海报，记录今天的坚持</p>
          <UButton
            color="warning"
            size="lg"
            class="shadow-lg shadow-orange-500/20"
            :loading="generating"
            @click="onCheckin"
          >
            {{ generating ? '生成中…' : checkinData ? '重新生成海报' : '生成打卡海报' }}
          </UButton>
        </div>
      </div>
    </template>

    <!-- 海报（离屏渲染；生成后由 usePoster 触发下载） -->
    <div v-if="checkinData" class="pointer-events-none fixed left-[-9999px] top-0">
      <PosterCanvas :checkin="checkinData" />
    </div>
  </div>
</template>
