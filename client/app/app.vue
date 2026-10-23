<script setup lang="ts">
/**
 * 应用外壳：顶部导航 + 移动端底部 Tab（滑动指示器）+ 主题切换 + 登录态恢复。
 * 客户端用户体系（client_user）与后台 admin 完全隔离。
 */
import { useAuthStore } from '~/stores/auth';
import type { ClientUserProfile } from '~/types';

const auth = useAuthStore();
const colorMode = useColorMode();
const route = useRoute();

/**
 * SSR 预取当前用户：首屏 HTML 直接带昵称/头像，不再等水合后闪空。
 * 键 ss:me 与个人中心共享，同一次请求只调一次接口（useAsyncData 按 key 去重）。
 */
const { data: ssrUser } = await useSsrApi<ClientUserProfile>('ss:me', '/client/auth/me');
if (ssrUser.value) {
  // 服务端与客户端水合期都直接注入 store，两端首帧一致（资料本身会渲染进 HTML，无泄露面）
  auth.user = ssrUser.value;
}

/**
 * SSR 预取「今日句签是否已获得」：导航头像的常驻特效据此点亮。
 * 未登录 / 预取失败都按「未获得」处理（接口返回 obtained=false）。
 */
const { status: todayCard } = useTodayCard();
const { data: ssrTodayCard } = await useSsrApi<{ obtained: boolean; bizDate: string }>(
  'ss:today-card',
  '/client/sentence-card/today',
);
if (ssrTodayCard.value) {
  todayCard.value = ssrTodayCard.value;
}

/**
 * 结构化数据（JSON-LD）：让搜索引擎直接理解「这是什么产品」，是富媒体摘要的前提。
 * 放在外壳而非单个页面：任何入口被收录时都带着它。
 */
const siteConfig = useSiteConfig();
useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', name: '短句', url: siteConfig.url || '/', inLanguage: 'zh-CN' },
          {
            '@type': 'WebApplication',
            name: '短句',
            url: siteConfig.url || '/',
            applicationCategory: 'EducationalApplication',
            operatingSystem: 'Web',
            inLanguage: 'zh-CN',
            description: '每天 20 句，看图学地道英语口语。场景闪卡 + 间隔重复 + AI 拓展。',
            featureList: ['视觉场景闪卡', '间隔重复复习', 'AI 场景造句', '词根拆解', '每日句签'],
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
          },
        ],
      }),
    },
  ],
});

/** 导航项（含移动端底部 Tab 图标）。 */
const NAV_ITEMS = [
  { to: '/', label: '刷题', icon: 'i-lucide-layers' },
  { to: '/favorites', label: '收藏', icon: 'i-lucide-star' },
  { to: '/review', label: '复习', icon: 'i-lucide-refresh-cw' },
  { to: '/ai', label: 'AI 拓展', icon: 'i-lucide-sparkles' },
  { to: '/profile', label: '我的', icon: 'i-lucide-user' },
];

/** 当前导航是否激活（精确匹配根路径，其余前缀匹配）。 */
function isActive(to: string): boolean {
  return to === '/' ? route.path === '/' : route.path === to || route.path.startsWith(`${to}/`);
}

/** 底部 Tab 滑动指示器位置（-1 = 当前不在任一 Tab，隐藏指示器）。 */
const activeIndex = computed(() => NAV_ITEMS.findIndex((item) => isActive(item.to)));

const avatarText = computed(() => (auth.user?.nickname ?? '?').slice(0, 1));
const avatarSrc = computed(() => auth.user?.avatarUrl ?? undefined);

onMounted(() => {
  // 挂载后再恢复本地缓存资料：SSR 首屏与客户端首帧都不读 localStorage，避免水合不一致
  auth.hydrate();
  if (ssrUser.value) {
    // SSR 已带来最新资料：顺带刷新 localStorage 缓存，后续离线兜底也是新数据
    auth.setProfile(ssrUser.value);
  } else if (auth.loggedIn && !auth.user) {
    // SSR 预取失败（Cookie 令牌过期等）：走既有客户端流程（含无感刷新）
    void auth.fetchMe();
  }
});

/** 切换亮/暗。 */
function toggleTheme(): void {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark';
}

/** 退出登录。 */
function onLogout(): void {
  void auth.logout();
}
</script>

<template>
  <!-- UApp 是 @nuxt/ui 的根容器：提供 Toast / Modal / Tooltip 等覆盖层上下文 -->
  <UApp>
    <div
      class="flex h-dvh flex-col overflow-hidden bg-linear-to-b from-sky-50/60 via-slate-50 to-slate-50 transition-colors dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 dark:text-slate-100"
    >
      <!-- 顶部栏（页面本身不滚，故 header 恒定固定） -->
      <header
        class="anim-fade shrink-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-900/80"
      >
        <div class="mx-auto flex h-14 max-w-3xl items-center gap-1 px-4 md:h-16">
          <!-- 品牌字标 -->
          <NuxtLink to="/" class="group mr-2 flex items-center gap-2 md:mr-4">
            <img
              src="/favicon.svg"
              alt="短句"
              class="h-8 w-8 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110"
            />
            <span
              class="bg-linear-to-r from-sky-600 to-indigo-600 bg-clip-text text-lg font-bold tracking-tight text-transparent dark:from-sky-400 dark:to-indigo-400"
              >短句</span
            >
          </NuxtLink>

          <!-- 桌面端内联导航 -->
          <nav class="hidden flex-1 items-center gap-1 md:flex">
            <NuxtLink
              v-for="item in NAV_ITEMS"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition"
              :class="
                isActive(item.to)
                  ? 'bg-sky-50 font-medium text-sky-600 dark:bg-sky-500/15 dark:text-sky-300'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
              "
            >
              <UIcon :name="item.icon" class="h-4 w-4" />
              {{ item.label }}
            </NuxtLink>
          </nav>

          <div class="flex flex-1 items-center justify-end gap-1 md:flex-none">
            <UButton
              color="neutral"
              variant="ghost"
              :icon="colorMode === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
              class="[&_svg]:transition-transform [&_svg]:duration-500"
              :class="colorMode === 'dark' && '[&_svg]:rotate-180'"
              :aria-label="colorMode === 'dark' ? '切换到亮色主题' : '切换到暗色主题'"
              title="切换主题"
              @click="toggleTheme"
            />

            <template v-if="!auth.loggedIn">
              <UButton to="/login" size="sm" class="anim-pop ml-1"> 登录 </UButton>
            </template>
            <template v-else>
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-log-out"
                size="sm"
                class="[&_svg]:transition-transform [&_svg]:duration-300 [&_svg]:hover:translate-x-0.5"
                title="退出登录"
                aria-label="退出登录"
                @click="onLogout"
              />
              <!-- 头像固定在最右侧（点击进个人中心） -->
              <!-- 刻意不用 UAvatar/NuxtImg：它会把 /static 当本地文件解析走 /_ipx 代理，
                   而配图实际在 API 侧（devProxy 只对 HTTP 请求生效），导致 IPX_FILE_NOT_FOUND。
                   这里用裸 <img>，与 profile 页头像一致。 -->
              <NuxtLink to="/profile" class="relative ml-1" aria-label="个人中心" data-avatar>
                <!-- 今日句签已获得：常驻光环 + 角标（光束飞行的落点） -->
                <span
                  v-if="todayCard.obtained"
                  class="ss-avatar-halo pointer-events-none absolute -inset-[3px] rounded-full opacity-90"
                />
                <span
                  class="relative grid size-8 place-items-center overflow-hidden rounded-full bg-linear-to-br from-sky-500 to-indigo-600 text-sm font-bold text-white transition-transform duration-200 hover:scale-110"
                >
                  <img v-if="avatarSrc" :src="avatarSrc" alt="头像" class="h-full w-full object-cover" />
                  <span v-else>{{ avatarText }}</span>
                </span>
                <span
                  v-if="todayCard.obtained"
                  class="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-amber-400 text-white shadow-sm ring-2 ring-white dark:ring-slate-900"
                >
                  <UIcon name="i-lucide-sparkles" class="h-2.5 w-2.5" />
                </span>
              </NuxtLink>
            </template>
          </div>
        </div>
      </header>

      <!-- 主内容：内容区自己滚（header 固定），移动端底部为 Tab 栏留白 -->
      <main class="min-h-0 flex-1">
        <AppScrollArea>
          <div class="pb-16 md:pb-0">
            <NuxtPage />
          </div>
        </AppScrollArea>
      </main>

      <!-- 移动端底部 Tab 栏（滑动指示器） -->
      <nav
        class="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/70 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden dark:border-slate-800/70 dark:bg-slate-900/90"
      >
        <div class="relative mx-auto flex max-w-3xl">
          <!-- 指示器：随激活项滑动 -->
          <span
            class="absolute inset-y-1 left-0 w-1/5 rounded-2xl bg-sky-50 transition-transform duration-300 ease-out dark:bg-sky-500/15"
            :class="activeIndex < 0 && 'opacity-0'"
            :style="{ transform: `translateX(${Math.max(activeIndex, 0) * 100}%)` }"
          />

          <NuxtLink
            v-for="item in NAV_ITEMS"
            :key="item.to"
            :to="item.to"
            class="relative z-10 flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition active:scale-90"
            :class="
              isActive(item.to)
                ? 'font-medium text-sky-600 dark:text-sky-300'
                : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
            "
          >
            <UIcon
              :name="item.icon"
              class="h-5 w-5 transition-transform duration-200"
              :class="isActive(item.to) && 'scale-110'"
            />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </div>
      </nav>
    </div>
  </UApp>
</template>
