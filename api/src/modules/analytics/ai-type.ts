/**
 * AI 调用类型（ai_call_log.type）的展示名与旧命名别名。
 *
 * 为什么单独抽一个模块：类型字面量散落在 Provider 里，而「展示成中文」与
 * 「按类型筛选」两处都要用到它。集中在这里以后，新增类型只要改一张表，
 * 后台卡片、报表、筛选就不会各自漏一条。
 *
 * 旧的 `collectible_gen` 是 2026-10-23「藏品」更名为「句签」之前写进库里的
 * 历史值（改名当时留下的少数记录），业务上等同于 `sentence_card_gen`。
 * 这里把它当别名而不是另立一个类型：展示上并入「句签」，筛选时一并匹配，
 * 否则运营会看到两张都叫「句签」的卡片、或者按句签筛选却查不到旧记录。
 */

/** 调用类型 → 中文展示名。 */
export const AI_TYPE_LABELS: Record<string, string> = {
  sentence_gen: '生题',
  sentence_polish: '优化',
  sentence_review: '审核',
  sentence_card_gen: '句签',
  image_gen: '生图',
  expand: '造句',
  word_root: '词根',
  /** 旧命名：2026-10-23 改名前「藏品生成」，并入「句签」 */
  collectible_gen: '句签',
};

/**
 * 现行类型 → 历史上等价的其他取值（查询时一并匹配）。
 * 只收录**语义相同、仅改过名**的值，不做任何业务上的合并。
 */
export const AI_TYPE_ALIASES: Record<string, readonly string[]> = {
  sentence_card_gen: ['collectible_gen'],
};

/**
 * 取展示名。未登记的新类型原样返回——宁可露出英文，也不要悄悄显示成
 * 「未知」，否则新接入的 Provider 会一直没人发现。
 */
export function aiTypeLabel(type: string): string {
  return AI_TYPE_LABELS[type] ?? type;
}

/**
 * 按类型筛选时实际要匹配的取值集合（含旧命名）。
 * 老数据只有 6 条，但漏掉就等于「筛选结果对不上总数」，运营会怀疑数据丢了。
 */
export function aiTypeFilterValues(type: string): string[] {
  return [type, ...(AI_TYPE_ALIASES[type] ?? [])];
}
