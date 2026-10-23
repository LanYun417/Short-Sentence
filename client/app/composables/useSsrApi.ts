/**
 * SSR 数据获取（服务端渲染业务数据的统一入口）。
 *
 * 为什么需要它：业务数据此前全部在 onMounted 客户端拉取，SSR 只渲染壳——
 * 首屏是一堆骨架屏，等水合后才出内容。这里把「读 Cookie 令牌 → 服务端带
 * Bearer 调 API」放进 useAsyncData，让首屏 HTML 直接带数据。
 *
 * 关键设计：
 * - **令牌来源是 Cookie（ss_token）**：服务端读不到 localStorage，Cookie 是唯一 SSR 可读凭证。
 * - **优雅降级**：令牌过期（access 有效期 2h，Cookie 里常是旧的）或网络失败时返回 null，
 *   绝不在服务端跳登录——由页面 onMounted 检测到 null 后走既有客户端流程（含无感刷新）。
 * - **getCachedData 仅在水合期复用 payload**：客户端路由切换时重新执行（此时读浏览器
 *   Cookie 发起客户端 fetch），避免把 SSR 时的旧数据（如未登录时的 null）永远缓存。
 * - **令牌不进 payload**：只把业务 JSON 序列化进 __NUXT__，无泄露面。
 */
import type { ApiEnvelope } from '~/types';

export function useSsrApi<T>(key: string, path: string, query?: Record<string, unknown>) {
  const config = useRuntimeConfig();
  const tokenCookie = useCookie<string | null>('ss_token');
  // 服务端直连 API 内网地址（相对 /api 由网关转发，Node 内部 $fetch 走不到）；客户端沿用同源相对路径
  const apiBase = import.meta.server ? config.apiInternalUrl : config.public.apiBaseUrl;

  return useAsyncData<T | null>(
    key,
    async () => {
      const token = tokenCookie.value;
      if (!token) {
        return null;
      }
      try {
        const response = await $fetch<ApiEnvelope<T>>(`${apiBase}${path}`, {
          query,
          headers: { Authorization: `Bearer ${token}` },
          retry: false,
          timeout: 8000,
        });
        return response.code === 200 ? response.data : null;
      } catch {
        // 401（Cookie 令牌过期）/ 网络异常：服务端不处理登录流转，交给客户端兜底
        return null;
      }
    },
    {
      default: () => null,
      getCachedData: (cachedKey, nuxtApp) => (nuxtApp.isHydrating ? nuxtApp.payload.data[cachedKey] : undefined),
    },
  );
}
