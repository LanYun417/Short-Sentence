import { describe, expect, it } from 'vitest';
import { AI_TYPE_LABELS, aiTypeFilterValues, aiTypeLabel } from '../src/modules/analytics/ai-type.js';

/**
 * AI 调用类型的展示名与旧命名别名。
 *
 * 背景：库里的 `collectible_gen` 是「藏品 → 句签」改名前的历史值（2026-10-23
 * 之前写入），后台卡片一度因为缺 key 直接显示英文。这里把口径钉死：
 * ① 所有登记类型都必须有中文名；② 旧命名必须与现行「句签」同名同桶；
 * ③ 筛选必须能带出旧命名的记录；④ 未登记的新类型要原样露出，方便发现。
 */
describe('aiTypeLabel', () => {
  it('所有登记的类型都有中文展示名', () => {
    for (const [type, label] of Object.entries(AI_TYPE_LABELS)) {
      expect(label, `类型 ${type} 缺少中文名`).not.toBe(type);
      expect(label).toMatch(/[\u4e00-\u9fa5]/);
    }
  });

  it('旧命名 collectible_gen 与 sentence_card_gen 同名（合并成一张卡片）', () => {
    expect(aiTypeLabel('collectible_gen')).toBe('句签');
    expect(aiTypeLabel('collectible_gen')).toBe(aiTypeLabel('sentence_card_gen'));
  });

  it('未登记的新类型原样返回，不吞成「未知」', () => {
    expect(aiTypeLabel('brand_new_type')).toBe('brand_new_type');
  });
});

describe('aiTypeFilterValues', () => {
  it('句签筛选同时带出改名前的旧值', () => {
    expect(aiTypeFilterValues('sentence_card_gen')).toEqual(['sentence_card_gen', 'collectible_gen']);
  });

  it('没有别名的类型只匹配自身', () => {
    expect(aiTypeFilterValues('image_gen')).toEqual(['image_gen']);
  });

  it('直接用旧值筛选时也只查旧值（运营点的是哪个就查哪个）', () => {
    expect(aiTypeFilterValues('collectible_gen')).toEqual(['collectible_gen']);
  });
});
