<script setup lang="ts">
/**
 * 列表组件（收藏夹 / 学习记录共用）。
 * 模块职责：按 mode 拉取对应接口并渲染卡片列表；两者都支持多维度筛选 +
 * 「滚动到底自动加载」的无限滚动与「返回顶部」悬浮按钮。
 *
 * 差异点：history 额外提供「全部/错题/对题」分段与作答详情（对错徽章、你的作答），
 * favorites 仅有难度 / 场景 / 收藏时间范围筛选。
 *
 * 为什么做成组件而不是单页面：/favorites 与 /review 是两个独立路由，
 * 早期实现把它们塞在 pages/library.vue 里靠 route.path 判断，
 * 结果 Nuxt 生成的路由是 /library，导航上的两个入口全部 404。
 */
import type { SentenceCategory, SentenceLibraryItem } from '~/types';
import { apiFetch } from '~/composables/useApi';
import { DIFFICULTIES, type DifficultyLevel } from '~/composables/useQuestionSession';
import { parseDate, today, getLocalTimeZone, type DateValue } from '@internationalized/date';

/** 缩略图地址。 */
function itemSrc(url?: string | null): string {
  return url ?? '';
}

const props = defineProps<{
  /** favorites 收藏夹 / review 复习池（答错且到期）/ history 学习记录（全量历史） */
  mode: 'favorites' | 'review' | 'history';
}>();

const isHistory = computed(() => props.mode === 'history');
const isReview = computed(() => props.mode === 'review');

/** 列表接口：三种模式各对应一个后端端点。 */
const listEndpoint = computed(() =>
  isHistory.value ? '/client/history' : isReview.value ? '/client/review' : '/client/favorites',
);

const items = ref<SentenceLibraryItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 10;
const loading = ref(false);
/** 首屏是否已加载完成（用于区分「加载中」与「确实为空」）。 */
const loaded = ref(false);
const errorMessage = ref('');

const hasMore = computed(() => items.value.length < total.value);

/* ----------------------------- 筛选状态（两种模式共用） ----------------------------- */
const TYPE_OPTIONS = [
  { label: '全部', value: 'all' as const },
  { label: '错题', value: 'wrong' as const },
  { label: '对题', value: 'right' as const },
];
const type = ref<'all' | 'wrong' | 'right'>('all');
// 难度档位**直接复用刷题页的定义**（基础 / 进阶 / 挑战）——两处口径必须一致，
// 否则用户在这里筛「中」、刷题页选「进阶」，同一个值出现两套叫法会歧义。
// 用 undefined 而不是 null 表示「未筛选」：@nuxt/ui 的 USelect 模型值是 `T | undefined`，
// 传 null 会类型不通过（此前只靠 v-model 静默通过，加 type-check 后才暴露）。
const difficulty = ref<DifficultyLevel | undefined>(undefined);
const categoryId = ref<number | undefined>(undefined);
const from = ref('');
const to = ref('');
const categories = ref<SentenceCategory[]>([]);

const categoryOptions = computed(() => categories.value.map((c) => ({ label: c.name, value: c.id })));
/** 是否有非默认筛选（据此展示「清除筛选」）。 */
const hasActiveFilter = computed(() => {
  const base = difficulty.value !== undefined || categoryId.value !== undefined || !!from.value || !!to.value;
  return isHistory.value ? type.value !== 'all' || base : base;
});

function clearFilters(): void {
  type.value = 'all';
  difficulty.value = undefined;
  categoryId.value = undefined;
  from.value = '';
  to.value = '';
}

/* ----------------------------- 日期范围选择（日历弹层，替代原生 date 输入） ----------------------------- */
const todayDate = today(getLocalTimeZone());
const fromOpen = ref(false);
const toOpen = ref(false);

/** 把 YYYY-MM-DD 字符串转成日历组件需要的 DateValue；空串返回 undefined。 */
function toDateValue(value: string): DateValue | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return parseDate(value);
  } catch {
    return undefined;
  }
}

/** 日历选中后回写；空值（清除）亦支持；选完自动收起弹层。 */
function onDatePick(which: 'from' | 'to', value: unknown): void {
  const str = value ? (value as DateValue).toString() : '';
  if (which === 'from') {
    from.value = str;
    fromOpen.value = false;
  } else {
    to.value = str;
    toOpen.value = false;
  }
}

/** 日期格式化（本地时区，MM-DD HH:mm）。 */
function fmtDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 难度档位文案（与刷题页同源的 DIFFICULTIES，取值异常时兜底显示原值）。 */
function difficultyLabel(value: number): string {
  return DIFFICULTIES.find((level) => level.value === value)?.label ?? `难度 ${value}`;
}

/* ----------------------------- 无限滚动哨兵 + 返回顶部 ----------------------------- */
const sentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;
let scrollEl: HTMLElement | null = null;
let queryToken = 0;
/** 滚动超过阈值后展示「返回顶部」。 */
const showBackToTop = ref(false);

/** 当前内容滚动容器（.ss-viewport，页面本身 overflow-hidden 不滚）。 */
function rootEl(): HTMLElement | null {
  return (sentinel.value?.closest('.ss-viewport') as HTMLElement | null) ?? null;
}

/** 哨兵是否仍在滚动视口内（内容不足一屏时用于自动续拉）。 */
function sentinelInView(root: HTMLElement | null): boolean {
  const el = sentinel.value;
  if (!el) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  const margin = 160;
  if (root) {
    const r = root.getBoundingClientRect();
    return rect.top < r.bottom + margin && rect.bottom > r.top - margin;
  }
  return rect.top < (window.innerHeight || 0) + margin && rect.bottom > -margin;
}

function onScroll(): void {
  showBackToTop.value = (scrollEl?.scrollTop ?? 0) > 240;
}

function scrollToTop(): void {
  scrollEl?.scrollTo({ top: 0, behavior: 'smooth' });
}

/** 列表错落入场延迟（新页只让前几项错落，避免长列表等待过久）。 */
function staggerDelay(index: number): string {
  return `${Math.min(index, 6) * 60}ms`;
}

/** 拉取一页（追加模式）。 */
async function loadMore(): Promise<void> {
  if (loading.value) {
    return;
  }
  // 注意：首屏不能依赖 hasMore 判断——初始 total 为 0，`0 < 0` 为假会让请求永远发不出去
  if (page.value > 1 && !hasMore.value) {
    return;
  }
  loading.value = true;
  errorMessage.value = '';
  try {
    const query: Record<string, unknown> = { page: page.value, pageSize };
    if (isHistory.value) {
      query.type = type.value;
    }
    if (difficulty.value) query.difficulty = difficulty.value;
    if (categoryId.value) query.categoryId = categoryId.value;
    if (from.value) query.from = from.value;
    if (to.value) query.to = to.value;
    const data = await apiFetch<{ list: SentenceLibraryItem[]; total: number }>(listEndpoint.value, {
      query,
    });
    items.value.push(...data.list);
    total.value = data.total;
    page.value += 1;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '加载失败，请稍后重试';
  } finally {
    loading.value = false;
    loaded.value = true;
    // 内容不足一屏时自动续拉，直到填满或到底
    if (hasMore.value && sentinelInView(rootEl())) {
      void loadMore();
    }
  }
}

/** 筛选变化：重置并重新拉取首屏（回到顶部）。 */
async function runQuery(): Promise<void> {
  const token = (queryToken += 1);
  page.value = 1;
  items.value = [];
  total.value = 0;
  loaded.value = false;
  await loadMore();
  if (token !== queryToken) {
    return;
  }
  rootEl()?.scrollTo({ top: 0 });
}

watch([type, difficulty, categoryId, from, to], () => {
  void runQuery();
});

/**
 * SSR 预取首屏第一页：列表 HTML 直接带数据，不再骨架屏等水合。
 * 令牌过期等失败时为 null，挂载后走既有客户端流程兜底。
 */
const ssrQuery = isHistory.value ? { page: 1, pageSize, type: 'all' } : { page: 1, pageSize };
const { data: ssrPage } = await useSsrApi<{ list: SentenceLibraryItem[]; total: number }>(
  `ss:${props.mode}`,
  listEndpoint.value,
  ssrQuery,
);
if (ssrPage.value) {
  items.value = [...ssrPage.value.list];
  total.value = ssrPage.value.total;
  page.value = 2;
  loaded.value = true;
}
// 客户端路由进入时数据异步到达：到位后回填（仅在尚未加载过时生效）
watch(ssrPage, (data) => {
  if (data && !loaded.value) {
    items.value = [...data.list];
    total.value = data.total;
    page.value = 2;
    loaded.value = true;
  }
});

onMounted(async () => {
  // 场景分类下拉（公开接口；失败仅降级为不可用，不影响主列表）
  try {
    const data = await apiFetch<SentenceCategory[]>('/client/categories');
    if (data) {
      categories.value = data;
    }
  } catch {
    /* 忽略：场景筛选降级 */
  }
  // 无限滚动：以内容滚动容器 .ss-viewport 为 root，越过底部 160px 即预加载
  scrollEl = rootEl();
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMore();
      }
    },
    { root: scrollEl, rootMargin: '160px', threshold: 0 },
  );
  if (sentinel.value) {
    observer.observe(sentinel.value);
  }
  // 「返回顶部」按钮显隐：滚动位移 > 240px 才出现
  scrollEl?.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  // SSR 已带首屏数据时跳过，自动加载从第 2 页继续
  if (!loaded.value) {
    void loadMore();
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
  scrollEl?.removeEventListener('scroll', onScroll);
  scrollEl = null;
});

/* ----------------------------- 文案 ----------------------------- */
const title = computed(() => {
  if (isHistory.value) return '学习记录';
  return isReview.value ? '复习' : '我的收藏';
});
const subtitle = computed(() => {
  if (isHistory.value) return '回顾你答过的每一句，按时间、对错、难度与场景筛选';
  return isReview.value ? '答错且到期的句子，按到期时间就近安排' : '收藏的句子随时回看';
});
const emptyText = computed(() => {
  if (isHistory.value) {
    return hasActiveFilter.value
      ? { title: '没有符合筛选条件的记录', desc: '试着放宽筛选条件' }
      : { title: '还没有学习记录', desc: '去刷几道题，再来这里回顾吧' };
  }
  if (isReview.value) {
    return hasActiveFilter.value
      ? { title: '没有符合筛选条件的复习题', desc: '试着放宽筛选条件' }
      : { title: '暂时没有要复习的', desc: '按记忆曲线，答错的句子还会再来找你' };
  }
  return hasActiveFilter.value
    ? { title: '没有符合筛选条件的收藏', desc: '试着放宽筛选条件' }
    : { title: '还没有收藏', desc: '刷题时点 ☆ 即可收藏句子' };
});
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6 md:py-8">
    <!-- 页头 -->
    <div class="anim-in mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 class="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
          <span
            class="grid h-8 w-8 place-items-center rounded-xl bg-linear-to-br from-sky-500 to-indigo-600 text-white"
          >
            <UIcon
              :name="isHistory ? 'i-lucide-calendar' : isReview ? 'i-lucide-repeat' : 'i-lucide-star'"
              class="h-4.5 w-4.5"
            />
          </span>
          {{ title }}
        </h1>
        <p class="mt-1.5 text-sm text-slate-400">{{ subtitle }}</p>
      </div>
      <UBadge v-if="total > 0" color="neutral" variant="soft" size="lg">共 {{ total }} 条</UBadge>
    </div>

    <!-- 筛选栏 -->
    <div class="anim-in mb-4 space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <!-- 类型分段（仅学习记录：对错筛选对收藏无意义） -->
        <div v-if="isHistory" class="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            v-for="opt in TYPE_OPTIONS"
            :key="opt.value"
            type="button"
            class="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition"
            :class="
              type === opt.value
                ? 'bg-white text-sky-600 shadow-sm dark:bg-slate-700 dark:text-sky-300'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            "
            @click="type = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
        <UButton
          v-if="hasActiveFilter"
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          @click="clearFilters"
        >
          清除筛选
        </UButton>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <USelect
          v-model="difficulty"
          :items="[...DIFFICULTIES]"
          value-key="value"
          label-key="label"
          placeholder="全部难度"
          clearable
          class="w-28"
        />
        <USelect
          v-model="categoryId"
          :items="categoryOptions"
          value-key="value"
          label-key="label"
          placeholder="全部场景"
          clearable
          class="w-36"
        />
        <UPopover v-model:open="fromOpen" :content="{ align: 'start' }">
          <UButton color="neutral" variant="outline" icon="i-lucide-calendar" size="sm" class="w-36 font-normal">
            <span :class="!from && 'text-slate-400'">{{ from || '起始日期' }}</span>
          </UButton>
          <template #content>
            <UCalendar
              :model-value="toDateValue(from)"
              :max-value="todayDate"
              @update:model-value="onDatePick('from', $event)"
            />
          </template>
        </UPopover>
        <UPopover v-model:open="toOpen" :content="{ align: 'start' }">
          <UButton color="neutral" variant="outline" icon="i-lucide-calendar" size="sm" class="w-36 font-normal">
            <span :class="!to && 'text-slate-400'">{{ to || '结束日期' }}</span>
          </UButton>
          <template #content>
            <UCalendar
              :model-value="toDateValue(to)"
              :max-value="todayDate"
              @update:model-value="onDatePick('to', $event)"
            />
          </template>
        </UPopover>
      </div>
    </div>

    <!-- 错误态 -->
    <UAlert
      v-if="errorMessage && items.length === 0"
      color="error"
      variant="subtle"
      orientation="vertical"
      :description="errorMessage"
      class="mb-4"
    >
      <template #actions>
        <UButton size="sm" color="error" variant="outline" icon="i-lucide-rotate-cw" @click="loadMore">重试</UButton>
      </template>
    </UAlert>

    <!-- 首屏加载中 -->
    <div v-else-if="!loaded" class="space-y-3">
      <USkeleton v-for="n in 3" :key="n" class="h-24 w-full rounded-2xl" />
    </div>

    <!-- 空态 -->
    <div
      v-else-if="items.length === 0"
      class="anim-pop flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-700"
    >
      <span
        class="anim-float grid h-16 w-16 place-items-center rounded-3xl bg-linear-to-br from-sky-50 to-indigo-100 text-sky-500 dark:from-slate-800 dark:to-slate-700 dark:text-sky-400"
      >
        <UIcon
          :name="isHistory ? 'i-lucide-book-search' : isReview ? 'i-lucide-repeat' : 'i-lucide-star'"
          class="h-8 w-8"
        />
      </span>
      <p class="mt-4 font-semibold text-slate-700 dark:text-slate-200">{{ emptyText.title }}</p>
      <p class="mt-1 text-sm text-slate-400">{{ emptyText.desc }}</p>
      <UButton class="mt-5" to="/" icon="i-lucide-layers" size="lg">去刷题</UButton>
    </div>

    <!-- 列表（错落入场 + 悬停抬起） -->
    <div v-else class="space-y-3">
      <UCard
        v-for="(item, i) in items"
        :key="`${item.sentenceId}-${item.createdAt}`"
        class="anim-stagger hover-lift"
        :ui="{ body: 'p-3' }"
        :style="{ '--d': staggerDelay(i) }"
      >
        <div class="flex gap-3">
          <div class="h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-700">
            <img
              v-if="item.imageUrl"
              :src="itemSrc(item.imageUrl)"
              :alt="item.translationZh"
              class="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
              loading="lazy"
            />
            <div v-else class="flex h-full items-center justify-center text-slate-300">
              <UIcon name="i-lucide-image-off" class="h-5 w-5" />
            </div>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <p class="truncate font-medium text-slate-800 dark:text-slate-100">{{ item.sentenceEn }}</p>
              <UBadge
                v-if="isHistory && item.isCorrect !== undefined"
                :color="item.isCorrect ? 'success' : 'error'"
                variant="subtle"
                size="sm"
                class="shrink-0"
              >
                {{ item.isCorrect ? '答对' : '答错' }}
              </UBadge>
            </div>
            <p class="font-mono text-xs text-slate-400">{{ item.ipa || '—' }}</p>
            <p class="mt-0.5 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{{ item.translationZh }}</p>
            <!-- 题目解析摘要（老题未回填时为空，不占位） -->
            <p
              v-if="item.explanation"
              class="mt-1 line-clamp-2 text-xs leading-relaxed text-sky-700/85 dark:text-sky-300/85"
            >
              {{ item.explanation }}
            </p>
            <p v-if="isHistory && !item.isCorrect && item.userAnswer" class="mt-1 text-xs text-rose-500/80">
              你的作答：{{ item.userAnswer }}
            </p>
            <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
              <UBadge v-if="item.categoryName" color="neutral" variant="subtle" size="sm">{{
                item.categoryName
              }}</UBadge>
              <UBadge v-if="item.difficulty" color="neutral" variant="subtle" size="sm">{{
                difficultyLabel(item.difficulty)
              }}</UBadge>
              <UBadge color="neutral" variant="soft" size="sm">{{ fmtDate(item.createdAt) }}</UBadge>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- 底部：加载指示 / 到底提示 + 常驻滚动哨兵 -->
    <div v-if="loading" class="flex items-center justify-center gap-2 py-5 text-sm text-slate-400">
      <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin" />
      加载中…
    </div>
    <p v-else-if="loaded && !hasMore && items.length > 0" class="py-5 text-center text-sm text-slate-400">已经到底啦</p>
    <!-- 哨兵常驻挂载：observer 据此触发下一页，勿用 v-if 挂在 hasMore 上 -->
    <div ref="sentinel" class="h-px w-full" aria-hidden="true" />

    <!-- 返回顶部悬浮按钮（滚动到一定位置才出现，移动端避开底部 Tab 栏）。
         图标刻意用 i-lucide-arrow-up：它是 Nuxt UI 内置图标、必定在客户端静态包里；
         动态渲染（v-if 挂 scroll 状态）的图标拿不到 serverBundle，只能用包里有的，
         换成未扫描的新图标名会在 dev 期渲染不出来（运行时 /api/_nuxt_icon 接口不存在）。 -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-y-2 opacity-0"
    >
      <button
        v-if="showBackToTop"
        type="button"
        class="fixed bottom-20 right-4 z-30 grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-white text-slate-500 shadow-lg ring-1 ring-slate-200 hover:text-sky-600 md:bottom-6 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:text-sky-300"
        aria-label="返回顶部"
        title="返回顶部"
        @click="scrollToTop"
      >
        <UIcon name="i-lucide-arrow-up" class="h-5 w-5" />
      </button>
    </Transition>
  </div>
</template>
