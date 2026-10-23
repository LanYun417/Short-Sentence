<script setup lang="ts">
/**
 * AI 拓展页：场景造句（流式）+ 词根拆解（流式）+ 词根词典（搜索/AI 解析）。
 * 前两个面板共用 useSse；词根词典走后端缓存（未命中由后端实时解析并入库）。
 */
import { streamSse } from '~/composables/useSse';
import { apiFetch } from '~/composables/useApi';
import type { WordRootItem } from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: 'AI 拓展',
  description: '场景造句与词根拆解，流式生成；词根词典可搜索任意单词的词根词缀解析。',
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
const expandOutput = ref('');
const expandRunning = ref(false);
let expandAbort: (() => void) | null = null;

/** 场景延展造句。 */
async function runExpand(): Promise<void> {
  const chinese = expandInput.value.trim();
  if (!chinese || expandRunning.value) {
    return;
  }
  expandRunning.value = true;
  expandOutput.value = '';
  const stream = await streamSse(
    '/client/ai/expand',
    { chinese },
    {
      onChunk: (text) => {
        expandOutput.value += text;
      },
      onDone: () => {
        expandRunning.value = false;
      },
      onError: (message) => {
        expandOutput.value += `\n[${message}]`;
        expandRunning.value = false;
      },
    },
  );
  expandAbort = stream.abort;
}

/* ------------------------------ 词根拆解 ------------------------------ */

const wordInput = ref('');
const wordOutput = ref('');
const wordRunning = ref(false);
let wordAbort: (() => void) | null = null;

/** 词根词缀拆解（流式）。 */
async function runWordRoot(): Promise<void> {
  const word = wordInput.value.trim();
  if (!word || wordRunning.value) {
    return;
  }
  wordRunning.value = true;
  wordOutput.value = '';
  const stream = await streamSse(
    '/client/ai/word-root',
    { word },
    {
      onChunk: (text) => {
        wordOutput.value += text;
      },
      onDone: () => {
        wordRunning.value = false;
      },
      onError: (message) => {
        wordOutput.value += `\n[${message}]`;
        wordRunning.value = false;
      },
    },
  );
  wordAbort = stream.abort;
}

/* ------------------------------ 词根词典 ------------------------------ */

const rootQuery = ref('');
const rootResult = ref<WordRootItem | null>(null);
const rootList = ref<WordRootItem[]>([]);
const hotWords = ref<WordRootItem[]>([]);
const rootSearching = ref(false);
const rootAnalyzing = ref(false);
const rootSearched = ref(false);
const rootError = ref('');

/** 构件配色：前缀 / 词根 / 后缀三色区分。 */
const PART_CLASS: Record<string, string> = {
  prefix: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  root: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
  suffix: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
};

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

/** 精确查词（未命中时由后端实时 AI 解析并入库）。 */
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

        <UCard v-if="expandOutput" :ui="{ body: 'p-4' }" class="anim-fade mt-4">
          <p class="text-base leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-200">
            {{ expandOutput
            }}<span
              v-if="expandRunning"
              class="ml-0.5 inline-block h-4 w-1 animate-pulse rounded-sm bg-sky-500 align-middle"
            />
          </p>
        </UCard>
        <p v-else-if="!expandRunning" class="anim-in mt-4 text-sm text-slate-400">
          输入中文，AI 会给出自然地道的英文表达与例句。
        </p>
      </template>

      <!-- 词根拆解（流式） -->
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

        <UCard v-if="wordOutput" :ui="{ body: 'p-4' }" class="anim-fade mt-4">
          <p class="text-base leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-200">
            {{ wordOutput
            }}<span
              v-if="wordRunning"
              class="ml-0.5 inline-block h-4 w-1 animate-pulse rounded-sm bg-sky-500 align-middle"
            />
          </p>
        </UCard>
        <p v-else-if="!wordRunning" class="anim-in mt-4 text-sm text-slate-400">
          输入单词，AI 会拆解词根词缀，帮你理解记忆。
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

        <!-- 词条详情 -->
        <UCard v-if="rootResult" :ui="{ body: 'p-5' }" class="anim-fade mt-4">
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ rootResult.word }}</h3>
            <span v-if="rootResult.phonetic" class="font-mono text-sm text-sky-600 dark:text-sky-400">
              {{ rootResult.phonetic }}
            </span>
            <UBadge v-if="rootResult.source === 'daily'" color="neutral" variant="subtle" size="sm">每日入库</UBadge>
          </div>

          <p v-if="rootResult.meaning" class="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {{ rootResult.meaning }}
          </p>

          <!-- 构件拆解 -->
          <div v-if="rootResult.parts.length" class="mt-4 flex flex-wrap gap-2">
            <span
              v-for="part in rootResult.parts"
              :key="`${part.type}-${part.text}`"
              class="rounded-xl px-2.5 py-1.5 text-sm"
              :class="PART_CLASS[part.type] ?? PART_CLASS.root"
            >
              <span class="font-semibold">{{ part.text }}</span>
              <span class="ml-1 opacity-80">{{ part.meaning }}</span>
            </span>
          </div>

          <p v-if="rootResult.explanation" class="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {{ rootResult.explanation }}
          </p>

          <div v-if="rootResult.related.length" class="mt-3 flex flex-wrap items-center gap-1.5">
            <span class="text-xs text-slate-400">同根词</span>
            <UBadge v-for="w in rootResult.related" :key="w" color="neutral" variant="subtle" size="sm">
              {{ w }}
            </UBadge>
          </div>

          <div class="mt-4 flex gap-2">
            <UButton color="neutral" variant="soft" size="sm" icon="i-lucide-rotate-ccw" @click="resetRoot">
              重新搜索
            </UButton>
          </div>
        </UCard>

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
