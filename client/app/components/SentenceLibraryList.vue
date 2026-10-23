<script setup lang="ts">
/**
 * 列表组件（收藏夹 / 复习池共用）。
 * 模块职责：按 mode 拉取对应接口并渲染卡片列表，支持「加载更多」分页。
 *
 * 为什么做成组件而不是单页面：/favorites 与 /review 是两个独立路由，
 * 早期实现把它们塞在 pages/library.vue 里靠 route.path 判断，
 * 结果 Nuxt 生成的路由是 /library，导航上的两个入口全部 404。
 */
import type { SentenceLibraryItem } from '~/types';
import { apiFetch } from '~/composables/useApi';
import { withUploadToken } from '~/utils/upload-token';

// 图片令牌走 Cookie：SSR 渲染的缩略图 URL 与客户端水合结果一致，首屏图片即开始加载
const tokenCookie = useCookie<string | null>('ss_token');

/** 缩略图地址（附加访问令牌）。 */
function itemSrc(url?: string | null): string {
  return withUploadToken(url, tokenCookie.value);
}

const props = defineProps<{
  /** favorites 收藏夹 / review 错题复习池 */
  mode: 'favorites' | 'review';
}>();

const isReview = computed(() => props.mode === 'review');
const items = ref<SentenceLibraryItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 10;
const loading = ref(false);
/** 首屏是否已加载完成（用于区分「加载中」与「确实为空」）。 */
const loaded = ref(false);
const errorMessage = ref('');

const hasMore = computed(() => items.value.length < total.value);

/** 空态文案。 */
const emptyText = computed(() =>
  isReview.value
    ? { title: '暂无到期错题', desc: '保持住，答错的题会按间隔重复出现' }
    : { title: '还没有收藏', desc: '刷题时点 ☆ 即可收藏句子' },
);

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
    const data = await apiFetch<{ list: SentenceLibraryItem[]; total: number }>(
      isReview.value ? '/client/review' : '/client/favorites',
      { query: { page: page.value, pageSize } },
    );
    items.value.push(...data.list);
    total.value = data.total;
    page.value += 1;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '加载失败，请稍后重试';
  } finally {
    loading.value = false;
    loaded.value = true;
  }
}

/**
 * SSR 预取首屏第一页：列表 HTML 直接带数据，不再骨架屏等水合。
 * 令牌过期等失败时为 null，挂载后走既有客户端流程兜底。
 */
const { data: ssrPage } = await useSsrApi<{ list: SentenceLibraryItem[]; total: number }>(
  `ss:${props.mode}`,
  isReview.value ? '/client/review' : '/client/favorites',
  { page: 1, pageSize },
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

onMounted(() => {
  // SSR 已带首屏数据时跳过，「加载更多」从第 2 页继续
  if (!loaded.value) {
    void loadMore();
  }
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
            <UIcon :name="isReview ? 'i-lucide-refresh-cw' : 'i-lucide-star'" class="h-4.5 w-4.5" />
          </span>
          {{ isReview ? '错题复习池' : '我的收藏' }}
        </h1>
        <p class="mt-1.5 text-sm text-slate-400">
          {{ isReview ? '答错且到期的题按间隔重复出现' : '收藏的句子随时回看' }}
        </p>
      </div>
      <UBadge v-if="total > 0" color="neutral" variant="soft" size="lg">共 {{ total }} 条</UBadge>
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
        <UIcon :name="isReview ? 'i-lucide-check-check' : 'i-lucide-star'" class="h-8 w-8" />
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
            <p class="truncate font-medium text-slate-800 dark:text-slate-100">{{ item.sentenceEn }}</p>
            <p class="font-mono text-xs text-slate-400">{{ item.ipa || '—' }}</p>
            <p class="mt-0.5 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{{ item.translationZh }}</p>
            <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
              <UBadge v-if="item.categoryName" color="neutral" variant="subtle" size="sm">{{
                item.categoryName
              }}</UBadge>
              <UBadge v-if="isReview && item.reviewLevel !== undefined" color="neutral" variant="subtle" size="sm">
                已答对 {{ item.reviewLevel }} 次
              </UBadge>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <div class="py-6 text-center">
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
