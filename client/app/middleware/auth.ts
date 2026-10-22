/**
 * 路由中间件：要求登录（游客访问受保护页面时跳登录并携带 redirect）。
 */
export default defineNuxtRouteMiddleware((to) => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('ss_token') : null;
  if (!token) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
  }
});
