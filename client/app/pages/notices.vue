<script setup lang="ts">
/**
 * 消息中心（路由 /notices）：运营公告列表。
 *
 * 数据来自后台「客户端通知」发布的**广播公告**（GET /client/notices）。
 * 交互约定：
 * - 未读用小红点表达，**点开即已读**（正文较短，不另做详情页）；
 * - 公告带 `link` 时点击已读后顺带跳转（如活动指向 /review）；
 * - 「全部已读」一次性清红点，避免逐条点。
 *
 * 私有页：需要登录，且不进 sitemap / 不被抓取（见 nuxt.config.ts 的 robots/sitemap 配置）。
 */
import { apiFetch } from '~/composables/useApi';
import type { ClientNoticeItem, PageResult } from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '消息中心',
  description: '查看运营公告与活动通知。',
});

/** 首屏走 SSR 预取（未登录 / 令牌过期时为 null，由下方客户端兜底）。 */
const { data, refresh } = await useSsrApi<PageResult<ClientNoticeItem>>('ss:notices', '/client/notices', {
  page: 1,
  pageSize: 50,
});
const { data: unreadSsr } = await useSsrApi<{ count: number }>('ss:notices-unread', '/client/notices/unread-count');

const items = ref<ClientNoticeItem[]>(data.value?.list ?? []);
/** 未读数用服务端口径（不按当前页推算，公告超过一页时也准） */
const unread = ref(unreadSsr.value?.count ?? 0);
const loading = ref(false);
/** 正在标记已读的公告（防连点） */
const marking = ref<number | null>(null);

/** 类型 → 标签样式与文案 */
const TYPE_META: Record<number, { label: string; color: 'primary' | 'info' | 'warning' }> = {
  1: { label: '系统', color: 'info' },
  2: { label: '公告', color: 'primary' },
  3: { label: '活动', color: 'warning' },
};

/** 相对时间（今天/昨天/日期），列表里比完整时间戳更易读。 */
function timeText(value: string | null): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const at = date.getTime();
  const diffDays = Math.floor((startOfToday - at) / 86_400_000);
  if (at >= startOfToday) {
    return `今天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  if (diffDays < 1) {
    return `昨天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 重新拉取列表与未读数（失败静默：页面已有旧数据可用）。 */
async function reload(): Promise<void> {
  loading.value = true;
  try {
    const [list, count] = await Promise.all([
      apiFetch<PageResult<ClientNoticeItem>>('/client/notices', { query: { page: 1, pageSize: 50 } }),
      apiFetch<{ count: number }>('/client/notices/unread-count'),
    ]);
    items.value = list.list ?? [];
    unread.value = count.count ?? 0;
  } catch {
    // 401 由 useApi 统一处理（跳登录），其它错误保持当前列表
  } finally {
    loading.value = false;
  }
}

/** 点开一条：标记已读（幂等），有跳转链接时跟随。 */
async function openNotice(item: ClientNoticeItem): Promise<void> {
  if (item.isRead === 0 && marking.value === null) {
    marking.value = item.id;
    try {
      await apiFetch<null>(`/client/notices/${item.id}/read`, { method: 'POST' });
      item.isRead = 1;
      unread.value = Math.max(0, unread.value - 1);
    } catch {
      // 标记失败不影响阅读，下次进入还会是未读
    } finally {
      marking.value = null;
    }
  }
  if (item.link) {
    await navigateTo(item.link);
  }
}

/** 全部已读。 */
async function markAll(): Promise<void> {
  if (unread.value === 0) {
    return;
  }
  loading.value = true;
  try {
    await apiFetch<{ count: number }>('/client/notices/read-all', { method: 'POST' });
    await reload();
  } finally {
    loading.value = false;
  }
}

// 水合后用真实数据覆盖 SSR 快照（SSR 期间可能已过 2 小时令牌有效期，或期间有新公告）
onMounted(() => {
  void reload();
  void refresh();
});
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6 sm:py-8">
    <header class="mb-4 flex items-center justify-between gap-3">
      <div class="flex items-baseline gap-2">
        <h1 class="text-lg font-bold text-slate-800 dark:text-slate-100">消息中心</h1>
        <span v-if="unread > 0" class="text-xs font-medium text-sky-600 dark:text-sky-400">{{ unread }} 条未读</span>
      </div>
      <UButton
        v-if="unread > 0"
        size="xs"
        color="neutral"
        variant="outline"
        icon="i-lucide-check-check"
        :loading="loading"
        @click="markAll"
      >
        全部已读
      </UButton>
    </header>

    <ul v-if="items.length" class="space-y-3">
      <li v-for="item in items" :key="item.id">
        <button
          type="button"
          class="w-full cursor-pointer rounded-2xl bg-white p-4 text-left shadow-sm ring-1 transition hover:ring-sky-300 dark:bg-slate-900 dark:hover:ring-sky-500/40"
          :class="item.isRead === 0 ? 'ring-sky-200 dark:ring-sky-500/30' : 'ring-slate-200/70 dark:ring-slate-800/80'"
          @click="openNotice(item)"
        >
          <div class="flex items-center gap-2">
            <span v-if="item.isRead === 0" class="size-2 shrink-0 rounded-full bg-sky-500" aria-label="未读" />
            <UTag v-if="item.pinned === 1" size="sm" color="warning" variant="subtle">置顶</UTag>
            <UTag :color="TYPE_META[item.noticeType]?.color ?? 'info'" size="sm" variant="subtle">
              {{ TYPE_META[item.noticeType]?.label ?? '通知' }}
            </UTag>
            <span class="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">
              {{ item.title }}
            </span>
            <UIcon v-if="item.link" name="i-lucide-chevron-right" class="h-4 w-4 shrink-0 text-slate-400" />
          </div>
          <p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {{ item.content }}
          </p>
          <p class="mt-2 text-xs text-slate-400">
            {{ timeText(item.publishedAt ?? item.createdAt) }}
          </p>
        </button>
      </li>
    </ul>

    <div
      v-else
      class="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
    >
      <UIcon name="i-lucide-bell-off" class="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
      <p class="mt-3 text-sm text-slate-400">暂时没有消息</p>
      <p class="mt-1 text-xs text-slate-400">新场景上线、活动通知都会出现在这里</p>
    </div>
  </div>
</template>
