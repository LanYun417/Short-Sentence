/**
 * 站点公开配置（备案号等）：/api/client/site 为 @Public，未登录也可取。
 *
 * 数据流：app.vue 顶层 `await ensureLoaded()` 让 SSR 首屏 HTML 直接带备案号；
 * useState 跨组件共享、跨导航缓存，水合后不会重复请求；
 * SSR 失败时由 SiteFooter 的 onMounted 兜底再拉一次。
 */
import type { ApiEnvelope } from '~/types';

/** 站点公开配置。 */
export interface SiteConfig {
  /** 网站备案号（ICP），空串 = 未设置 */
  icp: string;
  /** 公安备案号，空串 = 未设置 */
  policeIcp: string;
}

const EMPTY: SiteConfig = { icp: '', policeIcp: '' };

export function useSiteConfig() {
  const site = useState<SiteConfig>('site-config', () => ({ ...EMPTY }));
  const loaded = useState<boolean>('site-config-loaded', () => false);

  /** 拉取站点公开配置（幂等：只拉一次；失败静默——无备案号时页脚不渲染）。 */
  async function ensureLoaded(): Promise<void> {
    if (loaded.value) {
      return;
    }
    loaded.value = true;
    const config = useRuntimeConfig();
    const apiBase = import.meta.server ? config.apiInternalUrl : config.public.apiBaseUrl;
    try {
      const res = await $fetch<ApiEnvelope<SiteConfig>>(`${apiBase}/client/site`, {
        retry: false,
        timeout: 8000,
      });
      if (res.code === 200 && res.data) {
        site.value = { icp: res.data.icp ?? '', policeIcp: res.data.policeIcp ?? '' };
      }
    } catch {
      // 网络异常：保持空值，页脚不渲染
    }
  }

  return { site, ensureLoaded };
}
