<script setup lang="ts">
/**
 * AI 拓展页：场景造句 + 词根拆解 + 词根词典。
 *
 * 输出约定（2026-10-24 起）：前两个面板的 AI 输出为**单行紧凑 JSON**，流式累积完后
 * 解析成结构化卡片渲染——场景造句用 ExpandResultCard，词根拆解用 WordRootCard
 * （与「词根词典」同一个组件，呈现天然一致）。解析失败则回退为原文，绝不渲染脏数据。
 *
 * 词根拆解额外做**自动收录**：拆解成功后把结果回传 POST /client/word-roots，
 * 词库没有该词即入库（已有则不覆盖），用户随后可在「词根词典」直接查到。
 */
import { streamSse } from '~/composables/useSse';
import { apiFetch } from '~/composables/useApi';
import { normalizeExpandResult, normalizeWordRootResult, parseAiJson, toWordRootItem } from '~/utils/ai-result';
import type { AiExpandResult, AiWordRootResult, WordRootCollectResult, WordRootItem } from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: 'AI 拓展',
  description: '场景造句与词根拆解，结构化呈现；词根词典可搜索任意单词的词根词缀解析。',
});

/** 当前 Tab。宽度按 string 声明：UTabs 的 v-model 类型是 string | number。 */
const activeTab = ref('expand');

/** Tab 配置（slot 字段指定内容插槽名）。 */
const TABS = [
  { label: '场景造句', value: 'expand', slot: 'expand' },
  { label: '词根拆解', value: 'word-root', slot: 'word-root' },
  { label: '词根词典', value: 'roots', slot: 'roots' },
];

/* ------------------------------ 场景造句 ------------------------------ */

const expandInput = ref('');
/** 流式原文（仅用于解析失败时兜底展示）。 */
const expandRaw = ref('');
const expandResult = ref<AiExpandResult | null>(null);
const expandRunning = ref(false);
const expandFailed = ref(false);
let expandAbort: (() => void) | null = null;

/** 场景延展造句。 */
async function runExpand(): Promise<void> {
  const chinese = expandInput.value.trim();
  if (!chinese || expandRunning.value) {
    return;
  }
  expandRunning.value = true;
  expandResult.value = null;
  expandRaw.value = '';
  expandFailed.value = false;
  const stream = await streamSse(
    '/client/ai/expand',
    { chinese },
    {
      onChunk: (text) => {
        expandRaw.value += text;
      },
      onDone: () => {
        expandRunning.value = false;
        // 结构化解析；失败时保留 expandRaw 由模板回退为原文
        expandResult.value = normalizeExpandResult(parseAiJson(expandRaw.value));
      },
      onError: () => {
        expandRunning.value = false;
        expandFailed.value = true;
      },
    },
  );
  expandAbort = stream.abort;
}

/* ------------------------------ 词根拆解 ------------------------------ */

const wordInput = ref('');
/** 流式原文（仅用于解析失败时兜底展示）。 */
const wordRaw = ref('');
const wordResult = ref<WordRootItem | null>(null);
const wordRunning = ref(false);
const wordFailed = ref(false);
/** 收录状态：saving 收录中 / created 新入库 / exists 词库已有 / failed 收录失败。 */
const collectState = ref<'saving' | 'created' | 'exists' | 'failed' | ''>('');
let wordAbort: (() => void) | null = null;

/** 词根词缀拆解（流式 → 结构化卡片 → 自动收录）。 */
async function runWordRoot(): Promise<void> {
  const word = wordInput.value.trim();
  if (!word || wordRunning.value) {
    return;
  }
  wordRunning.value = true;
  wordResult.value = null;
  wordRaw.value = '';
  wordFailed.value = false;
  collectState.value = '';
  const stream = await streamSse(
    '/client/ai/word-root',
    { word },
    {
      onChunk: (text) => {
        wordRaw.value += text;
      },
      onDone: () => {
        wordRunning.value = false;
        const analysis = normalizeWordRootResult(parseAiJson(wordRaw.value));
        if (analysis) {
          wordResult.value = toWordRootItem(word, analysis);
          void collectWord(word, analysis);
        }
      },
      onError: () => {
        wordRunning.value = false;
        wordFailed.value = true;
      },
    },
  );
  wordAbort = stream.abort;
}

/**
 * 收录进词根词典（词库没有该词才入库；已有则不覆盖）。
 * 失败只提示、不影响本次查看——收录是增益，不是主流程的依赖。
 */
async function collectWord(word: string, analysis: AiWordRootResult): Promise<void> {
  collectState.value = 'saving';
  try {
    const result = await apiFetch<WordRootCollectResult>('/client/word-roots', {
      method: 'POST',
      body: { word, analysis },
    });
    collectState.value = result.created ? 'created' : 'exists';
  } catch {
    collectState.value = 'failed';
  }
}

/** 收录状态提示（图标 / 文案 / 配色三元组，模板直接取用）。 */
const collectHint = computed<{ icon: string; text: string; spin: boolean; cls: string } | null>(() => {
  switch (collectState.value) {
    case 'saving':
      return { icon: 'i-lucide-loader-circle', text: '正在收录进词根词典…', spin: true, cls: 'text-slate-400' };
    case 'created':
      return {
        icon: 'i-lucide-check-circle-2',
        text: '已收录进词根词典，之后可在「词根词典」直接查到',
        spin: false,
        cls: 'text-emerald-600 dark:text-emerald-400',
      };
    case 'exists':
      return { icon: 'i-lucide-info', text: '词根词典中已有该词，未覆盖既有词条', spin: false, cls: 'text-slate-400' };
    case 'failed':
      return {
        icon: 'i-lucide-triangle-alert',
        text: '收录失败（不影响本次查看）',
        spin: false,
        cls: 'text-amber-600 dark:text-amber-400',
      };
    default:
      return null;
  }
});

/* ------------------------------ 词根词典 ------------------------------ */

const rootQuery = ref('');
const rootResult = ref<WordRootItem | null>(null);
const rootList = ref<WordRootItem[]>([]);
const hotWords = ref<WordRootItem[]>([]);
const rootSearching = ref(false);
const rootAnalyzing = ref(false);
const rootSearched = ref(false);
const rootError = ref('');

/** 热门词（空关键词 = 按搜索热度取前 20）。 */
async function loadHotWords(): Promise<void> {
  hotWords.value = await apiFetch<WordRootItem[]>('/client/word-roots').catch(() => []);
}

/** 搜索：先查缓存。 */
async function searchRoots(): Promise<void> {
  const q = rootQuery.value.trim();
  if (!q || rootSearching.value) {
    return;
  }
  rootSearching.value = true;
  rootError.value = '';
  rootResult.value = null;
  rootSearched.value = true;
  try {
    rootList.value = await apiFetch<WordRootItem[]>('/client/word-roots', { query: { q } });
    // 完全匹配时直接展开详情
    const exact = rootList.value.find((item) => item.word === q.toLowerCase());
    if (exact) {
      rootResult.value = exact;
      rootList.value = [];
    }
  } catch (error) {
    rootError.value = error instanceof Error ? error.message : '搜索失败';
  } finally {
    rootSearching.value = false;
  }
}

/** 精确查词（未命中时由后端实时解析并入库）。 */
async function lookupRoot(word: string): Promise<void> {
  if (rootAnalyzing.value) {
    return;
  }
  rootQuery.value = word;
  rootAnalyzing.value = true;
  rootError.value = '';
  try {
    rootResult.value = await apiFetch<WordRootItem>(`/client/word-roots/${encodeURIComponent(word)}`);
    rootList.value = [];
    rootSearched.value = true;
  } catch (error) {
    rootError.value = error instanceof Error ? error.message : '解析失败，请稍后再试';
  } finally {
    rootAnalyzing.value = false;
  }
}

/** 清空到初始态。 */
function resetRoot(): void {
  rootQuery.value = '';
  rootResult.value = null;
  rootList.value = [];
  rootSearched.value = false;
  rootError.value = '';
  void loadHotWords();
}

onMounted(() => {
  void loadHotWords();
});

onBeforeUnmount(() => {
  expandAbort?.();
  wordAbort?.();
});
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6 md:py-8">
    <!-- 页头 -->
    <div class="anim-in mb-5 flex items-center gap-3">
      <span
        class="grid h-11 w-11 place-items-center rounded-2xl bg-linear-to-br from-sky-500 to-indigo-600 text-white shadow-sm shadow-indigo-500/25"
      >
        <UIcon name="i-lucide-sparkles" class="h-6 w-6" />
      </span>
      <div>
        <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">AI 拓展</h1>
        <p class="text-sm text-slate-400">场景造句 · 词根拆解 · 词根词典</p>
      </div>
    </div>

    <UTabs v-model="activeTab" :items="TABS" variant="pill" class="mb-4">
      <!-- 场景造句 -->
      <template #expand>
        <div class="anim-in flex gap-2" style="animation-delay: 80ms">
          <UInput
            v-model="expandInput"
            type="text"
            size="lg"
            placeholder="输入想表达的中文，如「我想约她周末吃饭」"
            class="flex-1"
            :disabled="expandRunning"
            @keydown.enter.prevent="runExpand"
          />
          <UButton size="lg" :loading="expandRunning" :disabled="!expandInput.trim()" @click="runExpand">
            生成
          </UButton>
          <UButton
            v-if="expandRunning"
            size="lg"
            color="neutral"
            variant="soft"
            icon="i-lucide-circle-stop"
            @click="expandAbort?.()"
          >
            停止
          </UButton>
        </div>

        <!-- 生成中：结构化骨架 -->
        <AiStreamSkeleton v-if="expandRunning" :lines="3" class="anim-fade mt-4" />

        <!-- 结果：结构化卡片 -->
        <ExpandResultCard v-else-if="expandResult" :result="expandResult" class="anim-fade mt-4" />

        <!-- 兜底：解析失败时展示原文 -->
        <UCard v-else-if="expandRaw" :ui="{ body: 'p-4' }" class="anim-fade mt-4">
          <p class="mb-1 text-xs text-slate-400">AI 返回格式异常，以下为原始输出：</p>
          <p class="text-base leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-200">
            {{ expandRaw }}
          </p>
        </UCard>

        <UAlert
          v-else-if="expandFailed"
          color="error"
          variant="subtle"
          class="mt-4"
          description="AI 服务暂时不可用，请稍后重试"
        />

        <p v-else class="anim-in mt-4 text-sm text-slate-400">输入中文，AI 会给出自然地道的英文表达与例句。</p>
      </template>

      <!-- 词根拆解（流式 → 结构化卡片 → 自动收录） -->
      <template #word-root>
        <div class="anim-in flex gap-2" style="animation-delay: 80ms">
          <UInput
            v-model="wordInput"
            type="text"
            size="lg"
            placeholder="输入要拆解的单词，如 unavoidable"
            class="flex-1"
            :disabled="wordRunning"
            @keydown.enter.prevent="runWordRoot"
          />
          <UButton size="lg" :loading="wordRunning" :disabled="!wordInput.trim()" @click="runWordRoot"> 拆解 </UButton>
          <UButton
            v-if="wordRunning"
            size="lg"
            color="neutral"
            variant="soft"
            icon="i-lucide-circle-stop"
            @click="wordAbort?.()"
          >
            停止
          </UButton>
        </div>

        <!-- 生成中：结构化骨架 -->
        <AiStreamSkeleton v-if="wordRunning" :lines="4" class="anim-fade mt-4" />

        <!-- 结果：与词根词典同一张卡 + 收录状态 -->
        <template v-else-if="wordResult">
          <WordRootCard :item="wordResult" class="anim-fade mt-4" />
          <p v-if="collectHint" class="anim-in mt-2 flex items-center gap-1.5 text-xs" :class="collectHint.cls">
            <UIcon :name="collectHint.icon" class="h-3.5 w-3.5" :class="collectHint.spin && 'animate-spin'" />
            {{ collectHint.text }}
          </p>
        </template>

        <!-- 兜底：解析失败时展示原文 -->
        <UCard v-else-if="wordRaw" :ui="{ body: 'p-4' }" class="anim-fade mt-4">
          <p class="mb-1 text-xs text-slate-400">AI 返回格式异常，以下为原始输出：</p>
          <p class="text-base leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-200">{{ wordRaw }}</p>
        </UCard>

        <UAlert
          v-else-if="wordFailed"
          color="error"
          variant="subtle"
          class="mt-4"
          description="AI 服务暂时不可用，请稍后重试"
        />

        <p v-else class="anim-in mt-4 text-sm text-slate-400">
          输入单词，AI 会拆解词根词缀；结果会自动收录进词根词典。
        </p>
      </template>

      <!-- 词根词典（搜索 / AI 解析 / 每日入库） -->
      <template #roots>
        <div class="anim-in flex gap-2" style="animation-delay: 80ms">
          <UInput
            v-model="rootQuery"
            type="text"
            size="lg"
            placeholder="输入英文单词，如 unavoidable"
            class="flex-1"
            icon="i-lucide-search"
            @keydown.enter.prevent="searchRoots"
          />
          <UButton size="lg" :loading="rootSearching" :disabled="!rootQuery.trim()" @click="searchRoots">
            搜索
          </UButton>
        </div>

        <UAlert v-if="rootError" color="error" variant="subtle" class="mt-4" :description="rootError" />

        <!-- 词条详情（与 AI 拆解结果共用同一张卡） -->
        <template v-if="rootResult">
          <WordRootCard :item="rootResult" class="anim-fade mt-4" />
          <div class="mt-2 flex gap-2">
            <UButton color="neutral" variant="soft" size="sm" icon="i-lucide-rotate-ccw" @click="resetRoot">
              重新搜索
            </UButton>
          </div>
        </template>

        <!-- 搜索结果列表 -->
        <div v-else-if="rootList.length" class="mt-4 space-y-2">
          <button
            v-for="item in rootList"
            :key="item.word"
            type="button"
            class="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left transition hover:border-sky-300 hover:bg-sky-50/50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-sky-600 dark:hover:bg-slate-700/60"
            @click="lookupRoot(item.word)"
          >
            <span class="font-medium text-slate-800 dark:text-slate-100">{{ item.word }}</span>
            <span v-if="item.phonetic" class="font-mono text-xs text-slate-400">{{ item.phonetic }}</span>
            <span class="ml-auto line-clamp-1 text-xs text-slate-400">{{ item.meaning }}</span>
          </button>
        </div>

        <!-- 未命中：AI 解析入口 -->
        <div
          v-else-if="rootSearched"
          class="anim-pop mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 py-10 text-center dark:border-slate-700"
        >
          <UIcon name="i-lucide-book-search" class="h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p class="text-sm text-slate-500 dark:text-slate-400">词典里还没有「{{ rootQuery }}」</p>
          <UButton
            :loading="rootAnalyzing"
            icon="i-lucide-sparkles"
            :disabled="!rootQuery.trim()"
            @click="lookupRoot(rootQuery.trim())"
          >
            用 AI 解析这个词
          </UButton>
        </div>

        <!-- 热门词 -->
        <div v-if="!rootResult && !rootList.length && !rootSearched && hotWords.length" class="anim-in mt-5">
          <p class="text-xs font-medium text-slate-400">热门词根</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <UButton
              v-for="item in hotWords"
              :key="item.word"
              color="neutral"
              variant="soft"
              size="sm"
              @click="lookupRoot(item.word)"
            >
              {{ item.word }}
            </UButton>
          </div>
        </div>

        <p
          v-else-if="!rootResult && !rootList.length && !rootSearched && !hotWords.length"
          class="anim-in mt-4 text-sm text-slate-400"
        >
          词典还在积累中——直接搜任意单词，AI 会实时解析并存入词典。
        </p>
      </template>
    </UTabs>
  </div>
</template>
