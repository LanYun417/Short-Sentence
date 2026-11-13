/**
 * 站点备案信息（ICP / 公安备案）：/api/client/site 为 @Public，未登录也可取。
 *
 * 命名注意：**不要叫 useSiteConfig**——@nuxtjs/seo 内置的 nuxt-site-config 模块
 * 自动导出了同名 composable，且占用 useState 键，会互相顶掉导致页脚取到错误对象
 * 直接白屏（曾线上 500：site.value.icp undefined）。
 *
 * 数据流：app.vue 顶层 `await ensureLoaded()` 让 SSR 首屏 HTML 直接带备案号；
 * useState 跨组件共享、跨导航缓存，水合后不会重复请求；
 * SSR 失败时由 SiteFooter 的 onMounted 兜底再拉一次。
 */
import type { ApiEnvelope } from '~/types';

/** 站点备案信息。 */
export interface SiteFiling {
  /** 网站备案号（ICP），空串 = 未设置 */
  icp: string;
  /** 公安备案号，空串 = 未设置 */
  policeIcp: string;
}

const EMPTY: SiteFiling = { icp: '', policeIcp: '' };

export function useSiteFiling() {
  const site = useState<SiteFiling>('site-filing', () => ({ ...EMPTY }));
  const loaded = useState<boolean>('site-filing-loaded', () => false);

  /** 拉取备案信息（幂等：只拉一次；失败静默——无备案号时页脚不渲染）。 */
  async function ensureLoaded(): Promise<void> {
    if (loaded.value) {
      return;
    }
    loaded.value = true;
    const config = useRuntimeConfig();
    const apiBase = import.meta.server ? config.apiInternalUrl : config.public.apiBaseUrl;
    try {
      const res = await $fetch<ApiEnvelope<SiteFiling>>(`${apiBase}/client/site`, {
        retry: false,
        timeout: 8000,
      });
      const data = res.code === 200 ? res.data : null;
      site.value = {
        icp: typeof data?.icp === 'string' ? data.icp : '',
        policeIcp: typeof data?.policeIcp === 'string' ? data.policeIcp : '',
      };
    } catch {
      // 网络异常：保持空值，页脚不渲染
    }
  }

  return { site, ensureLoaded };
}
