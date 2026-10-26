/**
 * 数据分析服务（「短句」运营后台）。
 * 模块职责：题库 / 用户 / 答题 / 词根 / AI 调用 / 打卡的运营指标聚合。
 *
 * 口径说明：
 * - 「今天」「近 N 日」一律按**服务器本地日**切分（dayjs startOf/endOf），
 *   与打卡、日志归档的既有口径保持一致；
 * - 趋势类查询按天逐个 count（而非 raw SQL 分组），避免时区换算在 SQL 里二次出错。
 */
import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { PrismaService } from '../../prisma/prisma.service.js';
import { buildPageResult, parsePagination } from '../../common/utils/utils.js';
import type { PageResult } from '../../common/types.js';
import { aiTypeFilterValues, aiTypeLabel } from './ai-type.js';

/** 名称-数值对（ECharts 友好）。 */
export interface NameValue {
  name: string;
  value: number;
}

/** 总览指标。 */
export interface AnalyticsOverview {
  /** 题库总量 */
  sentenceTotal: number;
  /** 就绪 */
  sentenceReady: number;
  /** 待生图 */
  sentencePending: number;
  /** 已下架 */
  sentenceOffline: number;
  /** 客户端用户总数 */
  userTotal: number;
  /** 今日新增用户 */
  userToday: number;
  /** 今日活跃用户（有答题） */
  activeToday: number;
  /** 今日答题数 */
  answerToday: number;
  /** 今日答对数 */
  correctToday: number;
  /** 词根词条数 */
  wordRootTotal: number;
  /** 今日 AI 调用次数 */
  aiCallToday: number;
  /** 今日打卡人数 */
  checkinToday: number;
  /** 今日句签领取张数 */
  cardToday: number;
  /** 累计句签张数 */
  cardTotal: number;
  /** 今日 AI token 合计（输入+输出） */
  aiTokenToday: number;
}

/** 答题趋势。 */
export interface AnswerTrend {
  dates: string[];
  answers: number[];
  corrects: number[];
}

/** 分类运营数据。 */
export interface CategoryStat {
  name: string;
  sentenceCount: number;
  answerCount: number;
  correctCount: number;
}

/** AI 调用统计。 */
export interface AiCallStat {
  name: string;
  calls: number;
  failed: number;
  promptTokens: number;
  completionTokens: number;
}

/** AI 调用日志项。 */
export interface AiCallLogItem {
  id: number;
  type: string;
  provider: string;
  model: string;
  bizId: number;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
}

/** AI 调用日志汇总项（与列表同一套筛选条件）。 */
export interface AiCallLogSummary {
  /** 调用总次数 */
  calls: number;
  /** 失败次数 */
  failed: number;
  /** 失败率（百分比，一位小数） */
  failRate: number;
  /** 输入 token 合计 */
  promptTokens: number;
  /** 输出 token 合计 */
  completionTokens: number;
  /** token 总计 */
  totalTokens: number;
  /** 平均耗时（毫秒） */
  avgLatencyMs: number;
}

/** 打卡统计。 */
export interface CheckinStat {
  /** 今日打卡人数 */
  todayUsers: number;
  /** 今日平均连续天数 */
  avgStreak: number;
  /** 今日最长连续天数 */
  maxStreak: number;
  /** 累计打卡人次 */
  totalCheckins: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 总览卡片。 */
  async overview(): Promise<AnalyticsOverview> {
    const startOfToday = dayjs().startOf('day').toDate();
    const endOfToday = dayjs().endOf('day').toDate();

    const [
      sentenceTotal,
      sentenceReady,
      sentencePending,
      sentenceOffline,
      userTotal,
      userToday,
      activeRows,
      answerToday,
      correctToday,
      wordRootTotal,
      aiCallToday,
      checkinToday,
      cardToday,
      cardTotal,
      aiTokenRows,
    ] = await Promise.all([
      this.prisma.sentence.count(),
      this.prisma.sentence.count({ where: { status: 'ready' } }),
      this.prisma.sentence.count({ where: { status: 'pending_image' } }),
      this.prisma.sentence.count({ where: { status: 'offline' } }),
      this.prisma.clientUser.count(),
      this.prisma.clientUser.count({ where: { createdAt: { gte: startOfToday, lte: endOfToday } } }),
      this.prisma.sentenceRecord.findMany({
        where: { createdAt: { gte: startOfToday, lte: endOfToday } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      this.prisma.sentenceRecord.count({ where: { createdAt: { gte: startOfToday, lte: endOfToday } } }),
      this.prisma.sentenceRecord.count({
        where: { createdAt: { gte: startOfToday, lte: endOfToday }, isCorrect: 1 },
      }),
      this.prisma.wordRoot.count(),
      this.prisma.aiCallLog.count({ where: { createdAt: { gte: startOfToday, lte: endOfToday } } }),
      this.prisma.userCheckin.count({ where: { checkinDate: dayjs().format('YYYY-MM-DD') } }),
      this.prisma.userSentenceCard.count({ where: { obtainedAt: { gte: startOfToday, lte: endOfToday } } }),
      this.prisma.userSentenceCard.count(),
      this.prisma.aiCallLog.findMany({
        where: { createdAt: { gte: startOfToday, lte: endOfToday } },
        select: { promptTokens: true, completionTokens: true },
      }),
    ]);

    return {
      sentenceTotal,
      sentenceReady,
      sentencePending,
      sentenceOffline,
      userTotal,
      userToday,
      activeToday: activeRows.length,
      answerToday,
      correctToday,
      wordRootTotal,
      aiCallToday,
      checkinToday,
      cardToday,
      cardTotal,
      aiTokenToday: aiTokenRows.reduce((sum, row) => sum + row.promptTokens + row.completionTokens, 0),
    };
  }

  /** 近 N 日答题趋势（默认 7，最大 30）。 */
  async answerTrend(days = 7): Promise<AnswerTrend> {
    const safeDays = Number.isFinite(days) && days > 0 ? Math.min(Math.floor(days), 30) : 7;
    const dates: string[] = [];
    const answers: number[] = [];
    const corrects: number[] = [];

    for (let i = safeDays - 1; i >= 0; i -= 1) {
      const start = dayjs().subtract(i, 'day').startOf('day').toDate();
      const end = dayjs().subtract(i, 'day').endOf('day').toDate();
      const [total, correct] = await Promise.all([
        this.prisma.sentenceRecord.count({ where: { createdAt: { gte: start, lte: end } } }),
        this.prisma.sentenceRecord.count({ where: { createdAt: { gte: start, lte: end }, isCorrect: 1 } }),
      ]);
      dates.push(dayjs().subtract(i, 'day').format('MM-DD'));
      answers.push(total);
      corrects.push(correct);
    }
    return { dates, answers, corrects };
  }

  /** 题目难度分布。 */
  async difficultyDistribution(): Promise<NameValue[]> {
    const rows = await this.prisma.sentence.groupBy({
      by: ['difficulty'],
      where: { status: { in: ['ready', 'pending_image'] } },
      _count: { _all: true },
    });
    const labels: Record<number, string> = { 1: '基础', 2: '进阶', 3: '挑战' };
    return rows
      .map((row) => ({ name: labels[row.difficulty] ?? `难度 ${row.difficulty}`, value: row._count._all }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** 分类运营数据（题目数 / 答题数 / 答对数）。 */
  async categoryStats(): Promise<CategoryStat[]> {
    const categories = await this.prisma.sentenceCategory.findMany({
      orderBy: { sort: 'asc' },
      select: { id: true, name: true },
    });
    const result: CategoryStat[] = [];
    for (const category of categories) {
      const [sentenceCount, answerCount, correctCount] = await Promise.all([
        this.prisma.sentence.count({ where: { categoryId: category.id } }),
        this.prisma.sentenceRecord.count({ where: { sentence: { categoryId: category.id } } }),
        this.prisma.sentenceRecord.count({ where: { sentence: { categoryId: category.id }, isCorrect: 1 } }),
      ]);
      result.push({ name: category.name, sentenceCount, answerCount, correctCount });
    }
    return result;
  }

  /** 近 N 日 AI 调用统计（按类型聚合）。 */
  async aiCallStats(days = 7): Promise<AiCallStat[]> {
    const safeDays = Number.isFinite(days) && days > 0 ? Math.min(Math.floor(days), 30) : 7;
    const since = dayjs()
      .subtract(safeDays - 1, 'day')
      .startOf('day')
      .toDate();
    const rows = await this.prisma.aiCallLog.groupBy({
      by: ['type', 'status'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { promptTokens: true, completionTokens: true },
    });

    const map = new Map<string, AiCallStat>();
    for (const row of rows) {
      // 旧命名会归到同一个展示名下（两行同 name 自然在下面累加合并）
      const name = aiTypeLabel(row.type);
      const stat = map.get(name) ?? { name, calls: 0, failed: 0, promptTokens: 0, completionTokens: 0 };
      stat.calls += row._count._all;
      if (row.status !== 'success') {
        stat.failed += row._count._all;
      }
      stat.promptTokens += row._sum.promptTokens ?? 0;
      stat.completionTokens += row._sum.completionTokens ?? 0;
      map.set(name, stat);
    }
    return [...map.values()].sort((a, b) => b.calls - a.calls);
  }

  /** AI 调用日志（分页，可按类型/状态筛选）。 */
  /** AI 调用日志（分页）。 */
  async aiLogs(query: Record<string, unknown>): Promise<PageResult<AiCallLogItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where = this.aiLogWhere(query);
    const [rows, total] = await Promise.all([
      this.prisma.aiCallLog.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.aiCallLog.count({ where }),
    ]);
    const list: AiCallLogItem[] = rows.map((row) => ({
      id: Number(row.id),
      type: row.type,
      provider: row.provider,
      model: row.model,
      bizId: Number(row.bizId),
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      latencyMs: row.latencyMs,
      status: row.status,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
    }));
    return buildPageResult(list, total, page, pageSize);
  }

  /**
   * AI 调用日志汇总（与列表**同一套筛选**，运营查看当前范围的总量 / 失败率 / token）。
   * 按 userId 筛就是「这个用户今天/本周用了多少 AI」——与客户端每日额度配套。
   */
  async aiLogSummary(query: Record<string, unknown>): Promise<AiCallLogSummary> {
    const where = this.aiLogWhere(query);
    const [agg, failed] = await Promise.all([
      this.prisma.aiCallLog.aggregate({
        where,
        _count: { _all: true },
        _avg: { latencyMs: true },
        _sum: { promptTokens: true, completionTokens: true },
      }),
      this.prisma.aiCallLog.count({ where: { ...where, status: 'failed' } }),
    ]);
    const calls = agg._count._all ?? 0;
    return {
      calls,
      failed,
      failRate: calls > 0 ? Math.round((failed / calls) * 1000) / 10 : 0,
      promptTokens: agg._sum.promptTokens ?? 0,
      completionTokens: agg._sum.completionTokens ?? 0,
      totalTokens: (agg._sum.promptTokens ?? 0) + (agg._sum.completionTokens ?? 0),
      avgLatencyMs: Math.round(agg._avg.latencyMs ?? 0),
    };
  }

  /** 列表与汇总共用的筛选（类型 / 状态 / 关联 id / 日期区间）。 */
  private aiLogWhere(query: Record<string, unknown>): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    const type = String(query.type ?? '').trim();
    if (type) {
      // 改过名的类型（如 collectible_gen → sentence_card_gen）一并匹配，
      // 否则「按句签筛选」会漏掉改名前的历史记录。
      const values = aiTypeFilterValues(type);
      where.type = values.length > 1 ? { in: values } : type;
    }
    const status = String(query.status ?? '').trim();
    if (status) {
      where.status = status;
    }
    // 关联 id：expand / word_root 是 userId，sentence_* 是批次 id，image_gen 恒 0
    const bizId = Number(query.bizId ?? 0);
    if (Number.isFinite(bizId) && bizId > 0) {
      where.bizId = BigInt(Math.floor(bizId));
    }
    // 日期区间（YYYY-MM-DD，闭区间；只传一端也生效）
    const dateStart = String(query.dateStart ?? '').trim();
    const dateEnd = String(query.dateEnd ?? '').trim();
    const range: Record<string, Date> = {};
    if (dateStart) {
      const from = new Date(`${dateStart}T00:00:00`);
      if (!Number.isNaN(from.getTime())) {
        range.gte = from;
      }
    }
    if (dateEnd) {
      const to = new Date(`${dateEnd}T23:59:59`);
      if (!Number.isNaN(to.getTime())) {
        range.lte = to;
      }
    }
    if (Object.keys(range).length > 0) {
      where.createdAt = range;
    }
    return where;
  }

  /** 打卡统计。 */
  async checkinStats(): Promise<CheckinStat> {
    const date = dayjs().format('YYYY-MM-DD');
    const [rows, totalCheckins] = await Promise.all([
      this.prisma.userCheckin.findMany({
        where: { checkinDate: date },
        select: { streak: true },
      }),
      this.prisma.userCheckin.count(),
    ]);
    const streaks = rows.map((row) => row.streak);
    const sum = streaks.reduce((acc, value) => acc + value, 0);
    return {
      todayUsers: rows.length,
      avgStreak: rows.length > 0 ? Math.round((sum / rows.length) * 10) / 10 : 0,
      maxStreak: streaks.length > 0 ? Math.max(...streaks) : 0,
      totalCheckins,
    };
  }
}
