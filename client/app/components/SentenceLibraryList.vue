<script setup lang="ts">
/**
 * 列表组件（收藏夹 / 学习记录共用）。
 * 模块职责：按 mode 拉取对应接口并渲染卡片列表；history 模式支持多维度筛选 +
 * 滚动到底自动加载（IntersectionObserver），favorites 模式保留「加载更多」按钮。
 *
 * 为什么做成组件而不是单页面：/favorites 与 /review 是两个独立路由，
 * 早期实现把它们塞在 pages/library.vue 里靠 route.path 判断，
 * 结果 Nuxt 生成的路由是 /library，导航上的两个入口全部 404。
 */
import type { SentenceCategory, SentenceLibraryItem } from '~/types';
import { apiFetch } from '~/composables/useApi';

/** 缩略图地址。 */
function itemSrc(url?: string | null): string {
  return url ?? '';
}

const props = defineProps<{
  /** favorites 收藏夹 / history 学习记录（全量历史） */
  mode: 'favorites' | 'history';
}>();

const isHistory = computed(() => props.mode === 'history');

const items = ref<SentenceLibraryItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 10;
const loading = ref(false);
/** 首屏是否已加载完成（用于区分「加载中」与「确实为空」）。 */
const loaded = ref(false);
const errorMessage = ref('');

const hasMore = computed(() => items.value.length < total.value);

/* ----------------------------- 筛选状态（仅 history） ----------------------------- */
const TYPE_OPTIONS = [
  { label: '全部', value: 'all' as const },
  { label: '错题', value: 'wrong' as const },
  { label: '对题', value: 'right' as const },
];
const type = ref<'all' | 'wrong' | 'right'>('all');
const DIFFICULTY_OPTIONS = [
  { label: '易', value: 1 },
  { label: '中', value: 2 },
  { label: '难', value: 3 },
];
const difficulty = ref<number | null>(null);
const categoryId = ref<number | null>(null);
const from = ref('');
const to = ref('');
const categories = ref<SentenceCategory[]>([]);

const categoryOptions = computed(() => categories.value.map((c) => ({ label: c.name, value: c.id })));
const hasActiveFilter = computed(
  () => type.value !== 'all' || difficulty.value !== null || categoryId.value !== null || !!from.value || !!to.value,
);

function clearFilters(): void {
  type.value = 'all';
  difficulty.value = null;
  categoryId.value = null;
  from.value = '';
  to.value = '';
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

/* ----------------------------- 无限滚动哨兵 ----------------------------- */
const sentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;
let queryToken = 0;

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
      if (difficulty.value) query.difficulty = difficulty.value;
      if (categoryId.value) query.categoryId = categoryId.value;
      if (from.value) query.from = from.value;
      if (to.value) query.to = to.value;
    }
    const data = await apiFetch<{ list: SentenceLibraryItem[]; total: number }>(
      isHistory.value ? '/client/history' : '/client/favorites',
      { query },
    );
    items.value.push(...data.list);
    total.value = data.total;
    page.value += 1;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '加载失败，请稍后重试';
  } finally {
    loading.value = false;
    loaded.value = true;
    // history 模式：若哨兵仍在视口内（内容不足一屏），自动续拉直到填满或到底
    if (isHistory.value && hasMore.value) {
      const root = (sentinel.value?.closest('.ss-viewport') as HTMLElement | null) ?? null;
      if (sentinelInView(root)) {
        void loadMore();
      }
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
  sentinel.value?.closest('.ss-viewport')?.scrollTo({ top: 0 });
}

watch([type, difficulty, categoryId, from, to], () => {
  if (isHistory.value) {
    void runQuery();
  }
});

/**
 * SSR 预取首屏第一页：列表 HTML 直接带数据，不再骨架屏等水合。
 * 令牌过期等失败时为 null，挂载后走既有客户端流程兜底。
 */
const ssrQuery = isHistory.value ? { page: 1, pageSize, type: 'all' } : { page: 1, pageSize };
const { data: ssrPage } = await useSsrApi<{ list: SentenceLibraryItem[]; total: number }>(
  `ss:${props.mode}`,
  isHistory.value ? '/client/history' : '/client/favorites',
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
  if (isHistory.value) {
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
    const root = (sentinel.value?.closest('.ss-viewport') as HTMLElement | null) ?? null;
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { root, rootMargin: '160px', threshold: 0 },
    );
    if (sentinel.value) {
      observer.observe(sentinel.value);
    }
  }
  // SSR 已带首屏数据时跳过，「加载更多」/ 自动加载从第 2 页继续
  if (!loaded.value) {
    void loadMore();
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
});

/* ----------------------------- 文案 ----------------------------- */
const title = computed(() => (isHistory.value ? '学习记录' : '我的收藏'));
const subtitle = computed(() =>
  isHistory.value ? '回顾你答过的每一句，按时间、对错、难度与场景筛选' : '收藏的句子随时回看',
);
const emptyText = computed(() => {
  if (isHistory.value) {
    return hasActiveFilter.value
      ? { title: '没有符合筛选条件的记录', desc: '试着放宽筛选条件' }
      : { title: '还没有学习记录', desc: '去刷几道题，再来这里回顾吧' };
  }
  return { title: '还没有收藏', desc: '刷题时点 ☆ 即可收藏句子' };
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
            <UIcon :name="isHistory ? 'i-lucide-history' : 'i-lucide-star'" class="h-4.5 w-4.5" />
          </span>
          {{ title }}
        </h1>
        <p class="mt-1.5 text-sm text-slate-400">{{ subtitle }}</p>
      </div>
      <UBadge v-if="total > 0" color="neutral" variant="soft" size="lg">共 {{ total }} 条</UBadge>
    </div>

    <!-- 筛选栏（仅学习记录） -->
    <div v-if="isHistory" class="anim-in mb-4 space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <div class="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            v-for="opt in TYPE_OPTIONS"
            :key="opt.value"
            type="button"
            class="rounded-lg px-3 py-1.5 text-sm font-medium transition"
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
          :items="DIFFICULTY_OPTIONS"
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
        <UInput v-model="from" type="date" placeholder="起始日期" size="sm" class="w-36" />
        <UInput v-model="to" type="date" placeholder="结束日期" size="sm" class="w-36" />
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
        <UIcon :name="isHistory ? 'i-lucide-notebook-pen' : 'i-lucide-star'" class="h-8 w-8" />
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
            <p v-if="isHistory && !item.isCorrect && item.userAnswer" class="mt-1 text-xs text-rose-500/80">
              你的作答：{{ item.userAnswer }}
            </p>
            <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
              <UBadge v-if="item.categoryName" color="neutral" variant="subtle" size="sm">{{
                item.categoryName
              }}</UBadge>
              <UBadge v-if="item.difficulty" color="neutral" variant="subtle" size="sm"
                >难度 {{ item.difficulty }}</UBadge
              >
              <UBadge v-if="isHistory" color="neutral" variant="soft" size="sm">{{ fmtDate(item.createdAt) }}</UBadge>
              <UBadge v-if="!isHistory && item.reviewLevel !== undefined" color="neutral" variant="subtle" size="sm">
                已答对 {{ item.reviewLevel }} 次
              </UBadge>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- 底部：history 自动加载 / favorites 手动加载更多 -->
    <template v-if="isHistory">
      <div v-if="loading" class="flex items-center justify-center gap-2 py-5 text-sm text-slate-400">
        <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin" />
        加载中…
      </div>
      <p v-else-if="loaded && !hasMore && items.length > 0" class="py-5 text-center text-sm text-slate-400">
        已经到底啦
      </p>
      <!-- 滚动哨兵：始终挂载，observer 据此触发下一页 -->
      <div ref="sentinel" class="h-px w-full" aria-hidden="true" />
    </template>
    <div v-else class="py-6 text-center">
      <UButton
        v-if="hasMore"
        color="neutral"
        variant="soft"
        icon="i-lucide-chevron-down"
        :loading="loading"
        @click="loadMore"
      >
        加载更多
      </UButton>
    </div>
  </div>
</template>
