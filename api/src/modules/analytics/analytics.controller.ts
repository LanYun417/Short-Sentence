/**
 * 数据分析控制器（/api/analytics）。
 * 权限口径：RBAC 权限码 analytics:view。
 */
import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import type { PageResult } from '../../common/types.js';
import {
  AnalyticsService,
  type ActiveTrend,
  type AiCallLogItem,
  type AiCallLogSummary,
  type AiCallStat,
  type AnalyticsOverview,
  type AnswerTrend,
  type CategoryStat,
  type CheckinStat,
  type FunnelResult,
  type NameValue,
  type RetentionResult,
} from './analytics.service.js';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** 总览指标。 */
  @Get('overview')
  @RequirePermissions('analytics:view')
  overview(): Promise<AnalyticsOverview> {
    return this.analytics.overview();
  }

  /** 近 N 日答题趋势。 */
  @Get('answer-trend')
  @RequirePermissions('analytics:view')
  answerTrend(@Query('days') days?: string): Promise<AnswerTrend> {
    return this.analytics.answerTrend(Number(days ?? 7));
  }

  /** 题目难度分布。 */
  @Get('difficulty')
  @RequirePermissions('analytics:view')
  difficulty(): Promise<NameValue[]> {
    return this.analytics.difficultyDistribution();
  }

  /** 分类运营数据。 */
  @Get('category')
  @RequirePermissions('analytics:view')
  category(): Promise<CategoryStat[]> {
    return this.analytics.categoryStats();
  }

  /** 近 N 日 AI 调用统计。 */
  @Get('ai-calls')
  @RequirePermissions('analytics:view')
  aiCalls(@Query('days') days?: string): Promise<AiCallStat[]> {
    return this.analytics.aiCallStats(Number(days ?? 7));
  }

  /** AI 调用日志（分页）。 */
  @Get('ai-logs')
  @RequirePermissions('analytics:view')
  aiLogs(@Query() query: Record<string, unknown>): Promise<PageResult<AiCallLogItem>> {
    return this.analytics.aiLogs(query);
  }

  /**
   * AI 调用日志汇总（与列表同一套筛选）。
   * ⚠️ 必须声明在 `ai-logs` 之前不影响（两者都无参数段），但**必须在任何 `:param` 路由之前**。
   */
  @Get('ai-logs/summary')
  @RequirePermissions('analytics:view')
  aiLogSummary(@Query() query: Record<string, unknown>): Promise<AiCallLogSummary> {
    return this.analytics.aiLogSummary(query);
  }

  /** 打卡统计。 */
  @Get('checkin')
  @RequirePermissions('analytics:view')
  checkin(): Promise<CheckinStat> {
    return this.analytics.checkinStats();
  }

  /** 留存漏斗（窗口内注册用户：注册 → 激活 → 打卡 → 领句签）。 */
  @Get('funnel')
  @RequirePermissions('analytics:view')
  funnel(@Query('days') days?: string): Promise<FunnelResult> {
    return this.analytics.funnel(Number(days ?? 30));
  }

  /** 队列留存（按注册日的 D0/D1/D3/D7）。 */
  @Get('retention')
  @RequirePermissions('analytics:view')
  retention(@Query('days') days?: string): Promise<RetentionResult> {
    return this.analytics.retention(Number(days ?? 14));
  }

  /** 新增 / 日活趋势。 */
  @Get('active-trend')
  @RequirePermissions('analytics:view')
  activeTrend(@Query('days') days?: string): Promise<ActiveTrend> {
    return this.analytics.activeTrend(Number(days ?? 14));
  }
}
