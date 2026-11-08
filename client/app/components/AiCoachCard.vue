<script setup lang="ts">
/**
 * AI 私教卡片：薄弱点画像（始终可用）+ 可选 AI 点评。
 *
 * 画像那层不依赖 AI 密钥，规则引擎直接给今日复习计划；AI 点评是增强，
 * 后端在任何不可用情况下都会降级为规则文案，所以这里永远不需要处理 5xx。
 */
import { computed, ref } from 'vue';
import { apiFetch } from '~/composables/useApi';

interface CoachCategory {
  categoryId: number;
  name: string;
  total: number;
  correct: number;
  accuracy: number;
}
interface CoachToughSentence {
  sentenceId: number;
  translationZh: string;
  wrongCount: number;
}
interface CoachProfile {
  totalAnswers: number;
  correctAnswers: number;
  accuracy: number;
  todayAnswers: number;
  dueToday: number;
  streak: number;
  weakCategories: CoachCategory[];
  toughSentences: CoachToughSentence[];
  plan: string[];
  focus: string;
  aiAvailable: boolean;
}
interface CoachAdvice {
  text: string;
  source: 'ai' | 'rule';
}

const { data: profile } = await useFetch<CoachProfile>('/api/client/ai/coach/profile', {
  default: () => ({
    totalAnswers: 0,
    correctAnswers: 0,
    accuracy: 0,
    todayAnswers: 0,
    dueToday: 0,
    streak: 0,
    weakCategories: [],
    toughSentences: [],
    plan: [],
    focus: '',
    aiAvailable: false,
  }),
});

const advice = ref<CoachAdvice | null>(null);
const loading = ref(false);
const error = ref('');

const accuracyPct = computed(() => Math.round((profile.value?.accuracy ?? 0) * 100));

async function askCoach(): Promise<void> {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    advice.value = await apiFetch<CoachAdvice>('/client/ai/coach/advice', { method: 'POST' });
  } catch (e) {
    error.value = e instanceof Error ? e.message : '生成失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <UIcon name="i-lucide-graduation-cap" class="h-4 w-4 text-indigo-500" />
        AI 私教
      </h3>
      <span class="text-xs text-slate-400">按你的数据排计划</span>
    </div>

    <!-- 概览 -->
    <div class="grid grid-cols-4 gap-2 text-center">
      <div>
        <div class="text-lg font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{{ accuracyPct }}%</div>
        <div class="text-[10px] text-slate-400">正确率</div>
      </div>
      <div>
        <div class="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">
          {{ profile?.totalAnswers ?? 0 }}
        </div>
        <div class="text-[10px] text-slate-400">累计作答</div>
      </div>
      <div>
        <div class="text-lg font-bold tabular-nums text-amber-500">{{ profile?.streak ?? 0 }}</div>
        <div class="text-[10px] text-slate-400">连续打卡</div>
      </div>
      <div>
        <div class="text-lg font-bold tabular-nums text-orange-500">{{ profile?.dueToday ?? 0 }}</div>
        <div class="text-[10px] text-slate-400">待复习</div>
      </div>
    </div>

    <!-- 今日重点 -->
    <div
      v-if="profile?.focus"
      class="mt-4 rounded-xl bg-indigo-50 px-3 py-2.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200/70 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/20"
    >
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-target" class="h-4 w-4 shrink-0" />
        <span>今日重点：{{ profile.focus }}</span>
      </div>
    </div>

    <!-- 薄弱场景 -->
    <template v-if="profile?.weakCategories?.length">
      <p class="mb-2 mt-4 text-xs text-slate-400">需要补的场景</p>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="c in profile.weakCategories"
          :key="c.categoryId"
          class="rounded-lg bg-orange-50 px-2.5 py-1 text-xs text-orange-600 ring-1 ring-orange-200/70 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/20"
        >
          {{ c.name }} · {{ Math.round(c.accuracy * 100) }}%
        </span>
      </div>
    </template>

    <!-- 今日复习计划（规则生成，始终可用） -->
    <template v-if="profile?.plan?.length">
      <p class="mb-2 mt-4 text-xs text-slate-400">今日复习计划</p>
      <ul class="space-y-2">
        <li
          v-for="(item, i) in profile.plan"
          :key="i"
          class="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"
        >
          <span
            class="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          >
            {{ i + 1 }}
          </span>
          <span>{{ item }}</span>
        </li>
      </ul>
    </template>

    <!-- 反复错题 -->
    <template v-if="profile?.toughSentences?.length">
      <p class="mb-1 mt-4 text-xs text-slate-400">总也记不住的句子</p>
      <p class="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {{ profile.toughSentences.map((t) => `「${t.translationZh}」×${t.wrongCount}`).join('、') }}
      </p>
    </template>

    <!-- AI 点评（可选增强） -->
    <div class="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
      <div class="flex items-center justify-between gap-2">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
          :disabled="loading"
          @click="askCoach"
        >
          <UIcon name="i-lucide-sparkles" class="h-3.5 w-3.5" />
          {{ loading ? '思考中…' : advice ? '再听一句' : '让私教说两句' }}
        </button>
        <span class="text-right text-[10px] leading-tight text-slate-400">
          {{ profile?.aiAvailable ? '会占用 1 次今日 AI 额度' : '当前为规则建议' }}
        </span>
      </div>
      <div
        v-if="advice"
        class="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200/70 dark:bg-slate-800/50 dark:text-slate-200 dark:ring-slate-700/60"
      >
        {{ advice.text }}
        <span v-if="advice.source === 'rule'" class="ml-1 text-slate-400">（规则建议）</span>
      </div>
      <p v-if="error" class="mt-2 text-xs text-rose-500">{{ error }}</p>
    </div>
  </div>
</template>
