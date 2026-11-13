/**
 * 路由中间件：要求登录（游客访问受保护页面时跳登录并携带 redirect）。
 *
 * 登录态以 Cookie 为准：SSR 时服务端没有 localStorage，只能读请求 Cookie。
 * 若改回读 localStorage，服务端永远读不到 → 每次刷新都被误判未登录。
 */
export default defineNuxtRouteMiddleware((to) => {
  const token = useCookie<string | null>('ss_token');
  if (!token.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
  }
});
