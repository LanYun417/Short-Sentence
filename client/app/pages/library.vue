<script setup lang="ts">
/**
 * 列表页（收藏夹 / 复习池共用）。
 * 路由：/favorites 收藏夹；/review 复习池（由 query.mode 区分）。
 */
import type { SentenceLibraryItem } from '~/types';
import { apiFetch } from '~/composables/useApi';

definePageMeta({ middleware: ['auth'] });

const route = useRoute();
const isReview = computed(() => route.path === '/review');

const items = ref<SentenceLibraryItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 10;
const loading = ref(false);
const hasMore = computed(() => items.value.length < total.value);

/** 拉取一页（追加模式）。 */
async function loadMore(): Promise<void> {
  if (loading.value || !hasMore.value) {
    return;
  }
  loading.value = true;
  try {
    const data = await apiFetch<{ list: SentenceLibraryItem[]; total: number }>(
      isReview.value ? '/client/review' : '/client/favorites',
      { query: { page: page.value, pageSize } },
    );
    items.value.push(...data.list);
    total.value = data.total;
    page.value += 1;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadMore();
});
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-8">
    <h1 class="mb-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
      {{ isReview ? '错题复习池' : '我的收藏' }}
    </h1>
    <p class="mb-6 text-sm text-slate-400">
      {{ isReview ? '答错且到期的题按间隔重复出现' : '收藏的句子随时回看' }}
    </p>

    <p v-if="!loading && items.length === 0" class="py-16 text-center text-slate-400">
      {{ isReview ? '暂无到期错题，保持住' : '还没有收藏，刷题时点 ☆ 收藏' }}
    </p>

    <div class="space-y-3">
      <article
        v-for="item in items"
        :key="`${item.sentenceId}-${item.createdAt}`"
        class="flex gap-3 rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-800"
      >
        <div class="h-20 w-36 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-700">
          <img v-if="item.imageUrl" :src="item.imageUrl" class="h-full w-full object-cover" loading="lazy" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium text-slate-800 dark:text-slate-100">{{ item.sentenceEn }}</p>
          <p class="font-mono text-xs text-slate-400">{{ item.ipa || '—' }}</p>
          <p class="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">{{ item.translationZh }}</p>
          <p v-if="isReview && item.reviewLevel !== undefined" class="mt-1 text-xs text-amber-500">
            答对 {{ item.reviewLevel }} 次后到期
          </p>
        </div>
      </article>
    </div>

    <div class="py-6 text-center">
      <button
        v-if="hasMore"
        class="rounded-xl bg-slate-100 px-6 py-2.5 text-sm text-slate-600 transition hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
        :disabled="loading"
        @click="loadMore"
      >
        {{ loading ? '加载中…' : '加载更多' }}
      </button>
      <p v-else-if="items.length > 0" class="text-sm text-slate-400">共 {{ total }} 条</p>
    </div>
  </div>
</template>
