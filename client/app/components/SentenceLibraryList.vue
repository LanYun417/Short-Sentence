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

    <!-- 错误态 -->
    <UAlert
      v-if="errorMessage && items.length === 0"
      color="error"
      variant="subtle"
      :description="errorMessage"
      class="mb-4"
    >
      <template #actions>
        <UButton size="sm" color="error" variant="outline" @click="loadMore">重试</UButton>
      </template>
    </UAlert>

    <!-- 首屏加载中 -->
    <div v-else-if="!loaded" class="py-16 text-center text-slate-400">加载中…</div>

    <!-- 空态 -->
    <div v-else-if="items.length === 0" class="py-16 text-center text-slate-400">
      {{ isReview ? '暂无到期错题，保持住' : '还没有收藏，刷题时点 ☆ 收藏' }}
    </div>

    <div class="space-y-3">
      <UCard v-for="item in items" :key="`${item.sentenceId}-${item.createdAt}`" :ui="{ body: 'p-3' }">
        <div class="flex gap-3">
          <div class="h-20 w-36 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-700">
            <img
              v-if="item.imageUrl"
              :src="withUploadToken(item.imageUrl)"
              class="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium text-slate-800 dark:text-slate-100">{{ item.sentenceEn }}</p>
            <p class="font-mono text-xs text-slate-400">{{ item.ipa || '—' }}</p>
            <p class="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">{{ item.translationZh }}</p>
            <UBadge v-if="isReview && item.reviewLevel !== undefined" color="warning" variant="subtle" size="sm">
              已答对 {{ item.reviewLevel }} 次
            </UBadge>
          </div>
        </div>
      </UCard>
    </div>

    <div class="py-6 text-center">
      <UButton v-if="hasMore" color="neutral" variant="soft" :loading="loading" @click="loadMore"> 加载更多 </UButton>
      <p v-else-if="items.length > 0" class="text-sm text-slate-400">共 {{ total }} 条</p>
    </div>
  </div>
</template>
