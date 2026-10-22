<script setup lang="ts">
/**
 * 刷题闪卡（3D 翻转）。
 * 交互状态机：answering →（提交/确定/回车）→ flipped →（下一题/回车）→ 下一张。
 * 正面不出答案；背面只在提交后渲染正确答案（由后端 answer 响应驱动）。
 */
import type { AnswerResult, NextQuestion } from '~/types';

const props = defineProps<{
  /** 当前题目（sentenceId 变化即换卡） */
  question: NextQuestion;
  /** 提交后的结果（null = 未提交/翻转前） */
  result: AnswerResult | null;
  /** 提交请求中（禁用确定按钮） */
  submitting: boolean;
}>();

const emit = defineEmits<{
  (e: 'submit', answer: string): void;
  (e: 'next'): void;
  (e: 'favorite'): void;
}>();

/** 用户输入 */
const answer = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

/** 翻转态（有结果即翻转） */
const flipped = computed(() => props.result !== null);

/** 难度文案 */
const difficultyText = computed(() => ['', '基础', '进阶', '挑战'][props.question.difficulty] ?? '');

// 换卡重置输入并聚焦
watch(
  () => props.question.sentenceId,
  () => {
    answer.value = '';
    nextTick(() => inputRef.value?.focus());
  },
);

onMounted(() => {
  nextTick(() => inputRef.value?.focus());
  window.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});

/** 回车双态：输入态=提交，翻转态=下一题。 */
function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter') {
    return;
  }
  // 输入框内回车由表单 submit 处理，避免双触发
  if (document.activeElement === inputRef.value && !flipped.value) {
    return;
  }
  event.preventDefault();
  if (flipped.value) {
    emit('next');
  } else {
    onSubmit();
  }
}

/** 提交答案。 */
function onSubmit(): void {
  if (props.submitting || flipped.value) {
    return;
  }
  const value = answer.value.trim();
  if (!value) {
    return;
  }
  emit('submit', value);
}
</script>

<template>
  <div class="card-scene mx-auto w-full max-w-xl">
    <div class="card-3d relative" :class="{ 'is-flipped': flipped }">
      <!-- 正面：题干 + 场景图 + 输入 -->
      <div
        class="card-face rounded-3xl bg-white p-5 shadow-xl ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10"
      >
        <div class="mb-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span v-if="question.categoryName" class="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-700">
            {{ question.categoryName }}
          </span>
          <span
            v-if="difficultyText"
            class="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          >
            {{ difficultyText }}
          </span>
          <span class="ml-auto">今日 {{ question.todayDone }}/{{ question.todayGoal }}</span>
        </div>

        <h2 class="mb-4 text-center text-lg font-semibold text-slate-800 dark:text-slate-100">
          {{ question.translationZh }}
        </h2>

        <div class="aspect-video overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-700">
          <img
            v-if="question.imageUrl"
            :src="question.imageUrl"
            :alt="question.translationZh"
            class="h-full w-full object-cover"
            loading="lazy"
          />
          <div v-else class="flex h-full items-center justify-center text-sm text-slate-400">配图缺失</div>
        </div>

        <form class="mt-4 flex gap-2" @submit.prevent="onSubmit">
          <input
            ref="inputRef"
            v-model="answer"
            type="text"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder="输入对应的英文句子"
            class="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-sky-400 focus:bg-white dark:border-slate-600 dark:bg-slate-900 dark:focus:border-sky-500"
            :disabled="submitting"
          />
          <button
            type="submit"
            class="rounded-xl bg-sky-600 px-6 py-3 text-base font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
            :disabled="submitting || !answer.trim()"
          >
            {{ submitting ? '判定中' : '确定' }}
          </button>
        </form>
      </div>

      <!-- 背面：正确答案 -->
      <div
        class="card-face card-face--back absolute inset-0 rounded-3xl bg-white p-5 shadow-xl ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10"
      >
        <div class="flex h-full flex-col">
          <div class="mb-2 flex items-center gap-2">
            <span
              class="rounded-full px-3 py-1 text-sm font-medium"
              :class="
                result?.isCorrect
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
              "
            >
              {{ result?.isCorrect ? '答对了' : '再想想' }}
            </span>
            <button
              class="ml-auto rounded-full p-2 text-lg transition hover:bg-slate-100 dark:hover:bg-slate-700"
              :class="result?.favorited ? 'text-amber-500' : 'text-slate-400'"
              title="收藏"
              @click="emit('favorite')"
            >
              {{ result?.favorited ? '★' : '☆' }}
            </button>
          </div>

          <p class="text-xl font-semibold leading-snug text-slate-800 dark:text-slate-100">
            {{ result?.sentenceEn }}
          </p>
          <p v-if="result?.ipa" class="mt-1 font-mono text-sm text-slate-500 dark:text-slate-400">
            {{ result.ipa }}
          </p>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {{ result?.translationZh }}
          </p>

          <div v-if="!result?.isCorrect" class="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-700/50">
            <p class="text-slate-400">你的答案</p>
            <p class="text-slate-600 line-through dark:text-slate-300">{{ answer }}</p>
          </div>

          <div class="mt-auto flex items-center justify-between pt-4 text-xs text-slate-400">
            <span>按 回车 或点击按钮继续</span>
            <button
              class="rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500"
              @click="emit('next')"
            >
              下一题
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
