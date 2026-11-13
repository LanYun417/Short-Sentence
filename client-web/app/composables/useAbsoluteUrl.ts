/**
 * 站内相对路径 → 绝对 URL（社交分享图等）。
 *
 * 为什么需要它：
 * - 爬虫按**绝对地址**取分享图，相对路径会被判为无效
 *   （unhead 的校验规则：og:image should be an absolute URL）。
 * - 站点域名只有部署时才知道（NUXT_PUBLIC_SITE_URL），构建期拿不到；
 *   开发期则根本没有正式域名，所以要按运行环境取当前 origin。
 *
 * 取值优先级：
 * 1. siteConfig.url —— 正式站点地址（生产环境由 NUXT_PUBLIC_SITE_URL 注入）；
 * 2. 当前请求 origin —— 服务端从请求头取、客户端从 location 取。
 *    开发环境（http://localhost:3001）与「部署了但没配域名」都能得到可用地址。
 */

/**
 * 把站内路径拼成绝对 URL。
 * @param path 站内相对路径，如 '/og-image.png'
 */
export function useAbsoluteUrl(path: string): string {
  // siteConfig 是响应式的：站点地址在运行期可能被注入，computed 能自动跟上。
  const siteConfig = useSiteConfig();
  const requestUrl = useRequestURL();

  return computed(() => {
    const siteUrl = typeof siteConfig.url === 'string' ? siteConfig.url : '';
    // useRequestURL：服务端返回完整请求 URL，客户端返回 location.href，两者都带 origin。
    const base = siteUrl || requestUrl.origin;
    try {
      return new URL(path, base).toString();
    } catch {
      // base 不是合法 URL（理论上不会发生）：退回原值，至少不影响渲染。
      return path;
    }
  }).value;
}
