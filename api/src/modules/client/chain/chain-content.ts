/**
 * 接龙内容校验与匿名化名 —— 实现已迁移到 client/ugc-content.ts（投稿等其它 UGC 共用）。
 *
 * 这里保留原导出路径，既有调用方（chain.service / chain.spec）零改动。
 */
export {
  aliasOf,
  checkFreeText,
  validateEntry,
  type ContentCheck,
  type EntryLimits,
  type TextCheck,
} from '../ugc-content.js';
