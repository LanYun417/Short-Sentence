<script setup lang="ts">
/**
 * 独立「下载 App」落地页（替代原先 profile / 登录页里的弹窗式下载入口）。
 *
 * - 用专属 `download` 布局，**脱离 default 应用外壳**（无顶栏导航、无移动端底部 Tab），
 *   是真正独立的全屏落地页；布局只保留品牌 + 主题切换的极简顶栏。
 * - 版本信息走公开接口 /client/app/latest（无需登录），SSR 预取让首屏直出最新版本，
 *   服务端无令牌也能取（与需登录的业务接口不同，这里不依赖 ss_token）。
 * - 安装包下载走专用接口 /api/client/app/download/:id——绕过 /static 防盗链并统计下载量。
 * - 公开页，显式 indexable（登录/注册之外少数可收录页）。
 */
import type { ApiEnvelope, LatestAppVersion } from '~/types';
import { apiFetch } from '~/composables/useApi';

definePageMeta({ layout: 'download' });

usePageSeo({
  title: '下载短句 App',
  description: '把短句装进口袋：通勤路上也能刷两题、领每日 AI 句签。Android 安装包，点击即下。',
  indexable: true,
});

const config = useRuntimeConfig();
const apiBase = import.meta.server ? config.apiInternalUrl : config.public.apiBaseUrl;

/** 最新上架版本（null = 后台还没发布过安装包）。SSR 预取 + 客户端兜底。 */
const { data: latest, pending } = await useAsyncData<LatestAppVersion | null>('ss:app-latest', async () => {
  try {
    const res = await $fetch<ApiEnvelope<LatestAppVersion | null>>(`${apiBase}/client/app/latest`, {
      retry: false,
      timeout: 8000,
    });
    return res.code === 200 ? res.data : null;
  } catch {
    return null;
  }
});

/** 客户端兜底：SSR 没拿到（网络抖动 / 内部地址不通）时再拉一次。 */
onMounted(() => {
  if (!latest.value && !pending.value) {
    void apiFetch<LatestAppVersion | null>('/client/app/latest')
      .then((data) => {
        latest.value = data;
      })
      .catch(() => undefined);
  }
});

/** 安装包下载地址（相对即可：同源部署直击 api，开发期由 devProxy 转发）。 */
const downloadUrl = computed(() => (latest.value ? `/api/client/app/download/${latest.value.id}` : '#'));

const canDownload = computed(() => !!latest.value);

function sizeText(bytes: number): string {
  return bytes > 0 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '—';
}

function dateText(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 卖点。 */
const FEATURES = [
  { icon: 'i-lucide-headphones', title: '通勤刷题', desc: '碎片时间，随时随地刷两题' },
  { icon: 'i-lucide-sparkles', title: '每日句签', desc: 'AI 生成精美闪卡，3D 视差收藏' },
  { icon: 'i-lucide-refresh-cw', title: '间隔复习', desc: '科学记忆曲线，记得更牢' },
  { icon: 'i-lucide-bookmark', title: '离线收藏', desc: '喜欢的句子随身带' },
] as const;
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-8 md:py-12">
    <!-- ============ Hero ============ -->
    <section
      class="anim-in relative overflow-hidden rounded-3xl bg-linear-to-br from-sky-500 via-indigo-500 to-violet-500 px-6 py-10 text-center md:px-10 md:py-14"
    >
      <!-- 装饰光斑（缓慢漂移，不死板） -->
      <div
        class="anim-drift pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-white/20 blur-2xl"
      />
      <div
        class="anim-drift pointer-events-none absolute -bottom-16 -left-8 size-40 rounded-full bg-sky-200/25 blur-2xl"
        style="animation-delay: -6s"
      />

      <div class="relative">
        <AppLogo class="mx-auto h-20 w-20 drop-shadow-lg md:h-24 md:w-24" />

        <h1 class="mt-5 text-2xl font-bold text-white drop-shadow-sm md:text-3xl">把短句装进口袋</h1>
        <p class="mx-auto mt-2.5 max-w-sm text-sm text-white/85 md:text-base">
          通勤路上也能刷两题、领每日 AI 句签。<br class="hidden sm:block" />
          装到手机上，学习不挑场景。
        </p>

        <!-- 主 CTA -->
        <div class="mt-7 flex flex-col items-center gap-3">
          <a
            v-if="canDownload"
            :href="downloadUrl"
            download
            class="hover-lift inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-base font-semibold text-sky-600 shadow-lg shadow-sky-900/20 transition hover:bg-sky-50"
          >
            <UIcon name="i-lucide-download" class="h-5 w-5" />
            下载 Android 安装包
          </a>
          <div
            v-else
            class="inline-flex items-center gap-2 rounded-full bg-white/90 px-7 py-3 text-base font-semibold text-slate-400"
          >
            <UIcon name="i-lucide-hourglass" class="h-5 w-5" />
            安装包即将上线
          </div>
          <p class="flex items-center gap-1.5 text-xs text-white/75">
            <UIcon name="i-lucide-android" class="h-3.5 w-3.5" />
            当前提供 Android 安装包 · 免费
          </p>
        </div>
      </div>
    </section>

    <!-- ============ 最新版本 ============ -->
    <section
      class="anim-in mt-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 md:p-6 dark:bg-slate-900 dark:ring-slate-800/80"
      style="animation-delay: 60ms"
    >
      <div class="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <UIcon name="i-lucide-package" class="h-4 w-4 text-sky-500" />
        最新版本
      </div>

      <div v-if="pending" class="mt-4 flex items-center gap-2 text-sm text-slate-400">
        <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin" />
        正在获取版本信息…
      </div>

      <div v-else-if="!latest" class="mt-4 text-sm text-slate-400">暂未发布安装包，敬请期待。</div>

      <div v-else class="mt-4 space-y-3">
        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span class="text-2xl font-bold text-slate-900 dark:text-slate-50">v{{ latest.version }}</span>
          <span class="text-xs text-slate-400">
            {{ sizeText(latest.fileSize) }} · {{ dateText(latest.publishedAt) }} 更新
          </span>
          <UBadge v-if="latest.forceUpdate" color="warning" variant="subtle" size="sm">重要更新</UBadge>
        </div>

        <div
          v-if="latest.changelog"
          class="rounded-xl bg-slate-50 px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
        >
          {{ latest.changelog }}
        </div>
      </div>
    </section>

    <!-- ============ 安装指引（未知来源应用） ============ -->
    <section
      class="anim-in mt-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 md:p-6 dark:bg-slate-900 dark:ring-slate-800/80"
      style="animation-delay: 90ms"
    >
      <div class="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <UIcon name="i-lucide-shield-check" class="h-4 w-4 text-sky-500" />
        安装指引
      </div>
      <ol class="mt-4 space-y-3">
        <li class="flex gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span
            class="grid size-6 shrink-0 place-items-center rounded-full bg-sky-50 text-xs font-semibold text-sky-600 dark:bg-sky-500/15 dark:text-sky-300"
            >1</span
          >
          <span class="pt-0.5">点击上方按钮下载安装包（<span class="font-medium">.apk</span> 文件）。</span>
        </li>
        <li class="flex gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span
            class="grid size-6 shrink-0 place-items-center rounded-full bg-sky-50 text-xs font-semibold text-sky-600 dark:bg-sky-500/15 dark:text-sky-300"
            >2</span
          >
          <span class="pt-0.5">若系统提示「禁止安装未知来源应用」，点「设置」→ 允许本次安装（浏览器 / 短句）。</span>
        </li>
        <li class="flex gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span
            class="grid size-6 shrink-0 place-items-center rounded-full bg-sky-50 text-xs font-semibold text-sky-600 dark:bg-sky-500/15 dark:text-sky-300"
            >3</span
          >
          <span class="pt-0.5">返回继续安装，打开 App 即可开始学习。</span>
        </li>
      </ol>
    </section>

    <!-- ============ 卖点 ============ -->
    <section class="mt-5 grid grid-cols-2 gap-3">
      <div
        v-for="(f, i) in FEATURES"
        :key="f.title"
        class="anim-in rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
        :style="{ animationDelay: `${120 + i * 60}ms` }"
      >
        <UIcon :name="f.icon" class="h-6 w-6 text-sky-500" />
        <p class="mt-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100">{{ f.title }}</p>
        <p class="mt-1 text-xs leading-relaxed text-slate-400">{{ f.desc }}</p>
      </div>
    </section>
  </div>
</template>
