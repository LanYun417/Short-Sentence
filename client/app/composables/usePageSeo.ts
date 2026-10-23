/**
 * 页面级 SEO（标题 / 描述 / 分享卡片 / 收录策略）。
 *
 * 为什么封装而不是每页手写 useSeoMeta：
 * 1. 字段成套出现（title / description / og / twitter），逐页手写必漏；
 * 2. 「私有页必须 noindex」是硬性要求——做成**默认值**比每页记得传更可靠，
 *    公开页显式 `indexable: true` 才放开，属于「安全默认」设计。
 */
interface PageSeoOptions {
  /** 页面短标题（品牌后缀由 nuxt.config 的 titleTemplate 统一拼接） */
  title: string;
  /** 页面描述（meta description 与 og/twitter description 共用） */
  description: string;
  /**
   * 是否允许收录。默认 false。
   * 本站几乎所有页面都在登录后，对爬虫没有内容，进索引只会稀释站点质量；
   * 公开入口（登录 / 注册）才显式传 true。
   */
  indexable?: boolean;
  /** 分享图（不传则用站点兜底图 og-image.png） */
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
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    // 仅在显式传入时覆盖兜底分享图（传 undefined 会把 app.head 的默认值清掉）
    ...(image ? { ogImage: image, twitterImage: image } : {}),
  });
}
