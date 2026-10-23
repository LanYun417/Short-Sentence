/**
 * 数据分析控制器（/api/analytics）。
 * 权限口径：RBAC 权限码 analytics:view。
 */
import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import type { PageResult } from '../../common/types.js';
import {
  AnalyticsService,
  type AiCallLogItem,
  type AiCallStat,
  type AnalyticsOverview,
  type AnswerTrend,
  type CategoryStat,
  type CheckinStat,
  type NameValue,
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

  /** 打卡统计。 */
  @Get('checkin')
  @RequirePermissions('analytics:view')
  checkin(): Promise<CheckinStat> {
    return this.analytics.checkinStats();
  }
}
