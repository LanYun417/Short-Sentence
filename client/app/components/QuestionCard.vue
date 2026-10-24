<script setup lang="ts">
/**
 * 刷题闪卡（3D 翻转）。
 * 交互状态机：answering →（提交/确定/回车）→ flipped →（下一题/回车）→ 下一张。
 *
 * 翻牌规则：
 * - 提交答案 → 翻到背面看结果；
 * - 点「下一题」→ 先保持背面并显示加载态，新题到达后**同方向继续从左往右翻**揭示新题
 *   （累计 +180°，一路向前不回翻；而不是把卡片整个换掉硬切）——所以本组件不能用
 *   :key 强制重建，否则 DOM 换新、transition 没有起点，翻牌动画就没了。
 */
import type { AnswerResult, NextQuestion } from '~/types';
import type { AnswerMode } from '~/composables/useQuestionSession';
import { apiFetch } from '~/composables/useApi';

const props = defineProps<{
  /** 当前题目（sentenceId 变化即换卡） */
  question: NextQuestion;
  /** 提交后的结果（null = 未提交/翻转前） */
  result: AnswerResult | null;
  /** 提交请求中（禁用确定按钮） */
  submitting: boolean;
  /** 正在拉取下一题（背面显示加载态，到达后翻回正面） */
  loading: boolean;
  /** 作答模式：input 自己敲，assemble 点选词块 */
  mode: AnswerMode;
}>();

const emit = defineEmits<{
  (e: 'submit', answer: string): void;
  (e: 'next'): void;
  (e: 'favorite'): void;
}>();

/** 配图地址。 */
const imageSrc = computed(() => props.question.imageUrl);

/** 用户输入 */
const answer = ref('');
/** @nuxt/ui 的 UInput 暴露 inputRef，用于换卡后自动聚焦 */
const inputRef = ref<{ inputRef?: HTMLInputElement } | null>(null);

/** 翻转态（有结果即翻转） */
const flipped = computed(() => props.result !== null);

/**
 * 是否走拼词作答。
 * 词块由后端随题下发；万一缺失（旧缓存、接口异常）自动回落到输入框，不至于卡住。
 */
const assembleMode = computed(() => props.mode === 'assemble' && (props.question.words?.length ?? 0) > 0);

/** 拼词模式下词块是否已全部用上（决定「确定」可用性，避免点一个词就交）。 */
const wordsAllUsed = computed(() => {
  const total = props.question.words?.length ?? 0;
  if (total === 0) {
    return false;
  }
  const used = answer.value.trim().split(/\s+/).filter(Boolean).length;
  return used >= total;
});

/** 能否提交：拼词要求词块全部用完，输入要求非空。 */
const canSubmit = computed(() => (assembleMode.value ? wordsAllUsed.value : answer.value.trim().length > 0));

/**
 * 累计翻转角度（绕 Y 轴，横向「从左往右」翻）。
 * 每次 flipped 变化 +180°，始终同方向（正向＝从左往右）继续翻——确定(0→180)看背面、
 * 下一题(180→360)继续翻到正面，确定与下一题都是从左往右、一路向前不「返回来」。
 * 注意不能对 360 取模：取模会让 180→360 变回 180→0，又成了反向回翻。
 */
const flipDeg = ref(0);
watch(flipped, () => {
  flipDeg.value += 180;
});

/** 难度文案 */
const difficultyText = computed(() => ['', '基础', '进阶', '挑战'][props.question.difficulty] ?? '');

/** 收藏按钮的「弹一下」反馈（点击后瞬时放大） */
const favPop = ref(false);
let favTimer: ReturnType<typeof setTimeout> | 0 = 0;

/** 聚焦输入框。 */
function focusInput(): void {
  void nextTick(() => inputRef.value?.inputRef?.focus());
}

// 换卡重置输入并聚焦
watch(
  () => props.question.sentenceId,
  () => {
    answer.value = '';
    // 等翻牌动画基本结束再聚焦，避免输入法键盘在动画途中弹出
    window.setTimeout(focusInput, 320);
  },
);

onMounted(() => {
  focusInput();
  window.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.clearTimeout(favTimer);
});

/** 回车双态：输入态=提交，翻转态=下一题。 */
function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter') {
    return;
  }
  // 输入框内回车由表单 submit 处理，避免双触发
  if (document.activeElement === inputRef.value?.inputRef && !flipped.value) {
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
  if (props.submitting || flipped.value || !canSubmit.value) {
    return;
  }
  emit('submit', answer.value.trim());
}

/** 拼词区回传拼接结果（与输入框共用同一个 answer 状态）。 */
function onAssembleAnswer(value: string): void {
  answer.value = value;
}

/** 收藏（带瞬时放大反馈）。 */
function onFavorite(): void {
  favPop.value = true;
  window.clearTimeout(favTimer);
  favTimer = window.setTimeout(() => {
    favPop.value = false;
  }, 400);
  emit('favorite');
}

/* ------------------------------ 举报 / 反馈 ------------------------------ */

/** 反馈类型选项（value 与后端 reason 枚举一致）。 */
const REPORT_REASONS = [
  { value: 'wrong', label: '题目/翻译有误' },
  { value: 'inappropriate', label: '内容不适当' },
  { value: 'image', label: '图片不雅/有问题' },
  { value: 'other', label: '其他' },
];

const reportOpen = ref(false);
const reportReason = ref('wrong');
const reportDescription = ref('');
const reportSubmitting = ref(false);
const reportMessage = ref('');
/** 最近一次提交是否成功（决定提示文案配色）。 */
const reportOk = ref(false);

/** 打开举报弹窗（重置表单）。 */
function openReport(): void {
  reportReason.value = 'wrong';
  reportDescription.value = '';
  reportMessage.value = '';
  reportOk.value = false;
  reportOpen.value = true;
}

/** 提交举报/反馈（成功后延时自动关闭）。 */
async function onSubmitReport(): Promise<void> {
  if (reportSubmitting.value) {
    return;
  }
  reportSubmitting.value = true;
  reportMessage.value = '';
  try {
    await apiFetch('/client/report', {
      method: 'POST',
      body: {
        sentenceId: props.question.sentenceId,
        reason: reportReason.value,
        description: reportDescription.value.trim() || undefined,
      },
    });
    reportOk.value = true;
    reportMessage.value = '已收到，感谢你的反馈';
    reportDescription.value = '';
    window.setTimeout(() => {
      reportOpen.value = false;
    }, 1200);
  } catch (error) {
    reportOk.value = false;
    reportMessage.value = error instanceof Error ? error.message : '提交失败，请稍后重试';
  } finally {
    reportSubmitting.value = false;
  }
}
</script>

<template>
  <div class="card-scene anim-in mx-auto w-full max-w-xl">
    <div class="card-3d relative" :style="{ transform: `rotateY(${flipDeg}deg)` }">
      <!-- 正面：题干 + 场景图 + 输入 -->
      <div
        class="card-face rounded-3xl bg-white p-5 shadow-xl ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10"
      >
        <div class="mb-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <UBadge v-if="question.categoryName" color="primary" variant="subtle" size="sm">
            {{ question.categoryName }}
          </UBadge>
          <UBadge v-if="difficultyText" color="warning" variant="subtle" size="sm">
            {{ difficultyText }}
          </UBadge>
          <span class="ml-auto tabular-nums">今日 {{ question.todayDone }}/{{ question.todayGoal }}</span>
          <UButton
            icon="i-lucide-flag"
            variant="ghost"
            color="neutral"
            size="xs"
            title="举报 / 反馈此题"
            aria-label="举报或反馈此题"
            @click="openReport"
          />
        </div>

        <!-- 题干 -->
        <div class="mb-4 rounded-2xl bg-slate-50 px-4 py-3 text-center dark:bg-slate-700/40">
          <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {{ question.translationZh }}
          </h2>
        </div>

        <div
          class="aspect-video overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-black/5 dark:bg-slate-700 dark:ring-white/10"
        >
          <img
            v-if="question.imageUrl"
            :src="imageSrc"
            :alt="question.translationZh"
            class="anim-fade h-full w-full object-cover transition-transform duration-700 hover:scale-105"
            loading="lazy"
          />
          <div v-else class="flex h-full items-center justify-center text-sm text-slate-400">配图缺失</div>
        </div>

        <!-- 作答区：拼词模式点词块，输入模式自己敲 -->
        <div class="mt-4">
          <template v-if="assembleMode">
            <AssembleAnswer :words="question.words ?? []" :disabled="submitting" @update:answer="onAssembleAnswer" />
            <div class="mt-3 flex justify-end">
              <UButton
                type="button"
                size="lg"
                :loading="submitting"
                :disabled="!canSubmit"
                class="group [&_svg]:transition-transform [&_svg]:group-hover:translate-x-0.5"
                @click="onSubmit"
              >
                确定
                <template #trailing>
                  <UIcon name="i-lucide-corner-down-left" class="h-4 w-4" />
                </template>
              </UButton>
            </div>
          </template>

          <form v-else class="flex gap-2" @submit.prevent="onSubmit">
            <UInput
              ref="inputRef"
              v-model="answer"
              type="text"
              size="lg"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              placeholder="输入对应的英文句子"
              class="flex-1"
              :disabled="submitting"
            />
            <UButton
              type="submit"
              size="lg"
              :loading="submitting"
              :disabled="!canSubmit"
              class="group [&_svg]:transition-transform [&_svg]:group-hover:translate-x-0.5"
            >
              确定
              <template #trailing>
                <UIcon name="i-lucide-corner-down-left" class="h-4 w-4" />
              </template>
            </UButton>
          </form>
        </div>
      </div>

      <!-- 背面：加载中 / 正确答案 -->
      <div
        class="card-face card-face--back absolute inset-0 rounded-3xl bg-white p-5 shadow-xl ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10"
      >
        <!-- 加载下一题：保持背面转一会儿，比直接硬切自然 -->
        <div v-if="loading" class="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
          <UIcon name="i-lucide-loader-circle" class="h-9 w-9 animate-spin text-sky-500" />
          <p class="text-sm">加载下一题…</p>
        </div>

        <div v-else class="flex h-full flex-col">
          <!-- 结果条 -->
          <div
            class="anim-pop mb-3 flex items-center gap-2 rounded-2xl px-3 py-2"
            :class="
              result?.isCorrect
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
            "
          >
            <UIcon :name="result?.isCorrect ? 'i-lucide-check-circle-2' : 'i-lucide-x-circle'" class="h-5 w-5" />
            <span class="font-semibold">{{ result?.isCorrect ? '答对了' : '再想想' }}</span>
            <UButton
              variant="ghost"
              class="ml-auto transition-transform duration-200"
              :class="[favPop && 'scale-125', result?.favorited && '[&_svg]:fill-current']"
              :color="result?.favorited ? 'warning' : 'neutral'"
              icon="i-lucide-star"
              title="收藏"
              @click="onFavorite"
            />
          </div>

          <p class="text-xl font-semibold leading-snug text-slate-800 dark:text-slate-100">
            {{ result?.sentenceEn }}
          </p>
          <p v-if="result?.ipa" class="mt-1 font-mono text-sm text-sky-600 dark:text-sky-400">
            {{ result.ipa }}
          </p>
          <!-- 输入模式多答案：列出该句中其它同样算对的写法 -->
          <div v-if="result?.validAnswers?.length" class="mt-2.5 space-y-1.5" data-testid="valid-answers">
            <p class="text-xs font-medium text-slate-400 dark:text-slate-500">这些说法也算对</p>
            <p
              v-for="answer in result.validAnswers"
              :key="answer"
              class="text-[15px] leading-snug text-slate-600 dark:text-slate-300"
            >
              {{ answer }}
            </p>
          </div>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {{ result?.translationZh }}
          </p>

          <div v-if="!result?.isCorrect" class="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-700/50">
            <p class="text-slate-400">你的答案</p>
            <p class="text-slate-600 line-through dark:text-slate-300">{{ answer }}</p>
          </div>

          <div class="mt-auto flex items-center justify-between pt-4 text-xs text-slate-400">
            <span class="flex items-center gap-1.5">
              <UIcon name="i-lucide-corner-down-left" class="h-3.5 w-3.5" />
              回车继续
            </span>
            <UButton
              size="sm"
              class="group [&_svg]:transition-transform [&_svg]:group-hover:translate-x-1"
              @click="emit('next')"
            >
              下一题
              <template #trailing>
                <UIcon name="i-lucide-arrow-right" class="h-4 w-4" />
              </template>
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 举报 / 反馈弹窗：放在 3D 场景外（card-scene 的 perspective 会影响模态定位）-->
  <UModal
    v-model:open="reportOpen"
    title="举报 / 反馈"
    description="题目有错、内容或图片不适当？告诉我们，运营会核查处理。"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="反馈类型">
          <USelect v-model="reportReason" :items="REPORT_REASONS" value-key="value" label-key="label" class="w-full" />
        </UFormField>
        <UFormField label="补充说明" help="选填，描述具体问题（最多 500 字）">
          <UTextarea
            v-model="reportDescription"
            :rows="3"
            maxlength="500"
            autoresize
            class="w-full"
            placeholder="例如：英文句子有语法错误 / 配图令人不适…"
          />
        </UFormField>
        <p
          v-if="reportMessage"
          class="text-sm"
          :class="reportOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'"
        >
          {{ reportMessage }}
        </p>
      </div>
    </template>
    <template #footer="{ close }">
      <div class="flex items-center justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="close">取消</UButton>
        <UButton :loading="reportSubmitting" @click="onSubmitReport">提交</UButton>
      </div>
    </template>
  </UModal>
</template>
