<script setup lang="ts">
/**
 * 功能页（路由 /features）：题库 + AI 拓展 + 情景闯关 / 句子接龙入口。
 *
 * 为什么合并：底部导航原来四项（刷题 / 题库 / AI 拓展 / 我的），后两者都是低频「工具型」
 * 入口，各占一个 Tab 反而挤掉了刷题的主位。合并后导航只留三件事——刷题、功能、我的；
 * 题库与 AI 工具收进「功能」页用顶部 Tab 切换，情景闯关 / 句子接龙作为两个特色入口常驻页头。
 *
 * AI 部分沿用原「AI 拓展」页的约定：输出为单行紧凑 JSON，流式累积完后解析成结构化卡片
 * （场景造句 ExpandResultCard / 词根拆解 WordRootCard），解析失败回退原文；词根拆解成功后
 * 自动收录进词根词典（已有不覆盖）。
 */
import { streamSse } from '~/composables/useSse';
import { apiFetch } from '~/composables/useApi';
import { normalizeExpandResult, normalizeWordRootResult, parseAiJson, toWordRootItem } from '~/utils/ai-result';
import type {
  AiExpandResult,
  AiQuotaUsage,
  AiWordRootResult,
  CategoryBank,
  FestivalBank,
  WordRootCollectResult,
  WordRootItem,
} from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '功能',
  description: '题库、AI 拓展、情景闯关与句子接龙，常用功能都在这里。',
});

const route = useRoute();
const router = useRouter();

/* ------------------------------ 顶部 Tab（题库 / AI 拓展） ------------------------------ */

/** 顶部 Tab：banks=题库，ai=AI 拓展。用 query 承载，便于 /ai、/library 旧链接重定向到对应 Tab。 */
const activeTab = computed<'banks' | 'ai'>({
  get: () => (route.query.tab === 'ai' ? 'ai' : 'banks'),
  set: (tab) => {
    void router.replace({ query: { ...route.query, tab: tab === 'ai' ? 'ai' : undefined } });
  },
});

const TOP_TABS = [
  { label: '题库', value: 'banks', slot: 'banks' },
  { label: 'AI 拓展', value: 'ai', slot: 'ai' },
];

/* ------------------------------ 题库（原 /library） ------------------------------ */

/**
 * 两组题库都走 SSR 数据通道：首屏 HTML 直接带卡片，不等水合后才出现。
 * useSsrApi 返回 null 表示「SSR 拿不到」（未登录 / Cookie 令牌过期），交客户端兜底。
 */
const { data: ssrCategories } = await useSsrApi<CategoryBank[]>('ss:category-banks', '/client/categories');
const { data: ssrFestivals } = await useSsrApi<FestivalBank[]>('ss:festivals', '/client/questions/festivals');

/** 场景题库（按 sort 升序，附可刷题数）。 */
const categories = ref<CategoryBank[]>(ssrCategories.value ?? []);
/** 节日题库（按日期升序，只含有就绪题的节日）。 */
const festivals = ref<FestivalBank[]>(ssrFestivals.value ?? []);
/** 两组都要 SSR 拿不到才算「还在加载」（有一组有数据就能先渲染那一组）。 */
const loading = ref(ssrCategories.value === null && ssrFestivals.value === null);

onMounted(async () => {
  if (categories.value.length > 0 && festivals.value.length > 0) {
    loading.value = false;
    return;
  }
  const [cats, fests] = await Promise.all([
    categories.value.length > 0
      ? Promise.resolve(categories.value)
      : apiFetch<CategoryBank[]>('/client/categories').catch(() => []),
    festivals.value.length > 0
      ? Promise.resolve(festivals.value)
      : apiFetch<FestivalBank[]>('/client/questions/festivals').catch(() => []),
  ]);
  categories.value = cats;
  festivals.value = fests;
  loading.value = false;
});

/**
 * 节日卡片底色：封面图加载失败时的回退渐变，按它在一年中的位置取色（12 色环均匀分布），
 * 让二十多个卡片一眼能分出季节，而不是一片同色。
 */
function festivalHue(date: string | null): number {
  const month = date ? Number(date.slice(5, 7)) : 1;
  return Math.round(((month - 1) / 12) * 360);
}

/** 挑一个场景 → 去刷题页并锁定该场景题库。 */
function openCategory(id: number): void {
  void navigateTo({ path: '/', query: { category: String(id) } });
}

/** 挑一个节日 → 去刷题页并锁定该节日题库。 */
function openFestival(name: string): void {
  void navigateTo({ path: '/', query: { festival: name } });
}

/* ------------------------------ AI 拓展（原 /ai） ------------------------------ */

/** AI 工具 Tab。宽度按 string 声明：UTabs 的 v-model 类型是 string | number。 */
const activeAiTab = ref('expand');

/** AI 工具 Tab 配置（slot 字段指定内容插槽名）。 */
const AI_TABS = [
  { label: '场景造句', value: 'expand', slot: 'expand' },
  { label: '词根拆解', value: 'word-root', slot: 'word-root' },
  { label: '词根词典', value: 'roots', slot: 'roots' },
];

/* ----- 每日 AI 额度 ----- */

const quota = ref<AiQuotaUsage | null>(null);

/** 拉取今日剩余次数。 */
async function loadQuota(): Promise<void> {
  quota.value = await apiFetch<AiQuotaUsage>('/client/ai/quota').catch(() => null);
}

/** 剩余次数（0 视为已用完，用于置灰按钮）。 */
const quotaLeft = computed(() => quota.value?.remaining ?? 0);
/** 是否已用完（前端先拦一步，别等用户点了才报错）。 */
const quotaExhausted = computed(() => quotaLeft.value <= 0);

/**
 * 本地扣一次额度（调用成功后立即更新计数，不用重新拉接口）。
 * 后端已做权威校验，这里只是为了即时反馈。
 */
function spendQuota(): void {
  if (!quota.value) {
    return;
  }
  quota.value = {
    ...quota.value,
    used: quota.value.used + 1,
    remaining: Math.max(0, quota.value.remaining - 1),
  };
}

/* ----- 场景造句 ----- */

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
  if (!chinese || expandRunning.value || quotaExhausted.value) {
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
        spendQuota();
      },
      onError: () => {
        expandRunning.value = false;
        expandFailed.value = true;
      },
    },
  );
  expandAbort = stream.abort;
}

/* ----- 词根拆解 ----- */

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
  if (!word || wordRunning.value || quotaExhausted.value) {
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
        spendQuota();
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

/* ----- 词根词典 ----- */

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
  void loadQuota();
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
        <UIcon name="i-lucide-layout-grid" class="h-6 w-6" />
      </span>
      <div>
        <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100">功能</h1>
        <p class="text-sm text-slate-400">题库 · AI 拓展 · 音标 · 闯关 · 接龙</p>
      </div>
    </div>

    <!--
      AI 私教独立入口横条：从「我的 → 成长面板」提为独立页。
      做成全宽横条而非塞进下面的四宫格——既更显眼，也避免第五张卡在桌面端掉到第二行。
    -->
    <NuxtLink
      to="/ai-coach"
      class="anim-in group mb-4 flex items-center gap-3 rounded-2xl bg-linear-to-r from-indigo-600 to-violet-600 p-4 text-white shadow-sm shadow-indigo-500/25 transition active:scale-[0.99] sm:gap-4"
      style="animation-delay: 30ms"
    >
      <span class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20">
        <UIcon name="i-lucide-graduation-cap" class="h-6 w-6" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-base font-semibold">AI 私教</span>
        <span class="block truncate text-xs text-white/75">按你的作答数据，生成薄弱点画像与今日复习计划</span>
      </span>
      <span class="hidden shrink-0 items-center gap-1 text-xs font-medium text-white/85 sm:flex">
        去看看
        <UIcon
          name="i-lucide-arrow-right"
          class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
        />
      </span>
      <UIcon name="i-lucide-chevron-right" class="h-5 w-5 shrink-0 text-white/70 sm:hidden" />
    </NuxtLink>

    <!-- 特色玩法入口：音标学习 / 情景闯关 / 句子接龙 / 学习小队 -->
    <div class="anim-in mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4" style="animation-delay: 40ms">
      <NuxtLink
        to="/ipa"
        class="group flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 transition active:scale-95 dark:bg-slate-900 dark:ring-slate-800/80"
      >
        <span
          class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
        >
          <UIcon name="i-lucide-audio-lines" class="h-5 w-5" />
        </span>
        <span class="min-w-0">
          <span class="block text-sm font-semibold text-slate-800 dark:text-slate-100">音标学习</span>
          <span class="block truncate text-[11px] text-slate-400">48 个音标：跟读 + 测验</span>
        </span>
      </NuxtLink>

      <NuxtLink
        to="/stages"
        class="group flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 transition active:scale-95 dark:bg-slate-900 dark:ring-slate-800/80"
      >
        <span
          class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300"
        >
          <UIcon name="i-lucide-map" class="h-5 w-5" />
        </span>
        <span class="min-w-0">
          <span class="block text-sm font-semibold text-slate-800 dark:text-slate-100">情景闯关</span>
          <span class="block truncate text-[11px] text-slate-400">按场景通关，解锁剧情</span>
        </span>
      </NuxtLink>

      <NuxtLink
        to="/chains"
        class="group flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 transition active:scale-95 dark:bg-slate-900 dark:ring-slate-800/80"
      >
        <span
          class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
        >
          <UIcon name="i-lucide-messages-square" class="h-5 w-5" />
        </span>
        <span class="min-w-0">
          <span class="block text-sm font-semibold text-slate-800 dark:text-slate-100">句子接龙</span>
          <span class="block truncate text-[11px] text-slate-400">一句开头，大家接着写</span>
        </span>
      </NuxtLink>

      <NuxtLink
        to="/team"
        class="group flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 transition active:scale-95 dark:bg-slate-900 dark:ring-slate-800/80"
      >
        <span
          class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
        >
          <UIcon name="i-lucide-users-round" class="h-5 w-5" />
        </span>
        <span class="min-w-0">
          <span class="block text-sm font-semibold text-slate-800 dark:text-slate-100">学习小队</span>
          <span class="block truncate text-[11px] text-slate-400">组队打卡，还能群聊</span>
        </span>
      </NuxtLink>
    </div>

    <!-- 顶部 Tab：题库 / AI 拓展 -->
    <UTabs v-model="activeTab" :items="TOP_TABS" variant="pill" class="mb-4">
      <!-- ============================ 题库 ============================ -->
      <template #banks>
        <!-- 场景题库：日常场景，点进去只刷该场景 -->
        <section class="anim-in mb-6">
          <div class="mb-2 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">场景题库</h2>
            <span v-if="categories.length" class="text-[11px] text-slate-400">{{ categories.length }} 个场景</span>
          </div>
          <div v-if="loading" class="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            <div
              v-for="n in 6"
              :key="`c${n}`"
              class="h-20 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70"
            />
          </div>
          <div v-else-if="categories.length" class="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            <button
              v-for="item in categories"
              :key="item.id"
              type="button"
              :disabled="item.count === 0"
              class="flex h-20 flex-col justify-between rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200/70 transition active:scale-95 disabled:opacity-50 dark:bg-slate-900 dark:ring-slate-800/80"
              @click="openCategory(item.id)"
            >
              <span class="flex items-start justify-between gap-1">
                <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ item.name }}</span>
                <UIcon name="i-lucide-map-pin" class="h-4 w-4 shrink-0 text-sky-500" />
              </span>
              <span class="text-[11px] text-slate-400">{{ item.count > 0 ? `${item.count} 题` : '准备中' }}</span>
            </button>
          </div>
          <p
            v-else
            class="rounded-2xl bg-white px-4 py-6 text-center text-xs text-slate-400 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
          >
            暂无可刷的场景
          </p>
        </section>

        <!-- 节日题库：全年常驻，点进去只刷该节日 -->
        <section class="anim-in" style="animation-delay: 40ms">
          <div class="mb-2 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">节日题库</h2>
            <span v-if="festivals.length" class="text-[11px] text-slate-400">{{ festivals.length }} 个节日</span>
          </div>
          <div v-if="loading" class="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            <div
              v-for="n in 6"
              :key="`f${n}`"
              class="h-20 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70"
            />
          </div>
          <div v-else-if="festivals.length" class="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            <button
              v-for="item in festivals"
              :key="item.name"
              type="button"
              class="group relative flex h-24 flex-col justify-end overflow-hidden rounded-2xl p-3 text-left text-white shadow-sm transition active:scale-95"
              :style="{
                backgroundColor: `hsl(${festivalHue(item.date)} 72% 46%)`,
              }"
              @click="openFestival(item.name)"
            >
              <!-- 封面：取该节日题库一张已生成插画当封面；加载失败/无封面时露出底色 -->
              <img
                v-if="item.coverUrl"
                :src="item.coverUrl"
                :alt="`${item.name}封面`"
                class="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                loading="lazy"
                @error="(e: Event) => ((e.target as HTMLImageElement).style.display = 'none')"
              />
              <!-- 底部渐变遮罩：保证名称/题数在任意封面上都清晰可读 -->
              <span
                class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent"
                aria-hidden="true"
              />
              <span class="relative flex items-start justify-between gap-1">
                <span class="text-sm font-semibold drop-shadow-sm">{{ item.name }}</span>
                <UIcon name="i-lucide-sparkles" class="h-4 w-4 shrink-0 opacity-90 drop-shadow-sm" />
              </span>
              <span class="relative text-[11px] opacity-90 drop-shadow-sm">{{ item.count }} 题</span>
            </button>
          </div>
          <p
            v-else
            class="rounded-2xl bg-white px-4 py-6 text-center text-xs text-slate-400 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
          >
            节日题库正在准备中
          </p>
        </section>
      </template>

      <!-- ============================ AI 拓展 ============================ -->
      <template #ai>
        <!-- 额度提示条：用尽时置灰按钮并说明恢复时间（前端先拦，不等点了才报错） -->
        <p
          v-if="quota"
          class="anim-in mb-3 flex items-center gap-1.5 text-xs"
          :class="quotaExhausted ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'"
        >
          <UIcon :name="quotaExhausted ? 'i-lucide-triangle-alert' : 'i-lucide-sparkles'" class="h-3.5 w-3.5" />
          <span v-if="quotaExhausted">今日 AI 次数已用完（每天 {{ quota.limit }} 次），明天 0 点恢复</span>
          <span v-else
            >今日 AI 剩余 <b class="font-semibold text-sky-600 dark:text-sky-400">{{ quotaLeft }}</b> 次</span
          >
        </p>

        <UTabs v-model="activeAiTab" :items="AI_TABS" variant="pill" size="sm" class="mb-4">
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
              <UButton
                size="lg"
                :loading="expandRunning"
                :disabled="!expandInput.trim() || quotaExhausted"
                @click="runExpand"
              >
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
              <UButton
                size="lg"
                :loading="wordRunning"
                :disabled="!wordInput.trim() || quotaExhausted"
                @click="runWordRoot"
              >
                拆解
              </UButton>
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
              <p class="text-base leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                {{ wordRaw }}
              </p>
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
              <p class="text-sm text-slate-500 dark:text-slate-400">
                {{ quotaExhausted ? '今日 AI 次数已用完，明天 0 点恢复' : `词典里还没有「${rootQuery}」` }}
              </p>
              <UButton
                :loading="rootAnalyzing"
                icon="i-lucide-sparkles"
                :disabled="!rootQuery.trim() || quotaExhausted"
                @click="lookupRoot(rootQuery.trim())"
              >
                {{ quotaExhausted ? '今日次数已用完' : '用 AI 解析这个词' }}
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
      </template>
    </UTabs>
  </div>
</template>
