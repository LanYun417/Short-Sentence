<script setup lang="ts">
/**
 * 音标学习页（路由 /ipa）。
 *
 * 48 个音标按「单元音 / 双元音 / 清辅音 / 浊辅音」分组浏览：
 * 每张卡正面大符号 + 示例词（可点朗读）+ 中文发音要点 + 「学会了」标记。
 * 判分与发奖只在服务端：客户端只上报「学会了」真实操作。
 */
import { ref } from 'vue';
import { apiFetch } from '~/composables/useApi';
import type { IpaLearnedResult, IpaPhonemeGroup, IpaPhonemeType, IpaProgressItem } from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '音标学习',
  description: '48 个国际音标按单元音、双元音、清辅音、浊辅音分组学习：示例词发音、口型要点。',
});

/** 分组筛选（数量写死后端会校验，不匹配时按实际下发渲染）。 */
const GROUPS: Array<{ type: IpaPhonemeType; title: string }> = [
  { type: 'vowel', title: '单元音' },
  { type: 'diphthong', title: '双元音' },
  { type: 'consonant_voiceless', title: '清辅音' },
  { type: 'consonant_voiced', title: '浊辅音' },
];

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
  actionError.value = '';
  try {
    const res = await apiFetch<IpaLearnedResult>('/client/ipa/learned', { method: 'POST', body: { symbol } });
    learnedCount.value = res.learnedCount; // 服务端口径（可能是重复标记）
  } catch {
    learned.value = before;
    learnedCount.value = beforeCount;
    actionError.value = '标记失败，请稍后重试';
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
    <!-- 头部 + 掌握进度 -->
    <header class="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-lg font-bold text-slate-800 dark:text-slate-100">音标学习</h1>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          48 个国际音标：按类学、跟着示例词读、标记「学会了」攒经验
        </p>
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

    <!-- 学习视图 -->
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
          class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 transition dark:bg-slate-900 dark:ring-slate-800/80"
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
</template>
