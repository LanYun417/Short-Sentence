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
import { streamSse } from '~/composables/useSse';

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
  /** 是否显示「换一题」（跳过当前题；由页面决定，避免组件里写死请求逻辑） */
  canSkip?: boolean;
}>();

const emit = defineEmits<{
  (e: 'submit', answer: string): void;
  (e: 'next'): void;
  (e: 'favorite'): void;
  (e: 'skip'): void;
  (e: 'change-mode', mode: AnswerMode): void;
}>();

/** 配图地址。 */
// 归一到 undefined（而不是 null）：`<img :src>` 只接受 string | undefined
const imageSrc = computed(() => props.question.imageUrl ?? undefined);

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
/**
 * 翻转时**不隐藏正面**，让卡片高度在翻转前后保持一致：
 * 两面在 grid 里叠同一格（.card-3d），高度取较高者——正面含 16:9 配图，通常比背面答案高，
 * 所以卡片高度恒等于正面高度。背面（答案）内容比正面矮时，卡片留有自然余量，
 * 底部「回车继续 / 下一题」贴底、内容顶对齐，不强行把卡片收缩到背面高度（那样会有突兀的高度跳变）。
 * 正面在翻到背面时被 3D 转到背向（backface-visibility 隐身），不影响观感，只保留其 grid 占位以维持高度。
 */
watch(flipped, () => {
  flipDeg.value += 180;
});

/** 难度文案 */
const difficultyText = computed(() => ['', '基础', '进阶', '挑战'][props.question.difficulty] ?? '');

/** 收藏按钮的「弹一下」反馈（点击后瞬时放大） */
const favPop = ref(false);
/**
 * 收藏按钮的复位定时器。
 *
 * 显式用 `number`（浏览器定时器）而不是 `ReturnType<typeof setTimeout>`：
 * 工程里同时存在 Node 类型，后者会被解析成 `NodeJS.Timeout`，与 `window.setTimeout`
 * 的返回值不兼容（同一类坑：混用 window / global 定时器类型）。
 */
let favTimer: number | undefined;

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

// 切换作答模式：清空上一模式残留的作答（输入 / 拼词两种形态不同，避免串味）。
// 切模式不再重抽题，故需在此显式清空，否则已拼好的句子会带进输入框。
watch(
  () => props.mode,
  () => {
    answer.value = '';
  },
);

/* ------------------------------ 题目解析 ------------------------------ */

/**
 * 题目解析（无论对错都展示）：语法结构 + 关键词形态（时态 / 过去式 / 复数…）。
 *
 * 两级来源：
 * 1. **题目自带解析**（生题时由模型生成，随 `result.explanation` 下发）——直接展示，
 *    零延迟、零 AI 调用；
 * 2. 老题尚未回填（explanation 为空）时才回退到**流式 AI 实时生成**（`/client/ai/analyze`），
 *    后端在流正常结束后会把结果**写回 `sentence.explanation`**，同一道题下次直接命中第 1 条。
 *
 * 换下一题（结果清空 / 进入加载）时中止并复位，避免串题与白烧额度。
 */
const analysisText = ref('');
/** idle 未开始 / loading 生成中 / done 完成 / error 失败 */
const analysisState = ref<'idle' | 'loading' | 'done' | 'error'>('idle');
/** 中止句柄：换题 / 卸载时终止上游，避免浪费额度与串题 */
let analysisAbort: (() => void) | null = null;
/**
 * 本次解析对应的句子 id。
 * 迟到分片（旧流在新题到达后才回来）据此丢弃，避免解析串到下一题。
 */
let analysisFor: number | null = null;

/** 中止当前解析并复位。 */
function resetAnalysis(): void {
  analysisAbort?.();
  analysisAbort = null;
  analysisFor = null;
  analysisText.value = '';
  analysisState.value = 'idle';
}

/** 生成题目解析：优先用题目自带解析，没有才调 AI（流式展示，纯文本多行原样渲染）。 */
async function startAnalysis(): Promise<void> {
  const current = props.result;
  if (!current) {
    return;
  }
  analysisAbort?.();
  analysisAbort = null;
  analysisFor = current.sentenceId;

  // 第一条路：题目自带解析——即刻展示，不发起任何请求
  const baked = current.explanation?.trim();
  if (baked) {
    analysisText.value = baked;
    analysisState.value = 'done';
    return;
  }

  // 第二条路：老题兜底，实时流式生成
  analysisText.value = '';
  analysisState.value = 'loading';
  const stream = await streamSse(
    '/client/ai/analyze',
    { sentenceId: current.sentenceId },
    {
      onChunk: (text) => {
        if (analysisFor !== current.sentenceId) {
          return;
        }
        analysisText.value += text;
      },
      onDone: () => {
        if (analysisFor === current.sentenceId) {
          analysisState.value = 'done';
        }
      },
      onError: () => {
        if (analysisFor === current.sentenceId) {
          analysisState.value = 'error';
        }
      },
    },
  );
  analysisAbort = stream.abort;
}

// 拿到结果（无论对错）即自动生成解析；结果被清空（换题）则中止复位
watch(
  () => props.result,
  (value) => {
    if (value) {
      void startAnalysis();
    } else {
      resetAnalysis();
    }
  },
);

// 进入下一题加载态时（此时 result 还挂着上一题）立即中止，避免旧解析白跑
watch(
  () => props.loading,
  (value) => {
    if (value) {
      resetAnalysis();
    }
  },
);

onMounted(() => {
  focusInput();
  window.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.clearTimeout(favTimer);
  resetAnalysis();
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
      <!-- min-w-0：card-face 是 .card-3d(grid) 的 grid item，默认 min-width:auto 会被内部 nowrap 滚动容器
           （拼词已选区）的 min-content（词块总宽）撑爆，把整卡顶出 max-w-xl 列宽；置 0 让它收缩到网格可用宽度。 -->
      <div
        class="card-face min-w-0 rounded-3xl bg-white p-5 shadow-xl ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10"
      >
        <!--
          顶栏：分类/难度 → 「换一题」→ 今日进度 → 举报。
          「换一题」原先贴在卡片下方右对齐（离题目远、要额外扫一眼），
          收进顶栏后与题卡信息同处一行，且不抢底部「确定」的主操作位。
        -->
        <div class="mb-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <UBadge v-if="question.categoryName" color="primary" variant="subtle" size="sm">
            {{ question.categoryName }}
          </UBadge>
          <UBadge v-if="difficultyText" color="warning" variant="subtle" size="sm">
            {{ difficultyText }}
          </UBadge>
          <div class="ml-auto flex shrink-0 items-center gap-1">
            <UButton
              v-if="canSkip"
              icon="i-lucide-refresh-cw"
              variant="ghost"
              color="neutral"
              size="xs"
              title="换一题（跳过当前题）"
              aria-label="换一题"
              :loading="loading"
              @click="emit('skip')"
            >
              <!-- 极窄屏（<380px）只留图标，避免顶栏挤爆（社区机型 360px 仍常见） -->
              <span class="hidden min-[380px]:inline">换一题</span>
            </UButton>
            <span class="whitespace-nowrap tabular-nums">今日 {{ question.todayDone }}/{{ question.todayGoal }}</span>
            <UButton
              icon="i-lucide-flag"
              variant="ghost"
              color="neutral"
              size="xs"
              title="举报 / 反馈此题"
              aria-label="举报或反馈此题"
              @click="openReport"
            />
            <!-- 作答方式切换：顶栏最右，随时可切（<460px 只显图标） -->
            <PracticeModePicker :model-value="mode" class="ml-1" @update:model-value="emit('change-mode', $event)" />
          </div>
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

      <!--
        背面：加载中 / 正确答案。
        两面在 CSS 里叠成同一格（.card-3d 是 grid），**卡片高度取较高的一面**——
        正面带 16:9 配图本来就比背面高，所以翻面前后卡片高度一致（不收缩，避免高度跳变）。
        背面**只在提交后 / 换题加载中才渲染**——否则未作答时它就先把卡片撑高了。
        内容也不需要卡内滚动：超长时整页滚一下就能看全（单一滚动轴，
        比「卡里还能滚」的嵌套滚动更直观）。
      -->
      <div
        v-if="result || loading"
        class="card-face card-face--back overflow-hidden rounded-3xl bg-white p-5 shadow-xl ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10"
      >
        <!-- 加载下一题：保持背面转一会儿，比直接硬切自然 -->
        <div v-if="loading" class="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
          <UIcon name="i-lucide-loader-circle" class="h-9 w-9 animate-spin text-sky-500" />
          <p class="text-sm">加载下一题…</p>
        </div>

        <div v-else class="flex min-h-full flex-col">
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

          <!--
            答案内容区：顶对齐流式排布，**不做垂直居中**——内容紧随「答对了」标题之后；
            flex-1 只负责把底部操作栏压到卡片底边（内容超高时整卡变高、整页滚动看全）。
          -->
          <div class="flex flex-1 flex-col py-0.5">
            <div class="flex items-start justify-between gap-2">
              <p class="text-xl font-semibold leading-snug text-slate-800 dark:text-slate-100">
                {{ result?.sentenceEn }}
              </p>
              <!-- 翻转看答案后，可点读正确答案英文（零依赖 speechSynthesis） -->
              <TtsButton v-if="result" :text="result.sentenceEn" lang="en-US" />
            </div>
            <p v-if="result?.ipa" class="mt-1 font-mono text-sm text-sky-600 dark:text-sky-400">
              {{ result.ipa }}
            </p>
            <!-- 输入模式多答案：列出该句中其它同样算对的写法 -->
            <div v-if="result?.validAnswers?.length" class="mt-2.5 space-y-1.5" data-testid="valid-answers">
              <p class="text-xs font-medium text-slate-400 dark:text-slate-500">这些说法也算对</p>
              <p
                v-for="alternative in result.validAnswers"
                :key="alternative"
                class="text-[15px] leading-snug text-slate-600 dark:text-slate-300"
              >
                {{ alternative }}
              </p>
            </div>
            <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {{ result?.translationZh }}
            </p>

            <div v-if="!result?.isCorrect" class="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-700/50">
              <p class="text-slate-400">你的答案</p>
              <p class="text-slate-600 line-through dark:text-slate-300">{{ answer }}</p>
            </div>

            <!-- 题目解析：无论对错都展示；优先题目自带解析，老题回退流式生成 -->
            <div class="mt-3 rounded-xl bg-sky-50/70 p-3 ring-1 ring-sky-100 dark:bg-sky-500/10 dark:ring-sky-500/15">
              <p class="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
                <UIcon name="i-lucide-sparkles" class="h-3.5 w-3.5" />
                题目解析
                <UIcon
                  v-if="analysisState === 'loading'"
                  name="i-lucide-loader-circle"
                  class="ml-auto h-3.5 w-3.5 animate-spin text-sky-400"
                />
              </p>
              <p
                v-if="analysisText"
                class="text-sm leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-200"
              >
                {{ analysisText }}
              </p>
              <p v-else-if="analysisState === 'loading'" class="text-sm text-slate-400">正在生成解析…</p>
              <p v-else-if="analysisState === 'error'" class="flex items-center gap-2 text-sm text-slate-400">
                解析生成失败
                <UButton size="xs" variant="link" color="primary" @click="startAnalysis">重试</UButton>
              </p>
            </div>
          </div>

          <div class="flex items-center justify-between pt-4 text-xs text-slate-400">
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
