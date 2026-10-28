/**
 * AI 每日预算的纯计算逻辑（不依赖 Nest / DB，便于单测）。
 * 服务层（ai-budget.service.ts）负责取用量与缓存，判定规则集中在这里。
 */

/** 今日 AI 用量。 */
export interface AiBudgetUsage {
  /** 成功调用次数 */
  calls: number;
  /** token 合计（输入 + 输出） */
  tokens: number;
}

/** 预算状态（给闸门与运营看板用）。 */
export interface AiBudgetStatus {
  /** 今日已用调用次数 */
  calls: number;
  /** 今日已用 token */
  tokens: number;
  /** 每日调用次数上限（0 = 不限） */
  callBudget: number;
  /** 每日 token 上限（0 = 不限） */
  tokenBudget: number;
  /** 是否已达上限（任一维度满足） */
  overBudget: boolean;
  /** 剩余可用调用次数（null = 不限） */
  remainingCalls: number | null;
  /** 剩余可用 token（null = 不限） */
  remainingTokens: number | null;
}

/**
 * 判定是否超预算并计算剩余。
 *
 * 用 `>=`：预算 N 表示「允许 N 次调用」。用量是**调用前**统计的（只含已落库的成功调用），
 * 所以当已用量达到 N 时，下一次（第 N+1 次）即被拦下——恰好放行 N 次。
 * 维度为 0 视为「不限制」，两个维度都 0 即永不超限。
 */
export function evaluateBudget(usage: AiBudgetUsage, callBudget: number, tokenBudget: number): AiBudgetStatus {
  const overCalls = callBudget > 0 && usage.calls >= callBudget;
  const overTokens = tokenBudget > 0 && usage.tokens >= tokenBudget;
  return {
    calls: usage.calls,
    tokens: usage.tokens,
    callBudget,
    tokenBudget,
    overBudget: overCalls || overTokens,
    remainingCalls: callBudget > 0 ? Math.max(0, callBudget - usage.calls) : null,
    remainingTokens: tokenBudget > 0 ? Math.max(0, tokenBudget - usage.tokens) : null,
  };
}

/** 预算状态 → 人话摘要（闸门报错与日志共用）。 */
export function budgetSummary(status: AiBudgetStatus): string {
  const parts: string[] = [];
  if (status.callBudget > 0) {
    parts.push(`调用 ${status.calls}/${status.callBudget} 次`);
  }
  if (status.tokenBudget > 0) {
    parts.push(`token ${status.tokens}/${status.tokenBudget}`);
  }
  return parts.length > 0 ? parts.join('，') : '未配置预算';
}
