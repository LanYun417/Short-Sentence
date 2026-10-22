<script setup lang="ts">
/**
 * AI 拓展页：场景造句（流式）+ 词根拆解（流式）。
 * 两个面板共用 useSse；输入回车即发起，生成中可中止。
 */
import { streamSse } from '~/composables/useSse';

definePageMeta({ middleware: ['auth'] });

/** 当前 Tab。宽度按 string 声明：UTabs 的 v-model 类型是 string | number。 */
const activeTab = ref('expand');

/** Tab 配置（slot 字段指定内容插槽名，与模板中的 #expand / #word-root 对应）。 */
const TABS = [
  { label: '场景造句', value: 'expand', slot: 'expand' },
  { label: '词根拆解', value: 'word-root', slot: 'word-root' },
];

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

    <UTabs v-model="activeTab" :items="TABS" variant="pill" class="mb-5">
      <!-- 场景造句 -->
      <template #expand>
        <div class="flex gap-2">
          <UInput
            v-model="expandInput"
            type="text"
            size="lg"
            placeholder="输入想表达的中文，如「我想约她周末吃饭」"
            class="flex-1"
            :disabled="expandRunning"
            @keydown.enter.prevent="runExpand"
          />
          <UButton
            size="lg"
            color="primary"
            :loading="expandRunning"
            :disabled="!expandInput.trim()"
            @click="runExpand"
          >
            生成
          </UButton>
          <UButton v-if="expandRunning" size="lg" color="neutral" variant="soft" @click="expandAbort?.()">
            停止
          </UButton>
        </div>
        <UCard v-if="expandOutput" :ui="{ body: 'p-4' }" class="mt-4">
          <p class="whitespace-pre-wrap text-base leading-relaxed text-slate-700 dark:text-slate-200">
            {{ expandOutput }}
          </p>
        </UCard>
      </template>

      <!-- 词根拆解 -->
      <template #word-root>
        <div class="flex gap-2">
          <UInput
            v-model="wordInput"
            type="text"
            size="lg"
            placeholder="输入要拆解的单词，如 unavoidable"
            class="flex-1"
            :disabled="wordRunning"
            @keydown.enter.prevent="runWordRoot"
          />
          <UButton size="lg" color="primary" :loading="wordRunning" :disabled="!wordInput.trim()" @click="runWordRoot">
            拆解
          </UButton>
          <UButton v-if="wordRunning" size="lg" color="neutral" variant="soft" @click="wordAbort?.()"> 停止 </UButton>
        </div>
        <UCard v-if="wordOutput" :ui="{ body: 'p-4' }" class="mt-4">
          <p class="whitespace-pre-wrap text-base leading-relaxed text-slate-700 dark:text-slate-200">
            {{ wordOutput }}
          </p>
        </UCard>
      </template>
    </UTabs>
  </div>
</template>
