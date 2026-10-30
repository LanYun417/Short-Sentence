/**
 * 页面级 SEO（标题 / 描述 / 收录策略 / 分享卡片）。
 *
 * 为什么封装而不是每页手写 useSeoMeta：
 * 1. 字段成套出现（title / description / og），逐页手写必漏；
 * 2. 「私有页必须 noindex」是硬性要求——做成**默认值**比每页记得传更可靠，
 *    公开页显式 `indexable: true` 才放开，属于「安全默认」设计。
 *
 * 为什么只用 Open Graph、不写 twitter:* 标签：
 * unhead v3 已把 twitter:* 判定为弃用（浏览器控制台会刷
 * "twitter:card is deprecated. Use Open Graph metadata instead."），
 * OG 的 og:title / og:description / og:image 已是社交平台的事实标准，
 * 多写一份 twitter 标签只会带来噪音告警。
 */
interface PageSeoOptions {
  /** 页面短标题（品牌后缀由 nuxt.config 的 titleTemplate 统一拼接） */
  title: string;
  /** 页面描述（meta description 与 og:description 共用） */
  description: string;
  /**
   * 是否允许收录。默认 false。
   * 本站几乎所有页面都在登录后，对爬虫没有内容，进索引只会稀释站点质量；
   * 公开入口（登录 / 注册）才显式传 true。
   */
  indexable?: boolean;
  /**
   * 页面专属分享图（站内相对路径）。
   * 不传则用 app.vue 里声明的站点兜底图——两者不要都设，
   * 同名 og:image 会被 unhead 合并，反而可能挤掉兜底图的尺寸标签。
   */
  image?: string;
}

export function usePageSeo(options: PageSeoOptions): void {
  const { title, description, indexable = false, image } = options;

  useSeoMeta({
    title,
    description,
    // noindex + nofollow 双保险：既不进索引，也不传递权重
    robots: indexable ? 'index, follow' : 'noindex, nofollow',
    ogTitle: title,
    ogDescription: description,
    ogType: 'website',
    // 仅在显式指定页面专属分享图时覆盖兜底图；未指定时传 undefined 会把兜底图清掉。
    ...(image ? { ogImage: useAbsoluteUrl(image) } : {}),
  });
}
