<script setup lang="ts">
/**
 * 应用外壳：顶部导航 + 主题切换 + 登录态恢复。
 * 客户端用户体系（client_user）与后台 admin 完全隔离。
 */
import { useAuthStore } from '~/stores/auth';

const auth = useAuthStore();
const colorMode = useColorMode();
const route = useRoute();

/** 导航项（个人中心需登录） */
const NAV_ITEMS = [
  { to: '/', label: '刷题' },
  { to: '/favorites', label: '收藏' },
  { to: '/review', label: '复习' },
  { to: '/ai', label: 'AI 拓展' },
  { to: '/profile', label: '我的' },
];

onMounted(() => {
  // 有令牌但本地无缓存资料时（如新标签页）拉一次
  if (auth.loggedIn && !auth.user) {
    void auth.fetchMe();
  }
});

/** 切换亮/暗。 */
function toggleTheme(): void {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark';
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-900 dark:text-slate-100">
    <header
      class="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/80"
    >
      <div class="mx-auto flex h-14 max-w-3xl items-center gap-1 px-4">
        <NuxtLink to="/" class="mr-3 text-lg font-bold tracking-tight text-sky-600 dark:text-sky-400">短句</NuxtLink>

        <nav class="flex flex-1 items-center gap-1">
          <NuxtLink
            v-for="item in NAV_ITEMS"
            :key="item.to"
            :to="item.to"
            class="rounded-full px-3 py-1.5 text-sm transition"
            :class="
              route.path === item.to
                ? 'bg-sky-50 font-medium text-sky-600 dark:bg-sky-900/30 dark:text-sky-400'
                : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            "
          >
            {{ item.label }}
          </NuxtLink>
        </nav>

        <button
          class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          title="切换主题"
          @click="toggleTheme"
        >
          {{ colorMode === 'dark' ? '☀️' : '🌙' }}
        </button>

        <NuxtLink
          v-if="!auth.loggedIn"
          to="/login"
          class="ml-1 rounded-full bg-sky-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-sky-500"
        >
          登录
        </NuxtLink>
        <button
          v-else
          class="ml-1 rounded-full px-3 py-1.5 text-sm text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          @click="auth.logout()"
        >
          退出
        </button>
      </div>
    </header>

    <main>
      <NuxtPage />
    </main>
  </div>
</template>
