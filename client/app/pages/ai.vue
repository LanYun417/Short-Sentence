<script setup lang="ts">
/**
 * AI 拓展页：场景造句（流式）+ 词根拆解（流式）。
 * 两个面板共用 useSse；输入回车即发起，生成中可中止。
 */
import { streamSse } from '~/composables/useSse';

definePageMeta({ middleware: ['auth'] });

const activeTab = ref<'expand' | 'word-root'>('expand');

const expandInput = ref('');
const expandOutput = ref('');
const expandRunning = ref(false);
let expandAbort: (() => void) | null = null;

const wordInput = ref('');
const wordOutput = ref('');
const wordRunning = ref(false);
let wordAbort: (() => void) | null = null;

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

/** 词根词缀拆解。 */
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

onBeforeUnmount(() => {
  expandAbort?.();
  wordAbort?.();
});
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-8">
    <h1 class="mb-6 text-2xl font-bold text-slate-800 dark:text-slate-100">AI 拓展</h1>

    <div class="mb-5 flex gap-2">
      <button
        class="rounded-full px-4 py-2 text-sm font-medium transition"
        :class="
          activeTab === 'expand'
            ? 'bg-sky-600 text-white'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
        "
        @click="activeTab = 'expand'"
      >
        场景造句
      </button>
      <button
        class="rounded-full px-4 py-2 text-sm font-medium transition"
        :class="
          activeTab === 'word-root'
            ? 'bg-sky-600 text-white'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
        "
        @click="activeTab = 'word-root'"
      >
        词根拆解
      </button>
    </div>

    <!-- 场景造句 -->
    <div v-if="activeTab === 'expand'">
      <div class="flex gap-2">
        <input
          v-model="expandInput"
          type="text"
          placeholder="输入想表达的中文，如「我想约她周末吃饭」"
          class="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-sky-400 dark:border-slate-600 dark:bg-slate-800"
          :disabled="expandRunning"
          @keydown.enter.prevent="runExpand"
        />
        <button
          class="rounded-xl bg-sky-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
          :disabled="expandRunning || !expandInput.trim()"
          @click="runExpand"
        >
          生成
        </button>
        <button
          v-if="expandRunning"
          class="rounded-xl bg-slate-200 px-4 py-3 text-sm text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          @click="expandAbort?.()"
        >
          停止
        </button>
      </div>
      <pre
        v-if="expandOutput"
        class="mt-4 whitespace-pre-wrap rounded-2xl bg-white p-4 font-sans text-base leading-relaxed text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200"
        >{{ expandOutput }}</pre>
    </div>

    <!-- 词根拆解 -->
    <div v-else>
      <div class="flex gap-2">
        <input
          v-model="wordInput"
          type="text"
          placeholder="输入要拆解的单词，如 unavoidable"
          class="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-sky-400 dark:border-slate-600 dark:bg-slate-800"
          :disabled="wordRunning"
          @keydown.enter.prevent="runWordRoot"
        />
        <button
          class="rounded-xl bg-sky-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
          :disabled="wordRunning || !wordInput.trim()"
          @click="runWordRoot"
        >
          拆解
        </button>
        <button
          v-if="wordRunning"
          class="rounded-xl bg-slate-200 px-4 py-3 text-sm text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          @click="wordAbort?.()"
        >
          停止
        </button>
      </div>
      <pre
        v-if="wordOutput"
        class="mt-4 whitespace-pre-wrap rounded-2xl bg-white p-4 font-sans text-base leading-relaxed text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200"
        >{{ wordOutput }}</pre>
    </div>
  </div>
</template>
