import { describe, expect, it } from 'vitest';
import { budgetSummary, evaluateBudget } from '../src/common/ai/ai-budget.util.js';

/**
 * AI 每日预算判定（纯函数）。
 *
 * 这是成本闸门的核心规则，钉死边界行为：
 * ① 未配置（0）即不限；② 「恰好 N 次」要放行、第 N+1 次才拦；
 * ③ 任一维度打满即整体超限，另一维度剩余照常可读。
 */
describe('evaluateBudget', () => {
  it('两个维度都为 0 时视为不限，永不超限', () => {
    const status = evaluateBudget({ calls: 100_000, tokens: 10 ** 9 }, 0, 0);
    expect(status.overBudget).toBe(false);
    expect(status.remainingCalls).toBeNull();
    expect(status.remainingTokens).toBeNull();
  });

  it('调用次数达到上限即超限（恰好放行 N 次）', () => {
    expect(evaluateBudget({ calls: 9, tokens: 0 }, 10, 0).overBudget).toBe(false);
    const hit = evaluateBudget({ calls: 10, tokens: 0 }, 10, 0);
    expect(hit.overBudget).toBe(true);
    expect(hit.remainingCalls).toBe(0);
  });

  it('token 达到上限即超限', () => {
    expect(evaluateBudget({ calls: 0, tokens: 99_999 }, 0, 100_000).overBudget).toBe(false);
    expect(evaluateBudget({ calls: 0, tokens: 100_000 }, 0, 100_000).overBudget).toBe(true);
  });

  it('任一维度超限即整体超限，另一维度剩余照常计算', () => {
    const status = evaluateBudget({ calls: 10, tokens: 5 }, 10, 1_000);
    expect(status.overBudget).toBe(true);
    expect(status.remainingCalls).toBe(0);
    expect(status.remainingTokens).toBe(995);
  });

  it('budgetSummary 只列已配置的维度', () => {
    expect(budgetSummary(evaluateBudget({ calls: 3, tokens: 5 }, 10, 0))).toBe('调用 3/10 次');
    expect(budgetSummary(evaluateBudget({ calls: 3, tokens: 5 }, 10, 100))).toBe('调用 3/10 次，token 5/100');
    expect(budgetSummary(evaluateBudget({ calls: 0, tokens: 0 }, 0, 0))).toBe('未配置预算');
  });
});
