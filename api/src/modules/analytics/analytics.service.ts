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

/** 天数归一（非法值回退，并夹到合理上限，避免全表扫描拖垮接口）。 */
function clampDays(days: number, fallback: number, max: number): number {
  return Number.isFinite(days) && days > 0 ? Math.min(Math.floor(days), max) : fallback;
}

/** 百分比保留一位小数。 */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** BigInt 主键集合 → 字符串集合（跨表求交集的统一口径）。 */
function toIdSet(rows: { userId: bigint }[]): Set<string> {
  return new Set(rows.map((row) => String(row.userId)));
}

/** 集合交集。 */
function intersect(a: Set<string>, b: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const value of a) {
    if (b.has(value)) {
      out.add(value);
    }
  }
  return out;
}

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

/** 漏斗阶段。 */
export interface FunnelStage {
  name: string;
  users: number;
  /** 相对上一阶段的转化率（百分比，一位小数）；首阶段恒 100 */
  rate: number;
}

/** 留存漏斗（窗口内注册用户的嵌套转化）。 */
export interface FunnelResult {
  /** 窗口内注册用户数 */
  registered: number;
  stages: FunnelStage[];
}

/** 队列留存行。 */
export interface RetentionRow {
  /** 队列日期（YYYY-MM-DD，即注册日） */
  date: string;
  /** 队列人数 */
  cohort: number;
  /** 当日留存率（百分比，一位小数；队列人数为 0 或该天尚未到期则为 null） */
  d0: number | null;
  /** 次日留存率 */
  d1: number | null;
  /** 3 日留存率 */
  d3: number | null;
  /** 7 日留存率 */
  d7: number | null;
}

/** 队列留存结果。 */
export interface RetentionResult {
  /** 按日期升序（最早 → 最新） */
  rows: RetentionRow[];
  /** 各周期平均值（只统计已到期且队列非空的日期；无数据为 null） */
  avg: { d0: number | null; d1: number | null; d3: number | null; d7: number | null };
}

/** 活跃趋势（新增 / 日活）。 */
export interface ActiveTrend {
  dates: string[];
  newUsers: number[];
  activeUsers: number[];
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

  /**
   * 留存漏斗：窗口内**注册**的用户逐级转化
   * （注册 → 激活「答过题」→ 完成打卡 → 领取句签），每一级都要求满足上一级（嵌套漏斗）。
   *
   * 为什么用 id 集合交集而不是 SQL join：client_user 与答题/打卡/句签**刻意不建 Prisma 关系**
   * （见 schema「答题记录/收藏/打卡不声明 Prisma 关系，一律按 userId 显式查询」），
   * 所以取 id 后在内存做集合运算最直观、也避免为统计改表。
   */
  async funnel(days = 30): Promise<FunnelResult> {
    const safeDays = clampDays(days, 30, 90);
    const since = dayjs()
      .subtract(safeDays - 1, 'day')
      .startOf('day')
      .toDate();
    const end = dayjs().endOf('day').toDate();

    const cohortRows = await this.prisma.clientUser.findMany({
      where: { createdAt: { gte: since, lte: end } },
      select: { id: true },
    });
    const registered = new Set(cohortRows.map((row) => String(row.id)));
    const ids = cohortRows.map((row) => row.id);

    const [answered, checkedIn, carded] =
      ids.length === 0
        ? [new Set<string>(), new Set<string>(), new Set<string>()]
        : await Promise.all([
            this.prisma.sentenceRecord
              .findMany({ where: { userId: { in: ids } }, distinct: ['userId'], select: { userId: true } })
              .then(toIdSet),
            this.prisma.userCheckin
              .findMany({ where: { userId: { in: ids } }, distinct: ['userId'], select: { userId: true } })
              .then(toIdSet),
            this.prisma.userSentenceCard
              .findMany({ where: { userId: { in: ids } }, distinct: ['userId'], select: { userId: true } })
              .then(toIdSet),
          ]);

    const activated = intersect(registered, answered);
    const checked = intersect(activated, checkedIn);
    const collected = intersect(checked, carded);

    const chain = [
      { name: '注册', users: registered.size },
      { name: '激活（答过题）', users: activated.size },
      { name: '完成打卡', users: checked.size },
      { name: '领取句签', users: collected.size },
    ];
    const stages: FunnelStage[] = chain.map((stage, index) => {
      const prev = index === 0 ? stage.users : chain[index - 1].users;
      return {
        name: stage.name,
        users: stage.users,
        rate: index === 0 ? 100 : prev > 0 ? round1((stage.users / prev) * 100) : 0,
      };
    });
    return { registered: registered.size, stages };
  }

  /**
   * 队列留存：按注册日分队列，统计各队列在 D0/D1/D3/D7 的活跃（有答题）比例。
   *
   * 只算「已到期」的周期（例如今天注册的队列没有 D1，则该格为 null，避免用 0 误导）。
   * 实现上把窗口内所有答题记录一次性查出、在内存按「日 → 用户集合」建索引，
   * 避免「队列数 × 周期数」次查询。
   */
  async retention(days = 14): Promise<RetentionResult> {
    const safeDays = clampDays(days, 14, 30);
    const offsets = [0, 1, 3, 7] as const;
    const today = dayjs().startOf('day');
    const since = today.subtract(safeDays - 1, 'day').toDate();

    const cohortRows = await this.prisma.clientUser.findMany({
      where: { createdAt: { gte: since, lte: dayjs().endOf('day').toDate() } },
      select: { id: true, createdAt: true },
    });
    const cohorts = new Map<string, Set<string>>();
    const allIds: bigint[] = [];
    for (const row of cohortRows) {
      const key = dayjs(row.createdAt).format('YYYY-MM-DD');
      const set = cohorts.get(key) ?? new Set<string>();
      set.add(String(row.id));
      cohorts.set(key, set);
      allIds.push(row.id);
    }

    const activeByDay = new Map<string, Set<string>>();
    if (allIds.length > 0) {
      const records = await this.prisma.sentenceRecord.findMany({
        where: { userId: { in: allIds } },
        select: { userId: true, createdAt: true },
      });
      for (const record of records) {
        const key = dayjs(record.createdAt).format('YYYY-MM-DD');
        const set = activeByDay.get(key) ?? new Set<string>();
        set.add(String(record.userId));
        activeByDay.set(key, set);
      }
    }

    const sums: Record<number, { total: number; count: number }> = {
      0: { total: 0, count: 0 },
      1: { total: 0, count: 0 },
      3: { total: 0, count: 0 },
      7: { total: 0, count: 0 },
    };
    const rows: RetentionRow[] = [];
    for (let i = safeDays - 1; i >= 0; i -= 1) {
      const cohortDay = today.subtract(i, 'day');
      const cohort = cohorts.get(cohortDay.format('YYYY-MM-DD')) ?? new Set<string>();
      const row: RetentionRow = {
        date: cohortDay.format('YYYY-MM-DD'),
        cohort: cohort.size,
        d0: null,
        d1: null,
        d3: null,
        d7: null,
      };
      for (const offset of offsets) {
        const target = cohortDay.add(offset, 'day');
        if (target.isAfter(today)) {
          continue;
        }
        const active = activeByDay.get(target.format('YYYY-MM-DD')) ?? new Set<string>();
        const rate = cohort.size > 0 ? round1((intersect(cohort, active).size / cohort.size) * 100) : null;
        if (offset === 0) row.d0 = rate;
        else if (offset === 1) row.d1 = rate;
        else if (offset === 3) row.d3 = rate;
        else row.d7 = rate;
        if (rate !== null) {
          sums[offset].total += rate;
          sums[offset].count += 1;
        }
      }
      rows.push(row);
    }
    const avgOf = (offset: number): number | null =>
      sums[offset].count > 0 ? round1(sums[offset].total / sums[offset].count) : null;
    return { rows, avg: { d0: avgOf(0), d1: avgOf(1), d3: avgOf(3), d7: avgOf(7) } };
  }

  /** 近 N 日新增用户 / 日活（DAU，按有答题计）趋势。 */
  async activeTrend(days = 14): Promise<ActiveTrend> {
    const safeDays = clampDays(days, 14, 30);
    const dates: string[] = [];
    const newUsers: number[] = [];
    const activeUsers: number[] = [];
    for (let i = safeDays - 1; i >= 0; i -= 1) {
      const start = dayjs().subtract(i, 'day').startOf('day').toDate();
      const end = dayjs().subtract(i, 'day').endOf('day').toDate();
      const [created, activeRows] = await Promise.all([
        this.prisma.clientUser.count({ where: { createdAt: { gte: start, lte: end } } }),
        this.prisma.sentenceRecord.findMany({
          where: { createdAt: { gte: start, lte: end } },
          distinct: ['userId'],
          select: { userId: true },
        }),
      ]);
      dates.push(dayjs().subtract(i, 'day').format('MM-DD'));
      newUsers.push(created);
      activeUsers.push(activeRows.length);
    }
    return { dates, newUsers, activeUsers };
  }
}
