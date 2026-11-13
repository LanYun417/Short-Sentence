<script setup lang="ts">
/**
 * 音标学习页（路由 /ipa）。
 *
 * 两个模式：
 * - **学习**：48 个音标按「单元音 / 双元音 / 清辅音 / 浊辅音」分组浏览，
 *   每张卡正面大符号 + 示例词（可点朗读）+ 中文发音要点 + 「学会了」标记；
 * - **测验**：本地按音标库出题（看词选音标 / 看音标选词，共 10 题），
 *   客户端只上报真实选择，**判分与 XP 由服务端权威**（ipa 模块比对示例词关系）。
 */
import { ref } from 'vue';
import { apiFetch } from '~/composables/useApi';
import type {
  IpaLearnedResult,
  IpaPhoneme,
  IpaPhonemeGroup,
  IpaPhonemeType,
  IpaProgressItem,
  IpaQuizResult,
  IpaQuizType,
} from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '音标学习',
  description: '48 个国际音标按单元音、双元音、清辅音、浊辅音分组学习：示例词发音、口型要点、听音测验。',
});

/** 分组 Tab（数量写死后端会校验，不匹配时按实际下发渲染）。 */
const GROUPS: Array<{ type: IpaPhonemeType; title: string }> = [
  { type: 'vowel', title: '单元音' },
  { type: 'diphthong', title: '双元音' },
  { type: 'consonant_voiceless', title: '清辅音' },
  { type: 'consonant_voiced', title: '浊辅音' },
];

/** 测验题数（两端一致；服务端上限 50）。 */
const QUIZ_SIZE = 10;

/** 当前 Tab：学习 / 测验。 */
const tab = ref<'learn' | 'quiz'>('learn');

/* ------------------------------ 数据 ------------------------------ */

const groups = ref<IpaPhonemeGroup[]>([]);
const total = ref(0);
const learned = ref<Set<string>>(new Set());
const learnedCount = ref(0);
const loading = ref(true);
/** 行内错误提示（与其他页一致：不用 toast，失败不静默）。 */
const actionError = ref('');

onMounted(async () => {
  try {
    const [pkg, prog] = await Promise.all([
      apiFetch<{ groups: IpaPhonemeGroup[]; total: number }>('/client/ipa/phonemes'),
      apiFetch<{ learnedCount: number; items: IpaProgressItem[] }>('/client/ipa/progress'),
    ]);
    groups.value = pkg.groups;
    total.value = pkg.total;
    learnedCount.value = prog.learnedCount;
    learned.value = new Set(prog.items.filter((i) => i.learned).map((i) => i.symbol));
  } catch {
    // 失败保底：空态会引导重试（接口异常时不给假数据）
  } finally {
    loading.value = false;
  }
});

const allPhonemes = computed<IpaPhoneme[]>(() => groups.value.flatMap((g) => g.items));
const activeGroup = ref<IpaPhonemeType>('vowel');
const activeItems = computed(() => groups.value.find((g) => g.type === activeGroup.value)?.items ?? []);
const activeHint = computed(() => groups.value.find((g) => g.type === activeGroup.value)?.hint ?? '');

/** 标记学会（乐观更新 + 失败回滚）。 */
async function markLearned(symbol: string): Promise<void> {
  if (learned.value.has(symbol)) return;
  const before = new Set(learned.value);
  const beforeCount = learnedCount.value;
  learned.value.add(symbol);
  learnedCount.value += 1;
  try {
    const res = await apiFetch<IpaLearnedResult>('/client/ipa/learned', { method: 'POST', body: { symbol } });
    learnedCount.value = res.learnedCount; // 服务端口径（可能是重复标记）
  } catch {
    learned.value = before;
    learnedCount.value = beforeCount;
    actionError.value = '标记失败，请稍后重试';
  }
}

/* ------------------------------ 测验 ------------------------------ */

interface QuizQuestion {
  type: IpaQuizType;
  /** 题干：word_to_phoneme 是单词；phoneme_to_word 是音标符号 */
  prompt: string;
  /** 四个选项 */
  options: string[];
  /** 正确答案（仅用于界面即时反馈；提交由服务端复判发奖） */
  correct: string;
}

type QuizPhase = 'intro' | 'running' | 'submitting' | 'done';

const phase = ref<QuizPhase>('intro');
const questions = ref<QuizQuestion[]>([]);
const current = ref(0);
const picked = ref('');
const answered = ref<Array<{ type: IpaQuizType; prompt: string; answer: string; ok: boolean }>>([]);
const result = ref<IpaQuizResult | null>(null);

function startQuiz(): void {
  const qs = buildQuiz();
  if (qs.length === 0) return;
  questions.value = qs;
  current.value = 0;
  picked.value = '';
  answered.value = [];
  result.value = null;
  tab.value = 'quiz';
  phase.value = 'running';
}

/** Fisher–Yates 洗牌（返回新数组）。 */
function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 本地出题：两种题型交替，干扰项优先取同组（更接近真实易混点）。 */
function buildQuiz(): QuizQuestion[] {
  const pool = allPhonemes.value;
  if (pool.length < 4) return [];
  const wordToSymbol = new Map<string, string>();
  const symbolPool = new Map<string, IpaPhoneme>();
  for (const p of pool) {
    symbolPool.set(p.symbol, p);
    for (const w of p.exampleWords) wordToSymbol.set(w.toLowerCase(), p.symbol);
  }
  const words = Array.from(wordToSymbol.keys());
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const out: QuizQuestion[] = [];
  for (let i = 0; i < QUIZ_SIZE / 2; i += 1) {
    // 1) 看词选音标
    const word = pick(words);
    const correctSymbol = wordToSymbol.get(word)!;
    const sameType = pool.filter((p) => p.symbol !== correctSymbol && p.type === symbolPool.get(correctSymbol)!.type);
    const others = shuffle([...sameType, ...pool])
      .filter((p) => p.symbol !== correctSymbol)
      .slice(0, 3);
    out.push({
      type: 'word_to_phoneme',
      prompt: word,
      options: shuffle([correctSymbol, ...others.map((d) => d.symbol)]),
      correct: correctSymbol,
    });

    // 2) 看音标选词
    const symbol = pick(pool).symbol;
    const correctWord = pick(symbolPool.get(symbol)!.exampleWords);
    const others2 = shuffle(words.filter((w) => wordToSymbol.get(w) !== symbol)).slice(0, 3);
    out.push({
      type: 'phoneme_to_word',
      prompt: symbol,
      options: shuffle([correctWord, ...others2]),
      correct: correctWord,
    });
  }
  return shuffle(out);
}

function pickOption(option: string): void {
  if (picked.value) return;
  picked.value = option;
}

async function nextQuestion(): Promise<void> {
  const q = questions.value[current.value];
  answered.value.push({ type: q.type, prompt: q.prompt, answer: picked.value, ok: picked.value === q.correct });
  if (current.value + 1 >= questions.value.length) {
    await finishQuiz();
    return;
  }
  current.value += 1;
  picked.value = '';
}

async function finishQuiz(): Promise<void> {
  phase.value = 'submitting';
  try {
    result.value = await apiFetch<IpaQuizResult>('/client/ipa/quiz/submit', {
      method: 'POST',
      body: { answers: answered.value.map((a) => ({ type: a.type, prompt: a.prompt, answer: a.answer })) },
    });
    // 刷新掌握计数（服务端已计入对错统计）
    const prog = await apiFetch<{ learnedCount: number; items: IpaProgressItem[] }>('/client/ipa/progress');
    learnedCount.value = prog.learnedCount;
  } catch (error) {
    actionError.value = error instanceof Error ? `判分失败：${error.message}` : '判分失败，请稍后重试';
    phase.value = 'intro';
    tab.value = 'quiz';
    return;
  } finally {
    if (phase.value === 'submitting') {
      phase.value = 'done';
    }
  }
}

function backToLearn(): void {
  tab.value = 'learn';
  phase.value = 'intro';
}

const currentQuestion = computed(() => questions.value[current.value]);
const lastAnswer = computed(() => (answered.value.length ? answered.value[answered.value.length - 1] : null));
</script>

<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
    <!-- 头部 + 掌握进度 -->
    <header class="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-lg font-bold text-slate-800 dark:text-slate-100">音标学习</h1>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">48 个国际音标：按类学、跟着示例词读、用测验巩固</p>
      </div>
      <div class="w-40">
        <div class="mb-1 flex items-baseline justify-between">
          <span class="text-xs text-slate-500 dark:text-slate-400">已掌握</span>
          <span class="text-sm font-bold text-slate-800 dark:text-slate-100">{{ learnedCount }} / {{ total }}</span>
        </div>
        <UProgress :model-value="total ? Math.round((learnedCount / total) * 100) : 0" size="sm" color="primary" />
      </div>
    </header>

    <!-- 行内错误条（与其它二级页一致，不用 toast） -->
    <p
      v-if="actionError"
      class="anim-in mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300"
    >
      {{ actionError }}
    </p>

    <!-- 模式切换（与其它二级页一致的胶囊 Tab） -->
    <div
      class="mb-4 inline-flex rounded-full border border-slate-200/70 bg-white p-1 text-xs shadow-sm dark:border-slate-800/80 dark:bg-slate-900"
    >
      <button
        type="button"
        class="rounded-full px-4 py-1.5 font-medium transition"
        :class="
          tab === 'learn'
            ? 'bg-sky-500 text-white'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
        "
        @click="tab = 'learn'"
      >
        学习
      </button>
      <button
        type="button"
        class="rounded-full px-4 py-1.5 font-medium transition"
        :class="
          tab === 'quiz'
            ? 'bg-sky-500 text-white'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
        "
        @click="startQuiz"
      >
        测验
      </button>
    </div>

    <!-- ============ 学习视图 ============ -->
    <div v-if="tab === 'learn'">
      <div v-if="loading" class="py-20 text-center text-sm text-slate-400">音标库加载中…</div>
      <div v-else-if="groups.length === 0" class="py-20 text-center text-sm text-slate-400">
        音标库暂未就绪，请稍后再试
      </div>
      <template v-else>
        <div class="mb-4 flex flex-wrap gap-2">
          <button
            v-for="g in GROUPS"
            :key="g.type"
            type="button"
            class="rounded-full border px-3 py-1.5 text-xs font-medium transition"
            :class="
              activeGroup === g.type
                ? 'border-sky-300 bg-sky-50 text-sky-600 dark:border-sky-400/40 dark:bg-sky-500/10 dark:text-sky-300'
                : 'border-slate-200/70 text-slate-500 hover:text-slate-800 dark:border-slate-800/80 dark:text-slate-400 dark:hover:text-slate-100'
            "
            @click="activeGroup = g.type"
          >
            {{ g.title }}
          </button>
        </div>
        <p class="mb-4 text-xs text-slate-500 dark:text-slate-400">{{ activeHint }}</p>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <article
            v-for="p in activeItems"
            :key="p.symbol"
            class="relative rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 transition dark:bg-slate-900 dark:ring-slate-800/80"
          >
            <UTag v-if="learned.has(p.symbol)" color="primary" variant="subtle" size="sm" class="absolute right-3 top-3"
              >已掌握</UTag
            >
            <div class="font-mono text-2xl font-bold text-slate-800 dark:text-slate-100">/{{ p.symbol }}/</div>
            <div class="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                v-for="w in p.exampleWords"
                :key="w"
                class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {{ w }}
                <TtsButton :text="w" compact />
              </span>
            </div>
            <p class="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{{ p.tips }}</p>
            <UButton
              class="mt-3"
              block
              size="sm"
              :color="learned.has(p.symbol) ? 'neutral' : 'primary'"
              :variant="learned.has(p.symbol) ? 'soft' : 'solid'"
              :disabled="learned.has(p.symbol)"
              @click="markLearned(p.symbol)"
            >
              {{ learned.has(p.symbol) ? '已掌握' : '学会了' }}
            </UButton>
          </article>
        </div>
      </template>
    </div>

    <!-- ============ 测验：说明页 ============ -->
    <div
      v-else-if="phase === 'intro'"
      class="anim-in mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
    >
      <div class="mb-2 text-3xl">🎧</div>
      <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">听音辨标 · 看标辨词</h2>
      <p class="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        每组 {{ QUIZ_SIZE }} 题：一半给出单词选音标（可点喇叭听发音），一半给出音标选包含它的示例词。<br />
        答错立即显示正确答案，结算时给出错题回顾；经验由服务端按真实作答发放。
      </p>
      <UButton class="mt-5" color="primary" size="lg" @click="startQuiz">开始测验</UButton>
    </div>

    <!-- ============ 测验：进行中 ============ -->
    <div v-else-if="phase === 'running'" class="anim-in mx-auto max-w-xl">
      <div class="mb-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>第 {{ current + 1 }} / {{ questions.length }} 题</span>
        <span v-if="lastAnswer">{{ lastAnswer.ok ? '上一题 ✓ 正确' : '上一题 ✗ 错误' }}</span>
      </div>
      <div class="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          class="h-full rounded-full bg-sky-500 transition-all"
          :style="{ width: `${(current / questions.length) * 100}%` }"
        />
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80">
        <div class="mb-2 text-xs text-slate-500 dark:text-slate-400">
          {{ currentQuestion.type === 'word_to_phoneme' ? '这个单词里含哪个音标？' : '哪个单词含这个音标？' }}
        </div>
        <div class="mb-5 flex items-center gap-3">
          <span
            v-if="currentQuestion.type === 'phoneme_to_word'"
            class="font-mono text-3xl font-bold text-slate-800 dark:text-slate-100"
            >/{{ currentQuestion.prompt }}/</span
          >
          <template v-else>
            <span class="text-2xl font-semibold text-slate-800 dark:text-slate-100">{{ currentQuestion.prompt }}</span>
            <TtsButton :text="currentQuestion.prompt" compact />
          </template>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="opt in currentQuestion.options"
            :key="opt"
            type="button"
            class="rounded-xl border px-3 py-2.5 text-sm transition disabled:cursor-default"
            :class="[
              opt.length <= 3 ? 'font-mono font-semibold' : '',
              picked === ''
                ? 'border-slate-200/70 text-slate-700 hover:border-sky-300 dark:border-slate-800/80 dark:text-slate-200'
                : opt === currentQuestion.correct
                  ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-300'
                  : picked === opt
                    ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-300'
                    : 'border-slate-200/70 text-slate-400 dark:border-slate-800/80 dark:text-slate-500',
            ]"
            :disabled="picked !== ''"
            @click="pickOption(opt)"
          >
            {{ opt }}
          </button>
        </div>
        <div class="mt-4 flex justify-end">
          <UButton color="primary" :disabled="!picked" @click="nextQuestion">
            {{ current + 1 >= questions.length ? '提交测验' : '下一题' }}
          </UButton>
        </div>
      </div>
    </div>

    <!-- ============ 测验：判分中 / 结算 ============ -->
    <div v-else class="anim-in mx-auto max-w-xl">
      <div v-if="phase === 'submitting'" class="py-20 text-center text-sm text-slate-400">判分中…</div>
      <div
        v-else-if="result"
        class="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
      >
        <div class="text-3xl font-bold text-slate-800 dark:text-slate-100">
          {{ result.correctCount }}<span class="text-base text-slate-400"> / {{ result.total }}</span>
        </div>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{
            result.correctCount === result.total
              ? '全对，发音功底扎实！'
              : result.correctCount >= result.total / 2
                ? '不错，错题多听两遍示例词。'
                : '别急，回到「学习」多听几遍再来。'
          }}
        </p>
        <p v-if="result.xpAwarded > 0" class="mt-2 text-xs text-sky-600 dark:text-sky-400">
          本局获得 +{{ result.xpAwarded }} 经验
        </p>
        <div
          v-if="result.wrong.length"
          class="mt-5 rounded-xl border border-slate-200/70 p-3 text-left dark:border-slate-800/80"
        >
          <div class="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">错题回顾</div>
          <ul class="space-y-1.5 text-xs">
            <li v-for="(w, i) in result.wrong" :key="i" class="flex items-center justify-between gap-2">
              <span class="text-slate-500 dark:text-slate-400">
                {{ w.type === 'word_to_phoneme' ? `${w.prompt} 的音标` : `${w.prompt} 的示例词` }}
              </span>
              <span class="font-mono font-semibold text-slate-700 dark:text-slate-200">/{{ w.correct }}/</span>
            </li>
          </ul>
        </div>
        <div class="mt-5 flex justify-center gap-2">
          <UButton color="neutral" variant="soft" @click="backToLearn">回到学习</UButton>
          <UButton color="primary" @click="startQuiz">再来一组</UButton>
        </div>
      </div>
    </div>
  </div>
</template>
