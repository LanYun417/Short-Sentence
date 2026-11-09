<script setup lang="ts">
/**
 * 句子接龙（路由 /chains）：给一句开头，接着往下写。
 *
 * 产品取向：**不做公开社交**——没有关注、没有评论、没有头像，
 * 作者是后端按 userId 派生的稳定化名（同一主题下恒定），身份不出服务端。
 *
 * 内容安全：入库前挡链接/联系方式/非英文；每人每天 3 条；举报一人一次、
 * 满 3 次自动隐藏。前端只负责把规则说清楚，判罚在服务端。
 *
 * 私有页：不进 sitemap / 禁止抓取（nuxt.config.ts 的 robots/sitemap 已排除）。
 */
import { computed, onMounted, ref } from 'vue';
import { apiFetch } from '~/composables/useApi';
import type { ChainEntry, ChainTopic, ChainTopicDetail } from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '句子接龙',
  description: '给一句英文开头，接着往下写一句。匿名的，谁都可以接。',
});

/**
 * 主题列表走 useSsrApi（带 Cookie 令牌）：裸 useFetch 不会带 Authorization，
 * SSR 与客户端都会 401，页面永远停在空状态。
 */
const { data: topicsData, refresh: refreshTopics } = await useSsrApi<ChainTopic[]>('ss:chains', '/client/chains');

/** 主题列表（SSR 令牌过期时为 null，由客户端兜底填充）。 */
const topics = computed(() => topicsData.value ?? []);

onMounted(async () => {
  if (topicsData.value === null) {
    topicsData.value = await apiFetch<ChainTopic[]>('/client/chains').catch(() => []);
  }
});

const activeId = ref<number | null>(null);
const detail = ref<ChainTopicDetail | null>(null);
const loading = ref(false);
const error = ref('');

const draftEn = ref('');
const draftZh = ref('');
const submitting = ref(false);
const flash = ref('');

const activeTopic = computed(() => topics.value.find((item) => item.id === activeId.value) ?? null);
const remaining = computed(() => detail.value?.remainingToday ?? 0);
const canSubmit = computed(() => draftEn.value.trim().length >= 6 && remaining.value > 0 && !submitting.value);

/** 打开某个主题并拉取接龙内容。 */
async function open(topic: ChainTopic): Promise<void> {
  if (loading.value) return;
  activeId.value = topic.id;
  detail.value = null;
  error.value = '';
  flash.value = '';
  loading.value = true;
  try {
    detail.value = await apiFetch<ChainTopicDetail>(`/client/chains/${topic.id}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

/** 收起详情，回到主题列表。 */
function close(): void {
  activeId.value = null;
  detail.value = null;
  error.value = '';
  flash.value = '';
}

/** 提交一句续写。 */
async function submit(): Promise<void> {
  const topic = activeTopic.value;
  if (!topic || !canSubmit.value) return;
  submitting.value = true;
  error.value = '';
  flash.value = '';
  try {
    const created = await apiFetch<ChainEntry>(`/client/chains/${topic.id}/entries`, {
      method: 'POST',
      body: {
        contentEn: draftEn.value.trim(),
        contentZh: draftZh.value.trim() || undefined,
      },
    });
    draftEn.value = '';
    draftZh.value = '';
    detail.value = await apiFetch<ChainTopicDetail>(`/client/chains/${topic.id}`);
    // 审核状态决定提示：通过才立即可见；转人工的不在列表里，说清楚免得用户以为没提交上
    flash.value =
      created.status === 'pending'
        ? '已提交，AI 拿不准这条内容，正在人工审核；通过后会出现在接龙里。'
        : created.status === 'rejected'
          ? `这句没有通过内容审核${created.moderationNote ? `：${created.moderationNote}` : ''}，换一句试试。`
          : '接上了。看看别人怎么往下写。';
    // 主题列表里的「N 句 / 我接过 N 句」同步刷新
    await refreshTopics();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '提交失败，请稍后重试';
  } finally {
    submitting.value = false;
  }
}

/** 点赞 / 取消。 */
async function toggleLike(entry: ChainEntry): Promise<void> {
  try {
    const result = await apiFetch<{ liked: boolean; likeCount: number }>(`/client/chains/entries/${entry.id}/like`, {
      method: 'POST',
    });
    entry.liked = result.liked;
    entry.likeCount = result.likeCount;
  } catch {
    // 点赞失败不打断阅读，静默即可（401 由 useApi 统一跳登录）
  }
}

/** 举报一条（一人一次，满 3 次服务端自动隐藏）。 */
async function report(entry: ChainEntry): Promise<void> {
  try {
    await apiFetch(`/client/chains/entries/${entry.id}/report`, {
      method: 'POST',
      body: { reason: 'inappropriate' },
    });
    flash.value = '已收到，我们会尽快核查。';
  } catch (e) {
    flash.value = e instanceof Error ? e.message : '举报失败，请稍后重试';
  }
}

function dateOf(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6 sm:py-8">
    <header class="mb-4">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-feather" class="h-5 w-5 text-sky-500" />
        <h1 class="text-lg font-bold text-slate-800 dark:text-slate-100">句子接龙</h1>
      </div>
      <p class="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        一句开头，谁都可以往下接。全部匿名，只留文字。每人每天 3 句。
      </p>
    </header>

    <p
      v-if="flash"
      class="mb-3 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
    >
      {{ flash }}
    </p>

    <!-- 主题列表 -->
    <template v-if="!activeId">
      <ul class="space-y-3">
        <li v-for="topic in topics" :key="topic.id">
          <button
            type="button"
            class="w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200/70 transition hover:ring-sky-300 dark:bg-slate-900 dark:ring-slate-800/80"
            @click="open(topic)"
          >
            <div class="flex items-start justify-between gap-2">
              <h2 class="text-sm font-bold text-slate-800 dark:text-slate-100">{{ topic.title }}</h2>
              <span class="shrink-0 text-[11px] text-slate-400">{{ topic.entryCount }} 句</span>
            </div>
            <p class="mt-1.5 text-xs italic leading-relaxed text-slate-500 dark:text-slate-400">
              {{ topic.starterEn }}
            </p>
            <div class="mt-2 flex items-center justify-between gap-2">
              <span class="line-clamp-1 text-[11px] text-slate-400">{{ topic.promptZh }}</span>
              <span
                v-if="topic.myEntryCount > 0"
                class="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              >
                我接过 {{ topic.myEntryCount }} 句
              </span>
            </div>
          </button>
        </li>
      </ul>
      <p v-if="topics.length === 0" class="py-16 text-center text-sm text-slate-400">还没有接龙主题…</p>
    </template>

    <!-- 主题详情 -->
    <template v-else>
      <button
        type="button"
        class="mb-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-sky-600 dark:text-slate-400"
        @click="close"
      >
        <UIcon name="i-lucide-chevron-left" class="h-3.5 w-3.5" />
        全部主题
      </button>

      <div
        class="mb-4 rounded-2xl bg-linear-to-br from-sky-50 to-indigo-50 p-4 dark:from-sky-950/40 dark:to-indigo-950/40"
      >
        <h2 class="text-base font-bold text-slate-800 dark:text-slate-100">{{ activeTopic?.title }}</h2>
        <p class="mt-2 text-sm italic leading-relaxed text-slate-700 dark:text-slate-200">
          “{{ activeTopic?.starterEn }}”
        </p>
        <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{ activeTopic?.promptZh }}</p>
      </div>

      <p v-if="loading" class="py-10 text-center text-sm text-slate-400">正在加载接龙…</p>
      <p v-else-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40">
        {{ error }}
      </p>

      <template v-else-if="detail">
        <!-- 提交 -->
        <div
          class="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
        >
          <textarea
            v-model="draftEn"
            rows="2"
            maxlength="200"
            placeholder="用一句英文接下去…"
            class="w-full resize-none rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none ring-1 ring-transparent transition focus:ring-sky-300 dark:bg-slate-800 dark:text-slate-100"
          />
          <input
            v-model="draftZh"
            maxlength="120"
            placeholder="中文翻译（可选）"
            class="mt-2 w-full rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 outline-none ring-1 ring-transparent transition focus:ring-sky-300 dark:bg-slate-800 dark:text-slate-300"
          />
          <div class="mt-2 flex items-center justify-between gap-2">
            <span class="text-[11px] text-slate-400"> 今天还能写 {{ remaining }} / {{ detail.dailyLimit }} 句 </span>
            <UButton size="xs" :disabled="!canSubmit" :loading="submitting" @click="submit">接上一句</UButton>
          </div>
          <p v-if="remaining === 0" class="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
            今天已经写了 {{ detail.dailyLimit }} 句，明天再来接。
          </p>
        </div>

        <!-- 接龙内容 -->
        <ul v-if="detail.entries.length" class="space-y-2.5">
          <li
            v-for="entry in detail.entries"
            :key="entry.id"
            class="rounded-2xl bg-white p-3.5 shadow-sm ring-1 dark:bg-slate-900"
            :class="entry.mine ? 'ring-sky-200 dark:ring-sky-900' : 'ring-slate-200/70 dark:ring-slate-800/80'"
          >
            <div class="mb-1 flex items-center gap-2">
              <span class="text-[11px] font-medium text-slate-500 dark:text-slate-400">{{ entry.alias }}</span>
              <span class="text-[10px] text-slate-300 dark:text-slate-600">{{ dateOf(entry.createdAt) }}</span>
              <span
                v-if="entry.mine"
                class="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
              >
                我
              </span>
            </div>
            <p class="text-sm leading-relaxed text-slate-800 dark:text-slate-100">{{ entry.contentEn }}</p>
            <p v-if="entry.contentZh" class="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {{ entry.contentZh }}
            </p>
            <div class="mt-2 flex items-center gap-3">
              <button
                type="button"
                class="inline-flex items-center gap-1 text-[11px] font-medium transition"
                :class="entry.liked ? 'text-rose-500' : 'text-slate-400 hover:text-rose-400'"
                @click="toggleLike(entry)"
              >
                <UIcon name="i-lucide-heart" class="h-3.5 w-3.5" :class="entry.liked ? 'fill-current' : ''" />
                {{ entry.likeCount }}
              </button>
              <button
                v-if="!entry.mine"
                type="button"
                class="inline-flex items-center gap-1 text-[11px] text-slate-300 transition hover:text-rose-400 dark:text-slate-600"
                @click="report(entry)"
              >
                <UIcon name="i-lucide-flag" class="h-3.5 w-3.5" />
                举报
              </button>
            </div>
          </li>
        </ul>
        <p v-else class="py-10 text-center text-sm text-slate-400">还没有人接第一句，你来开个头。</p>
      </template>
    </template>
  </div>
</template>
