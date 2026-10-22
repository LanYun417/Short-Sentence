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
    <UAlert
      v-if="errorMessage && !question"
      color="error"
      variant="subtle"
      :description="errorMessage"
      class="mx-auto max-w-xl"
    >
      <template #actions>
        <UButton size="sm" color="error" variant="outline" @click="loadNext">重试</UButton>
      </template>
    </UAlert>

    <!-- 加载态 -->
    <div v-else-if="loading && !question" class="mx-auto max-w-xl space-y-4 py-10">
      <USkeleton class="h-8 w-full rounded-2xl" />
      <USkeleton class="aspect-video w-full rounded-2xl" />
      <USkeleton class="h-12 w-full rounded-2xl" />
    </div>

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
        <UButton
          color="warning"
          variant="solid"
          size="lg"
          class="bg-linear-to-r from-amber-500 to-orange-500 shadow-lg shadow-orange-500/20"
          :loading="generating"
          @click="onCheckin"
        >
          {{ generating ? '生成中…' : checkinData ? '重新生成海报' : '今日目标已完成，生成打卡海报' }}
        </UButton>
      </div>
    </template>

    <!-- 海报（离屏渲染；生成后由 usePoster 触发下载） -->
    <div v-if="checkinData" class="pointer-events-none fixed left-[-9999px] top-0">
      <PosterCanvas :checkin="checkinData" />
    </div>
  </div>
</template>
