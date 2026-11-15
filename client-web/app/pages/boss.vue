<script setup lang="ts">
/**
 * 每日 Boss（路由 /boss）。
 *
 * 每天固定一道挑战题（服务端按日期确定性选取，所有人同题），答对额外 +30 经验，
 * 一天一次（服务端幂等）。页面上不出现英文原句——与刷题同一套「防偷看」口径，
 * 提交后才在结果里揭晓答案与解析。
 */
import { computed, onMounted, ref } from 'vue';
import { apiFetch } from '~/composables/useApi';
import type { BossAnswerResult, BossToday } from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '每日 Boss',
  description: '每天一道挑战句：答对额外得经验，一天一次。',
  indexable: false,
});

const boss = ref<BossToday | null>(null);
const loading = ref(true);
const error = ref('');
const answer = ref('');
const submitting = ref(false);
const result = ref<BossAnswerResult | null>(null);

/** 难度文案（与题卡一致）。 */
const difficultyText = computed(() => ['', '基础', '进阶', '挑战'][boss.value?.question?.difficulty ?? 0] ?? '');

const canSubmit = computed(() => answer.value.trim().length > 0 && !submitting.value);

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    boss.value = await apiFetch<BossToday>('/client/questions/boss');
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

async function submit(): Promise<void> {
  const question = boss.value?.question;
  if (!question || !canSubmit.value) {
    return;
  }
  submitting.value = true;
  error.value = '';
  try {
    result.value = await apiFetch<BossAnswerResult>('/client/questions/boss/answer', {
      method: 'POST',
      body: { sentenceId: question.sentenceId, userAnswer: answer.value.trim() },
    });
    if (result.value.isCorrect) {
      boss.value = { ...(boss.value as BossToday), cleared: true };
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '提交失败，请稍后重试';
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
    <!-- 头部 -->
    <header class="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
          <span
            class="grid h-8 w-8 place-items-center rounded-xl bg-linear-to-br from-amber-500 to-orange-600 text-white"
          >
            <UIcon name="i-lucide-swords" class="h-4.5 w-4.5" />
          </span>
          每日 Boss
        </h1>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          每天一道挑战句 · 答对额外
          <span class="font-semibold text-amber-600 dark:text-amber-400">+{{ boss?.bonusXp ?? 30 }} 经验</span>
          · 一天一次
        </p>
      </div>
      <UBadge v-if="boss?.date" color="neutral" variant="subtle" size="sm">{{ boss.date }}</UBadge>
    </header>

    <div v-if="loading" class="space-y-3">
      <USkeleton class="h-28 w-full rounded-2xl" />
      <USkeleton class="h-44 w-full rounded-2xl" />
    </div>

    <UAlert v-else-if="error && !boss" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" />

    <!-- 已通关 -->
    <UCard v-else-if="boss?.cleared && !result" :ui="{ body: 'p-6' }">
      <div class="py-6 text-center">
        <div
          class="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-linear-to-br from-amber-500 to-orange-600 text-white"
        >
          <UIcon name="i-lucide-trophy" class="h-8 w-8" />
        </div>
        <h2 class="mt-4 text-lg font-bold text-slate-800 dark:text-slate-100">今天已经通关了</h2>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">明天 0 点刷新下一道 Boss，回来继续挑战。</p>
        <div class="mt-5 flex justify-center gap-2">
          <UButton to="/" icon="i-lucide-layers" size="sm">去刷题</UButton>
          <UButton to="/profile" color="neutral" variant="soft" size="sm">看成长</UButton>
        </div>
      </div>
    </UCard>

    <!-- 无题 -->
    <UCard v-else-if="!boss?.question" :ui="{ body: 'p-6' }">
      <p class="py-8 text-center text-sm text-slate-500">今天的 Boss 还在准备中，晚点再来看看。</p>
    </UCard>

    <!-- 题目 -->
    <template v-else>
      <UCard :ui="{ body: 'p-5' }">
        <div class="mb-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <UBadge v-if="boss.question.categoryName" color="primary" variant="subtle" size="sm">
            {{ boss.question.categoryName }}
          </UBadge>
          <UBadge color="warning" variant="subtle" size="sm">{{ difficultyText }}</UBadge>
          <span class="ml-auto inline-flex items-center gap-1">
            <UIcon name="i-lucide-flame" class="h-3.5 w-3.5 text-orange-500" />
            +{{ boss.bonusXp }} 经验
          </span>
        </div>

        <div class="rounded-2xl bg-slate-50 px-4 py-3 text-center dark:bg-slate-700/40">
          <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {{ boss.question.translationZh }}
          </h2>
        </div>

        <div v-if="boss.question.imageUrl" class="mt-4 aspect-video overflow-hidden rounded-2xl bg-slate-100">
          <img :src="boss.question.imageUrl" alt="" class="h-full w-full object-cover" loading="lazy" />
        </div>

        <div class="mt-4 space-y-3">
          <UInput
            v-model="answer"
            size="lg"
            placeholder="写出这句英文…"
            :disabled="!!result"
            class="w-full"
            @keyup.enter="submit"
          />
          <UButton
            v-if="!result"
            block
            size="lg"
            :loading="submitting"
            :disabled="!canSubmit"
            icon="i-lucide-swords"
            @click="submit"
          >
            挑战
          </UButton>
        </div>

        <UAlert
          v-if="error && boss"
          class="mt-3"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="error"
        />
      </UCard>

      <!-- 结果 -->
      <UCard v-if="result" class="mt-4" :ui="{ body: 'p-5' }">
        <div class="flex items-start gap-3">
          <span
            class="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
            :class="result.isCorrect ? 'bg-emerald-500' : 'bg-rose-500'"
          >
            <UIcon :name="result.isCorrect ? 'i-lucide-check' : 'i-lucide-x'" class="h-5 w-5" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <p
                class="text-sm font-semibold"
                :class="
                  result.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                "
              >
                {{ result.isCorrect ? '挑战成功' : '差一点' }}
              </p>
              <UBadge v-if="result.bossCleared" color="warning" variant="subtle" size="sm">
                <UIcon name="i-lucide-trophy" class="mr-0.5 h-3 w-3" />今日通关
              </UBadge>
              <span v-if="(result.xpEarned ?? 0) > 0" class="text-xs text-amber-600 dark:text-amber-400">
                +{{ result.xpEarned }} 经验<template v-if="result.bossBonus > 0"
                  >（含通关 +{{ result.bossBonus }}）</template
                >
              </span>
            </div>
            <p
              class="mt-2 flex flex-wrap items-baseline gap-2 text-xl font-semibold text-slate-800 dark:text-slate-100"
            >
              {{ result.sentenceEn }}
              <TtsButton :text="result.sentenceEn" lang="en-US" />
            </p>
            <p v-if="result.ipa" class="mt-1 font-mono text-sm text-sky-600 dark:text-sky-400">{{ result.ipa }}</p>
            <p
              v-if="result.explanation"
              class="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300"
            >
              {{ result.explanation }}
            </p>
            <div v-if="!result.isCorrect && result.bossCleared === false" class="mt-4 flex gap-2">
              <UButton
                size="sm"
                color="neutral"
                variant="soft"
                icon="i-lucide-rotate-ccw"
                @click="
                  result = null;
                  answer = '';
                "
              >
                再试一次
              </UButton>
            </div>
            <div class="mt-4 flex gap-2">
              <UButton to="/" size="sm" icon="i-lucide-layers">去刷题</UButton>
              <UButton to="/profile" size="sm" color="neutral" variant="soft">看成长</UButton>
            </div>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
