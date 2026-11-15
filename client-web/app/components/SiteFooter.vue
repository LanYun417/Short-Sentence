<script setup lang="ts">
/**
 * 站点页脚：法务链接（用户协议 / 隐私政策，固定展示）+ 备案号（ICP / 公安备案）。
 *
 * 备案号来自后台「系统管理 → 参数管理」的 site.icp / site.policeIcp
 * （公开接口 /api/client/site 下发）；两个都为空时备案行不渲染，但法务链接始终展示。
 * 公安备案号带盾牌图标，点击跳全国互联网安全管理服务平台。
 *
 * 读取一律 `?? ''` 兜底：状态可能来自水合/旧 payload，字段缺失时不能让整页 500。
 */
import { useSiteFiling } from '~/composables/useSiteFiling';

const { site, ensureLoaded } = useSiteFiling();

// SSR 预取失败时的客户端兜底（正常路径 app.vue 已 await 过，不会重复请求）
onMounted(ensureLoaded);

const icp = computed(() => (site.value?.icp ?? '').trim());
const policeIcp = computed(() => (site.value?.policeIcp ?? '').trim());
</script>

<template>
  <footer
    class="border-t border-slate-200/70 py-4 text-center text-[11px] leading-relaxed text-slate-400 dark:border-slate-800 dark:text-slate-500"
  >
    <!-- 法务链接固定展示（合规要求，与备案号是否配置无关） -->
    <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      <NuxtLink to="/terms" class="transition hover:text-sky-600 dark:hover:text-sky-300">用户协议</NuxtLink>
      <span aria-hidden="true">·</span>
      <NuxtLink to="/privacy" class="transition hover:text-sky-600 dark:hover:text-sky-300">隐私政策</NuxtLink>
    </div>
    <div v-if="icp || policeIcp" class="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      <a
        v-if="icp"
        href="https://beian.miit.gov.cn"
        target="_blank"
        rel="noopener noreferrer"
        class="transition hover:text-sky-600 dark:hover:text-sky-300"
        >{{ icp }}</a
      >
      <a
        v-if="policeIcp"
        href="https://beian.gov.cn"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 transition hover:text-sky-600 dark:hover:text-sky-300"
      >
        <UIcon name="i-lucide-shield-check" class="h-3 w-3" />
        {{ policeIcp }}
      </a>
    </div>
  </footer>
</template>
