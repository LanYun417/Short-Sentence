<script setup lang="ts">
/**
 * 应用根组件：只承担**全局**职责，不渲染任何具体外壳。
 *
 * 1. UI 容器：`<UApp>` 提供 Toast / Modal / Tooltip 等覆盖层的上下文；
 * 2. 布局分发：`<NuxtLayout>` 消费页面级 `layout` 元信息（default / auth）；
 * 3. 全局数据预取：SSR 阶段取当前用户与今日句签，让首屏 HTML 直接带数据；
 * 4. 站点级结构化数据（JSON-LD）。
 *
 * 顶栏、底部 Tab 等「外壳」属于 default 布局的职责，见 `layouts/default.vue`。
 * 之所以拆开：外壳写死在根组件里时，页面无法通过 `layout` 声明「我不要外壳」，
 * 会导致认证页在页面间 SPA 导航时内容不渲染。
 */
import { useAuthStore } from '~/stores/auth';
import type { ClientUserProfile } from '~/types';

const auth = useAuthStore();

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
 * 放在根组件而非单个页面：任何入口被收录时都带着它。
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
</script>

<template>
  <!-- UApp 是 @nuxt/ui 的根容器：提供 Toast / Modal / Tooltip 等覆盖层上下文 -->
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
