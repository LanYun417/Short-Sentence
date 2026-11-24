/**
 * 全局 AI 每日预算服务（成本闸门）。
 *
 * 为什么需要：客户端已有「每人每日 10 次」的额度（AiQuotaService），但**没有全局上限**——
 * 一旦被多账号刷、或批量生题/生图失控，成本没有天花板。本服务给出一个跨所有调用方的日预算，
 * 任一维度（调用次数 / token）达上限即闸断，所有 AI 调用入口抛**不可重试**错误。
 *
 * 口径与降级：
 * - 按 ai_call_log **当日成功调用**聚合（失败调用不计入消费，与「上游失败退额度」一致）；
 * - 预算是配置项，0 = 不限制（默认）；两个维度都 0 时**连查询都不做**；
 * - 查询结果带 5s 缓存：高频调用不必每次都打 ai_call_log（也顺带兜住统计口径抖动）；
 * - 读取失败（DB 抖动）按**放行**处理并记日志——成本闸门不该把正常业务整挂。
 */
import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { config } from '../config/config.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AiProviderError } from './ai.types.js';
import { budgetSummary, evaluateBudget, type AiBudgetStatus, type AiBudgetUsage } from './ai-budget.util.js';

export type { AiBudgetStatus, AiBudgetUsage } from './ai-budget.util.js';

/** 用量缓存时长（毫秒）。 */
const CACHE_MS = 5000;

@Injectable()
export class AiBudgetService {
  private readonly logger = new Logger(AiBudgetService.name);
  /** 用量缓存（进程内；5s 内复用，避免高频查询）。 */
  private cache: { at: number; status: AiBudgetStatus } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** 今日预算状态（带 5s 缓存；未配置预算时直接返回「不限」）。 */
  async status(): Promise<AiBudgetStatus> {
    const callBudget = config.ai.dailyCallBudget;
    const tokenBudget = config.ai.dailyTokenBudget;
    if (callBudget <= 0 && tokenBudget <= 0) {
      return evaluateBudget({ calls: 0, tokens: 0 }, 0, 0);
    }
    const now = Date.now();
    if (this.cache && now - this.cache.at < CACHE_MS) {
      return this.cache.status;
    }
    const status = evaluateBudget(await this.usageToday(), callBudget, tokenBudget);
    this.cache = { at: now, status };
    return status;
  }

  /** 是否已达每日上限。 */
  async isOverBudget(): Promise<boolean> {
    return (await this.status()).overBudget;
  }

  /**
   * 闸门：已达上限则抛**不可重试**错误（调用方的 withRetry 不该重试）。
   * 文案带当前用量，便于运营直接判断是哪个维度打满。
   */
  async assertWithinBudget(): Promise<void> {
    const status = await this.status();
    if (!status.overBudget) {
      return;
    }
    throw new AiProviderError(`已达每日 AI 预算上限（${budgetSummary(status)}），今日暂停 AI 调用，明天 0 点恢复`, {
      retryable: false,
    });
  }

  /** 今日已消费（成功调用次数 + token）；读取失败按 0（放行）。 */
  private async usageToday(): Promise<AiBudgetUsage> {
    const start = dayjs().startOf('day').toDate();
    const end = dayjs().endOf('day').toDate();
    try {
      const agg = await this.prisma.aiCallLog.aggregate({
        where: { status: 'success', createdAt: { gte: start, lte: end } },
        _count: { _all: true },
        _sum: { promptTokens: true, completionTokens: true },
      });
      return {
        calls: agg._count._all ?? 0,
        tokens: (agg._sum.promptTokens ?? 0) + (agg._sum.completionTokens ?? 0),
      };
    } catch (error) {
      this.logger.warn(
        `[AiBudget] 读取今日用量失败，本次按未超限处理: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { calls: 0, tokens: 0 };
    }
  }
}
