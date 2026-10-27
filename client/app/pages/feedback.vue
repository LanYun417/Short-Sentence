<script setup lang="ts">
/**
 * 意见反馈（路由 /feedback）：提交产品反馈 + 查看自己的反馈与处理结果。
 *
 * 与答题卡上的「举报」区分：举报针对**某一道题**，这里面向**产品本身**
 * （功能建议 / 使用异常 / 内容问题 / 体验建议），并可留联系方式便于回访。
 *
 * 提交后在下方就能看到运营回复：后台处理时会填「回复用户」，用户端能看到——
 * 这是「意见被听见」的闭环，否则用户不知道反馈有没有人管。
 *
 * 私有页：需要登录，且不进 sitemap / 不被抓取（见 nuxt.config.ts 的 robots/sitemap）。
 */
import { apiFetch } from '~/composables/useApi';
import type { MyFeedbackItem, PageResult } from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '意见反馈',
  description: '提交使用建议与问题，我们会逐条查看并回复。',
});

/** 反馈类型（value 与后端白名单一致）。 */
const TYPES = [
  { value: 'feature', label: '功能建议', icon: 'i-lucide-lightbulb' },
  { value: 'bug', label: '使用异常', icon: 'i-lucide-bug' },
  { value: 'content', label: '内容问题', icon: 'i-lucide-file-text' },
  { value: 'ux', label: '体验建议', icon: 'i-lucide-sparkles' },
  { value: 'other', label: '其他', icon: 'i-lucide-message-circle' },
] as const;

/** 类型文案（列表里按 value 反查）。 */
const TYPE_LABEL: Record<string, string> = {
  feature: '功能建议',
  bug: '使用异常',
  content: '内容问题',
  ux: '体验建议',
  other: '其他',
};

/** 处理状态 → 文案与配色。 */
const STATUS_META: Record<string, { label: string; color: 'warning' | 'success' | 'neutral' }> = {
  pending: { label: '待处理', color: 'warning' },
  resolved: { label: '已处理', color: 'success' },
  dismissed: { label: '已驳回', color: 'neutral' },
};

/** 首屏走 SSR 预取（未登录 / 令牌过期时为 null，由下方客户端兜底）。 */
const { data, refresh } = await useSsrApi<PageResult<MyFeedbackItem>>('ss:feedback-mine', '/client/feedback/mine', {
  page: 1,
  pageSize: 20,
});
const items = ref<MyFeedbackItem[]>(data.value?.list ?? []);

const type = ref<string>('feature');
const content = ref('');
const contact = ref('');
const submitting = ref(false);
const message = ref('');
const ok = ref(false);

/** 与后端同口径：内容至少 5 个字（前端先拦一次，别让用户白填一遍）。 */
const canSubmit = computed(() => content.value.trim().length >= 5 && !submitting.value);

/** 拉取「我的反馈」（失败静默：页面已有旧数据可用）。 */
async function reload(): Promise<void> {
  try {
    const res = await apiFetch<PageResult<MyFeedbackItem>>('/client/feedback/mine', {
      query: { page: 1, pageSize: 20 },
    });
    items.value = res.list ?? [];
  } catch {
    // 401 由 useApi 统一处理（跳登录），其它错误保持当前列表
  }
}

/** 提交反馈。 */
async function submit(): Promise<void> {
  if (submitting.value) {
    return;
  }
  if (content.value.trim().length < 5) {
    ok.value = false;
    message.value = '请至少写 5 个字，方便我们定位问题';
    return;
  }
  submitting.value = true;
  message.value = '';
  try {
    await apiFetch<{ id: number }>('/client/feedback', {
      method: 'POST',
      body: {
        type: type.value,
        content: content.value.trim(),
        contact: contact.value.trim() || undefined,
        platform: 'web',
      },
    });
    ok.value = true;
    message.value = '已收到你的反馈，感谢！';
    content.value = '';
    contact.value = '';
    await reload();
  } catch (error) {
    ok.value = false;
    message.value = error instanceof Error ? error.message : '提交失败，请稍后重试';
  } finally {
    submitting.value = false;
  }
}

/** 列表里的时间文案（只到天，列表用完整时间戳反而难扫）。 */
function timeText(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 水合后用真实数据覆盖 SSR 快照（SSR 期间可能已有新回复，或令牌已过期）
onMounted(() => {
  void reload();
  void refresh();
});
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6 sm:py-8">
    <h1 class="mb-4 text-lg font-bold text-slate-800 dark:text-slate-100">意见反馈</h1>

    <!-- 提交区 -->
    <section
      class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
    >
      <p class="text-sm font-medium text-slate-700 dark:text-slate-200">反馈类型</p>
      <div class="mt-2 flex flex-wrap gap-2">
        <UButton
          v-for="item in TYPES"
          :key="item.value"
          size="sm"
          :icon="item.icon"
          :color="type === item.value ? 'primary' : 'neutral'"
          :variant="type === item.value ? 'solid' : 'outline'"
          @click="type = item.value"
        >
          {{ item.label }}
        </UButton>
      </div>

      <p class="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">具体描述</p>
      <UTextarea
        v-model="content"
        class="mt-2 w-full"
        :rows="4"
        maxlength="1000"
        placeholder="说说你的建议或遇到的问题。写清「在哪一步、期望什么」会更快被处理"
      />
      <p class="mt-1 text-right text-xs text-slate-400">{{ content.length }}/1000</p>

      <p class="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">联系方式（选填）</p>
      <UInput v-model="contact" class="mt-2 w-full" maxlength="100" placeholder="邮箱 / 微信，方便我们回访" />

      <div class="mt-4 flex items-center justify-between gap-3">
        <p v-if="message" class="text-sm" :class="ok ? 'text-sky-600 dark:text-sky-400' : 'text-rose-500'">
          {{ message }}
        </p>
        <span v-else class="text-xs text-slate-400">我们会在「我的反馈」里回复你</span>
        <UButton :loading="submitting" :disabled="!canSubmit" icon="i-lucide-send" @click="submit">提交</UButton>
      </div>
    </section>

    <!-- 我的反馈 -->
    <section class="mt-6">
      <h2 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">我的反馈</h2>
      <ul v-if="items.length" class="space-y-3">
        <li
          v-for="item in items"
          :key="item.id"
          class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
        >
          <div class="flex items-center gap-2">
            <UTag size="sm" variant="subtle" color="primary">{{ TYPE_LABEL[item.type] ?? item.type }}</UTag>
            <UTag size="sm" variant="subtle" :color="STATUS_META[item.status]?.color ?? 'neutral'">
              {{ STATUS_META[item.status]?.label ?? item.status }}
            </UTag>
            <span class="ml-auto text-xs text-slate-400">{{ timeText(item.createdAt) }}</span>
          </div>
          <p class="mt-2 text-sm break-words whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-200">
            {{ item.content }}
          </p>
          <div
            v-if="item.reply"
            class="mt-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-900 dark:bg-sky-500/10 dark:text-sky-200"
          >
            <p class="text-xs font-medium">我们的回复</p>
            <p class="mt-1 break-words whitespace-pre-wrap leading-relaxed">{{ item.reply }}</p>
          </div>
        </li>
      </ul>

      <div
        v-else
        class="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
      >
        <UIcon name="i-lucide-message-square-text" class="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
        <p class="mt-3 text-sm text-slate-400">还没有提交过反馈</p>
        <p class="mt-1 text-xs text-slate-400">你的每一条建议我们都会看</p>
      </div>
    </section>
  </div>
</template>
