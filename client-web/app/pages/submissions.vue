<script setup lang="ts">
/**
 * 句子投稿（路由 /submissions）。
 *
 * 三个区块：投稿表单 → 投稿精选（已审核通过）→ 我的投稿（含状态与驳回原因）。
 * 投稿**不进刷题池**：刷题题必须过 AI 生成与配图审核，投稿精选是展示位，两者解耦。
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { apiFetch } from '~/composables/useApi';
import type { PageResult } from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '句子投稿',
  description: '把你喜欢的一句话投稿给「短句」，审核通过后会出现在投稿精选里。',
  indexable: false,
});

interface FeaturedItem {
  id: number;
  sentenceEn: string;
  translationZh: string;
  note: string | null;
  author: string;
  approvedAt: string | null;
}

interface MineItem {
  id: number;
  sentenceEn: string;
  translationZh: string;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

const PAGE_SIZE = 20;

const tab = ref<'featured' | 'mine'>('featured');
const form = reactive({ sentenceEn: '', translationZh: '', note: '' });
const submitting = ref(false);
const submitMessage = ref('');
const submitError = ref('');

const featured = ref<FeaturedItem[]>([]);
const featuredTotal = ref(0);
const featuredPage = ref(1);
const featuredLoading = ref(false);

const mine = ref<MineItem[]>([]);
const mineTotal = ref(0);
const minePage = ref(1);
const mineLoading = ref(false);

const canSubmit = computed(
  () => form.sentenceEn.trim().length >= 3 && form.translationZh.trim().length >= 1 && !submitting.value,
);

/** 状态徽章。 */
const STATUS_META: Record<MineItem['status'], { label: string; color: 'warning' | 'success' | 'error' }> = {
  pending: { label: '待审核', color: 'warning' },
  approved: { label: '已通过', color: 'success' },
  rejected: { label: '已驳回', color: 'error' },
};

async function loadFeatured(reset = false): Promise<void> {
  if (featuredLoading.value) {
    return;
  }
  featuredLoading.value = true;
  try {
    if (reset) {
      featuredPage.value = 1;
    }
    const data = await apiFetch<PageResult<FeaturedItem>>('/client/submissions/featured', {
      query: { page: featuredPage.value, pageSize: PAGE_SIZE },
    });
    featured.value = reset ? data.list : [...featured.value, ...data.list];
    featuredTotal.value = data.total;
  } finally {
    featuredLoading.value = false;
  }
}

async function loadMine(reset = false): Promise<void> {
  if (mineLoading.value) {
    return;
  }
  mineLoading.value = true;
  try {
    if (reset) {
      minePage.value = 1;
    }
    const data = await apiFetch<PageResult<MineItem>>('/client/submissions/mine', {
      query: { page: minePage.value, pageSize: PAGE_SIZE },
    });
    mine.value = reset ? data.list : [...mine.value, ...data.list];
    mineTotal.value = data.total;
  } finally {
    mineLoading.value = false;
  }
}

async function loadMore(): Promise<void> {
  if (tab.value === 'featured') {
    featuredPage.value += 1;
    await loadFeatured();
  } else {
    minePage.value += 1;
    await loadMine();
  }
}

async function submit(): Promise<void> {
  if (!canSubmit.value) {
    return;
  }
  submitting.value = true;
  submitError.value = '';
  submitMessage.value = '';
  try {
    await apiFetch<{ id: number }>('/client/submissions', {
      method: 'POST',
      body: {
        sentenceEn: form.sentenceEn.trim(),
        translationZh: form.translationZh.trim(),
        note: form.note.trim() || undefined,
      },
    });
    submitMessage.value = '投稿已提交，审核通过后会出现在精选里';
    form.sentenceEn = '';
    form.translationZh = '';
    form.note = '';
    tab.value = 'mine';
    await loadMine(true);
  } catch (err) {
    submitError.value = err instanceof Error ? err.message : '提交失败，请稍后重试';
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  void loadFeatured(true);
  void loadMine(true);
});
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
    <header class="mb-5">
      <h1 class="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
        <span
          class="grid h-8 w-8 place-items-center rounded-xl bg-linear-to-br from-violet-500 to-indigo-600 text-white"
        >
          <UIcon name="i-lucide-pen-line" class="h-4.5 w-4.5" />
        </span>
        句子投稿
      </h1>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
        把你喜欢的一句话投给「短句」——审核通过后会出现在投稿精选，被更多人看到。
      </p>
    </header>

    <!-- 投稿表单 -->
    <UCard class="mb-5" :ui="{ body: 'p-5' }">
      <div class="space-y-3">
        <UFormField label="英文句子" required>
          <UInput
            v-model="form.sentenceEn"
            placeholder="e.g. The best time to plant a tree was 20 years ago."
            maxlength="300"
            class="w-full"
          />
        </UFormField>
        <UFormField label="中文译文" required>
          <UInput
            v-model="form.translationZh"
            placeholder="种一棵树最好的时间是二十年前。"
            maxlength="300"
            class="w-full"
          />
        </UFormField>
        <UFormField label="附言（可选）" hint="出处、语境，或你为什么喜欢这句">
          <UInput v-model="form.note" placeholder="选填" maxlength="300" class="w-full" />
        </UFormField>
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs text-slate-400">最多同时挂 5 条待审核投稿</p>
          <UButton :loading="submitting" :disabled="!canSubmit" icon="i-lucide-send" @click="submit">
            提交投稿
          </UButton>
        </div>
        <UAlert v-if="submitMessage" color="success" variant="subtle" icon="i-lucide-check" :title="submitMessage" />
        <UAlert v-if="submitError" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="submitError" />
      </div>
    </UCard>

    <!-- 列表 -->
    <UTabs
      v-model="tab"
      :items="[
        {
          label: `投稿精选${featuredTotal ? ` (${featuredTotal})` : ''}`,
          value: 'featured',
          icon: 'i-lucide-sparkles',
        },
        { label: `我的投稿${mineTotal ? ` (${mineTotal})` : ''}`, value: 'mine', icon: 'i-lucide-user' },
      ]"
      variant="pill"
      class="mb-4"
    />

    <!-- 精选 -->
    <div v-if="tab === 'featured'" class="space-y-3">
      <p v-if="featured.length === 0 && !featuredLoading" class="py-10 text-center text-sm text-slate-400">
        还没有精选投稿，来投第一条吧
      </p>
      <UCard v-for="item in featured" :key="item.id" :ui="{ body: 'p-4' }">
        <p class="flex flex-wrap items-baseline gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
          {{ item.sentenceEn }}
          <TtsButton :text="item.sentenceEn" lang="en-US" />
        </p>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ item.translationZh }}</p>
        <p v-if="item.note" class="mt-2 text-xs text-slate-400">「{{ item.note }}」</p>
        <p class="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
          <UIcon name="i-lucide-user-round" class="h-3 w-3" />{{ item.author }}
        </p>
      </UCard>
    </div>

    <!-- 我的投稿 -->
    <div v-else class="space-y-3">
      <p v-if="mine.length === 0 && !mineLoading" class="py-10 text-center text-sm text-slate-400">
        你还没投过稿，写下第一句吧
      </p>
      <UCard v-for="item in mine" :key="item.id" :ui="{ body: 'p-4' }">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ item.sentenceEn }}</p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ item.translationZh }}</p>
            <p v-if="item.note" class="mt-1.5 text-xs text-slate-400">「{{ item.note }}」</p>
          </div>
          <UBadge :color="STATUS_META[item.status].color" variant="subtle" size="sm" class="shrink-0">
            {{ STATUS_META[item.status].label }}
          </UBadge>
        </div>
        <p v-if="item.status === 'rejected' && item.reviewNote" class="mt-2 text-xs text-rose-500">
          驳回原因：{{ item.reviewNote }}
        </p>
      </UCard>
    </div>

    <div class="mt-4 flex justify-center">
      <UButton
        v-if="(tab === 'featured' ? featured : mine).length < (tab === 'featured' ? featuredTotal : mineTotal)"
        color="neutral"
        variant="soft"
        size="sm"
        :loading="tab === 'featured' ? featuredLoading : mineLoading"
        @click="loadMore"
      >
        加载更多
      </UButton>
    </div>
  </div>
</template>
