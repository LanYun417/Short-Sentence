<script setup lang="ts">
/**
 * 「下载 App」入口，两种呈现：
 * - `card`（默认）：我的页里的整行卡片；
 * - `link`：登录/注册页底部的轻量文字链接——**未登录用户也要能下载 App**。
 *
 * 点击才去取最新版本（首屏不为它多发一个请求）；下载走 api 专用接口
 * `/api/client/app/download/:id`——绕过 `/static` 的防盗链，同时能统计下载量。
 */
import { apiFetch } from '~/composables/useApi';
import type { LatestAppVersion } from '~/types';

withDefaults(defineProps<{ variant?: 'card' | 'link' }>(), { variant: 'card' });

const open = ref(false);
const loading = ref(false);
const latest = ref<LatestAppVersion | null>(null);
const error = ref('');

/** 拉取最新上架版本（null = 后台还没发布过安装包）。 */
async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    latest.value = await apiFetch<LatestAppVersion | null>('/client/app/latest');
  } catch (err) {
    error.value = err instanceof Error ? err.message : '获取版本信息失败';
  } finally {
    loading.value = false;
  }
}

function openDialog(): void {
  open.value = true;
  if (!latest.value && !loading.value) {
    void load();
  }
}

/** 相对路径即可：同源部署直接命中 api，开发期由 devProxy 转发 */
const downloadUrl = computed(() => (latest.value ? `/api/client/app/download/${latest.value.id}` : '#'));

function sizeText(bytes: number): string {
  return bytes > 0 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '—';
}

function dateText(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
</script>

<template>
  <!-- 我的页：整行卡片 -->
  <button
    v-if="variant === 'card'"
    type="button"
    class="anim-in mt-3 flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-sm ring-1 ring-slate-200/70 transition hover:ring-sky-300 dark:bg-slate-900 dark:ring-slate-800/80 dark:hover:ring-sky-500/40"
    style="animation-delay: 115ms"
    @click="openDialog"
  >
    <UIcon name="i-lucide-smartphone" class="h-5 w-5 shrink-0 text-sky-500" />
    <span class="min-w-0 flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">下载 App</span>
    <span class="shrink-0 text-xs text-slate-400">Android</span>
    <UIcon name="i-lucide-chevron-right" class="h-4 w-4 shrink-0 text-slate-400" />
  </button>

  <!-- 登录/注册页：轻量文字链接，不抢表单的视觉重心 -->
  <button
    v-else
    type="button"
    class="mx-auto flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-sky-600 dark:hover:text-sky-400"
    @click="openDialog"
  >
    <UIcon name="i-lucide-smartphone" class="h-4 w-4" />
    下载 Android App
  </button>

  <UModal v-model:open="open" title="下载短句 App" description="装到手机上，通勤路上也能刷两题。">
    <template #body>
      <div v-if="loading" class="flex items-center gap-2 py-6 text-sm text-slate-400">
        <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin" />
        正在获取最新版本…
      </div>
      <div v-else-if="error" class="flex items-center gap-2 py-6 text-sm text-rose-500">
        {{ error }}
        <UButton size="xs" variant="link" @click="load">重试</UButton>
      </div>
      <div v-else-if="!latest" class="py-8 text-center text-sm text-slate-400">暂未发布安装包，稍后再来看看</div>
      <div v-else class="space-y-3">
        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span class="text-lg font-semibold text-slate-800 dark:text-slate-100">v{{ latest.version }}</span>
          <span class="text-xs text-slate-400">
            {{ sizeText(latest.fileSize) }} · {{ dateText(latest.publishedAt) }} 更新
          </span>
          <UBadge v-if="latest.forceUpdate" color="warning" variant="subtle" size="sm">建议升级</UBadge>
        </div>
        <div
          v-if="latest.changelog"
          class="rounded-xl bg-slate-50 p-3 text-sm leading-relaxed whitespace-pre-wrap text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
        >
          {{ latest.changelog }}
        </div>
        <p class="text-xs text-slate-400">Android 安装包。若提示「未知来源应用」，在系统设置里允许本次安装即可。</p>
      </div>
    </template>
    <template #footer>
      <div class="flex items-center justify-end">
        <a
          v-if="latest"
          :href="downloadUrl"
          class="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
        >
          <UIcon name="i-lucide-download" class="h-4 w-4" />
          下载安装包
        </a>
      </div>
    </template>
  </UModal>
</template>
