<script setup lang="ts">
/**
 * 首页刷题（核心页面）。
 * 布局：[题干] [16:9 场景图] [输入框] [确定] → 翻转 → [下一题]。
 * 达成每日目标后出现「生成打卡海报」入口。
 */
import type { CheckinResult } from '~/types';
import { apiFetch } from '~/composables/useApi';
import { useQuestionSession } from '~/composables/useQuestionSession';
import { usePoster } from '~/composables/usePoster';

definePageMeta({ middleware: ['auth'] });

const { question, result, loading, submitting, errorMessage, loadNext, submit, toggleFavorite } = useQuestionSession();
const { generating, generate } = usePoster();

/** 打卡数据（达标后由用户点击生成） */
const checkinData = ref<CheckinResult | null>(null);

const goalReached = computed(() => (result.value?.todayDone ?? 0) >= (result.value?.todayGoal ?? 0));

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
  <div class="min-h-[calc(100vh-3.5rem)] px-4 py-6">
    <p class="mx-auto mb-4 max-w-xl text-center text-sm text-slate-400">
      看中文，想英文；提交后翻卡对照。回车 = 确定 / 下一题
    </p>

    <!-- 错误态 -->
    <div
      v-if="errorMessage && !question"
      class="mx-auto max-w-xl rounded-2xl bg-rose-50 p-6 text-center dark:bg-rose-900/20"
    >
      <p class="text-rose-600 dark:text-rose-300">{{ errorMessage }}</p>
      <button class="mt-3 rounded-xl bg-rose-600 px-5 py-2 text-sm text-white" @click="loadNext">重试</button>
    </div>

    <!-- 加载态 -->
    <div v-else-if="loading && !question" class="mx-auto max-w-xl py-20 text-center text-slate-400">加载中…</div>

    <!-- 闪卡 -->
    <template v-else-if="question">
      <QuestionCard
        :key="question.sentenceId"
        :question="question"
        :result="result"
        :submitting="submitting"
        @submit="onSubmit"
        @next="onNext"
        @favorite="onFavorite"
      />

      <!-- 达标 → 打卡海报入口 -->
      <div v-if="goalReached" class="mx-auto mt-5 max-w-xl text-center">
        <button
          class="rounded-xl bg-linear-to-r from-amber-500 to-orange-500 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-orange-500/20 transition hover:opacity-90 disabled:opacity-60"
          :disabled="generating"
          @click="onCheckin"
        >
          {{ generating ? '生成中…' : checkinData ? '重新生成海报' : '今日目标已完成，生成打卡海报' }}
        </button>
      </div>
    </template>

    <!-- 海报（离屏渲染；生成后由 usePoster 触发下载） -->
    <div v-if="checkinData" class="pointer-events-none fixed left-[-9999px] top-0">
      <PosterCanvas :checkin="checkinData" />
    </div>
  </div>
</template>
