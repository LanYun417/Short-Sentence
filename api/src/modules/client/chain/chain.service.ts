/**
 * 句子接龙（匿名共创）服务。
 *
 * 产品取向：**不做公开社交关系**——没有关注、没有评论、没有头像，
 * 只有「一句话接一句话」的文本本身。作者以按 userId 派生的稳定化名出现，
 * 身份不出服务端，规避了 UGC 常见的人身攻击与骚扰面。
 *
 * 内容安全三闸：
 * 1. 入库前字符/长度/链接校验（`validateEntry`，纯函数可单测）；
 * 2. 每人每天 3 条 + 同主题同内容去重（挡脚本刷屏）；
 * 3. 举报去重计数达阈值自动隐藏，后台可复核。
 */
import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../../common/exception/app.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { AgnesSentenceProvider, type ChainModerationResult } from '../../../common/ai/agnes-sentence.provider.js';
import { aliasOf, validateEntry } from './chain-content.js';

/** 每人每天最多提交条数。 */
export const CHAIN_DAILY_LIMIT = 3;
/** 举报达该条数自动隐藏（同一人只能举报一次，见唯一键）。 */
export const CHAIN_REPORT_HIDE_AT = 3;
/** 主题下最多展示的条目数。 */
const ENTRY_PAGE_SIZE = 50;
/** 单条列表查询窗口：24 小时。 */
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ChainTopicView {
  id: number;
  title: string;
  starterEn: string;
  promptZh: string;
  /** 来源：seed 手工种子 / ai 每周 AI 生成（前端据此标「本周新」） */
  source: string;
  /** 该主题下可见条目数 */
  entryCount: number;
  /** 我在该主题下提交过几条 */
  myEntryCount: number;
}

export interface ChainEntryView {
  id: number;
  /** 匿名化名（同一主题下同一个人恒定） */
  alias: string;
  contentEn: string;
  contentZh: string | null;
  likeCount: number;
  /** 我是否赞过 */
  liked: boolean;
  /** 是否我写的（用于前端提示，不暴露给他人） */
  mine: boolean;
  createdAt: string;
  /** 审核状态（仅提交响应返回：visible 已展示 / pending 待人工 / rejected 未通过） */
  status?: string;
  /** 审核备注（AI 理由，仅提交响应返回） */
  moderationNote?: string | null;
}

export interface ChainTopicDetail {
  topic: ChainTopicView;
  entries: ChainEntryView[];
  /** 今天还能提交几条（0 = 已用满，前端禁用输入框） */
  remainingToday: number;
  dailyLimit: number;
}

/** 后台维度条目。 */
export interface ChainEntryAdminItem {
  id: number;
  topicId: number;
  topicTitle: string;
  contentEn: string;
  contentZh: string | null;
  likeCount: number;
  reportCount: number;
  status: string;
  userId: number;
  createdAt: string;
}

/** Prisma 唯一键冲突。 */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

@Injectable()
export class ChainService {
  private readonly logger = new Logger(ChainService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moderator: AgnesSentenceProvider,
  ) {}

  /**
   * 主题列表：启用的主题，**本周 AI 新主题排在最前**（weekStart 倒序、seed 为 null 排最后），
   * 再按 sort 升序。附可见条目数与我的提交数。
   */
  async listTopics(userId: number): Promise<ChainTopicView[]> {
    const uid = BigInt(userId);
    const [topics, counts, mine] = await Promise.all([
      this.prisma.chainTopic.findMany({
        where: { status: 1 },
        // MySQL 里 NULL 在 DESC 下排最后：AI 主题(weekStart 非空)在前，手工种子(null)在后
        orderBy: [{ weekStart: 'desc' }, { sort: 'asc' }, { id: 'asc' }],
        select: { id: true, title: true, starterEn: true, promptZh: true, source: true },
      }),
      this.prisma.chainEntry.groupBy({
        by: ['topicId'],
        where: { status: 'visible' },
        _count: { _all: true },
      }),
      this.prisma.chainEntry.groupBy({
        by: ['topicId'],
        where: { userId: uid },
        _count: { _all: true },
      }),
    ]);

    const countByTopic = new Map(counts.map((row) => [String(row.topicId), row._count._all]));
    const mineByTopic = new Map(mine.map((row) => [String(row.topicId), row._count._all]));

    return topics.map((row) => ({
      id: Number(row.id),
      title: row.title,
      starterEn: row.starterEn,
      promptZh: row.promptZh,
      source: row.source,
      entryCount: countByTopic.get(String(row.id)) ?? 0,
      myEntryCount: mineByTopic.get(String(row.id)) ?? 0,
    }));
  }

  /* ------------------------------ AI 每周主题 ------------------------------ */

  /**
   * 每周 AI 生成一批新接龙主题（定时任务 `chain-topic-weekly` 调用，也可在后台手动触发）。
   *
   * 幂等：以「本周一日期」为键——本周已生成过（存在 source=ai 且 weekStart=本周一 的主题）就直接跳过，
   * 重复跑任务不会重复造数据。
   * 轮换：新批次入库前，把**上一周及以前的所有 AI 主题**置为停用（status=0），
   * 手工种子（source=seed）永不停用，作为常驻保底内容。
   */
  async generateWeeklyTopics(count: number): Promise<{ weekStart: string; created: number }> {
    const weekStart = this.mondayOf(new Date());
    const existing = await this.prisma.chainTopic.count({
      where: { source: 'ai', weekStart },
    });
    if (existing > 0) {
      this.logger.log(`[Chain] 本周(${weekStart})已有 ${existing} 条 AI 主题，跳过生成`);
      return { weekStart, created: 0 };
    }

    // 去重窗口：最近 40 条主题标题（AI + 种子混合），喂给模型避免撞车
    const recentRows = await this.prisma.chainTopic.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: { title: true, starterEn: true },
    });
    const recent = recentRows.flatMap((row) => [row.title, row.starterEn]);

    const drafts = await this.moderator.generateChainTopics(weekStart, recent, count);
    if (drafts.length === 0) {
      throw new AppException('AI 未返回可用主题');
    }

    // 新主题的 sort 接在现有最大 sort 之后，保证列表里排在种子之后、同周内按生成顺序
    const maxSort = await this.prisma.chainTopic.aggregate({ _max: { sort: true } });
    let nextSort = (maxSort._max.sort ?? 0) + 1;

    await this.prisma.$transaction(async (tx) => {
      // 停用上一周及以前的 AI 主题（本周还没有，所以等价于停用全部旧 AI 主题）
      await tx.chainTopic.updateMany({
        where: { source: 'ai', weekStart: { not: weekStart } },
        data: { status: 0 },
      });
      await tx.chainTopic.createMany({
        data: drafts.map((draft) => ({
          title: draft.title,
          starterEn: draft.starterEn,
          promptZh: draft.promptZh,
          status: 1,
          source: 'ai',
          weekStart,
          sort: nextSort++,
        })),
      });
    });
    this.logger.log(`[Chain] 本周(${weekStart})新生成 ${drafts.length} 条 AI 主题`);
    return { weekStart, created: drafts.length };
  }

  /** 本地时区下，date 所在周的周一 YYYY-MM-DD。 */
  private mondayOf(date: Date): string {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dow = d.getDay(); // 0=周日
    const diff = (dow + 6) % 7; // 距周一的天数
    d.setDate(d.getDate() - diff);
    return this.formatDate(d);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** 主题详情 + 可见条目（按赞数、时间排序）。 */
  async getTopic(userId: number, topicId: number): Promise<ChainTopicDetail> {
    const uid = BigInt(userId);
    const topic = await this.getEnabledTopic(topicId);

    const [entries, todayCount] = await Promise.all([
      this.prisma.chainEntry.findMany({
        where: { topicId: BigInt(topicId), status: 'visible' },
        orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }],
        take: ENTRY_PAGE_SIZE,
        select: {
          id: true,
          userId: true,
          contentEn: true,
          contentZh: true,
          likeCount: true,
          createdAt: true,
        },
      }),
      this.prisma.chainEntry.count({
        where: { userId: uid, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
      }),
    ]);

    const ids = entries.map((row) => row.id);
    const likes =
      ids.length > 0
        ? await this.prisma.chainEntryLike.findMany({
            where: { userId: uid, entryId: { in: ids } },
            select: { entryId: true },
          })
        : [];
    const likedSet = new Set(likes.map((row) => String(row.entryId)));

    return {
      topic: {
        id: Number(topic.id),
        title: topic.title,
        starterEn: topic.starterEn,
        promptZh: topic.promptZh,
        source: topic.source,
        entryCount: entries.length,
        myEntryCount: entries.filter((row) => String(row.userId) === String(uid)).length,
      },
      entries: entries.map((row) => ({
        id: Number(row.id),
        alias: aliasOf(Number(row.userId), topicId),
        contentEn: row.contentEn,
        contentZh: row.contentZh,
        likeCount: row.likeCount,
        liked: likedSet.has(String(row.id)),
        mine: String(row.userId) === String(uid),
        createdAt: row.createdAt.toISOString(),
      })),
      remainingToday: Math.max(0, CHAIN_DAILY_LIMIT - todayCount),
      dailyLimit: CHAIN_DAILY_LIMIT,
    };
  }

  /** 提交一条续写。 */
  async createEntry(
    userId: number,
    topicId: number,
    input: { contentEn: string; contentZh?: string | null },
  ): Promise<ChainEntryView> {
    const topic = await this.getEnabledTopic(topicId);
    const checked = validateEntry(input.contentEn, input.contentZh);
    if (!checked.ok) {
      throw AppException.badRequest(checked.message ?? '内容不符合要求');
    }

    const uid = BigInt(userId);
    const recent = await this.prisma.chainEntry.count({
      where: { userId: uid, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
    });
    if (recent >= CHAIN_DAILY_LIMIT) {
      throw AppException.badRequest(`每天最多接 ${CHAIN_DAILY_LIMIT} 句，明天再来吧`);
    }

    const duplicated = await this.prisma.chainEntry.findFirst({
      where: { userId: uid, topicId: BigInt(topicId), contentEn: checked.contentEn },
      select: { id: true },
    });
    if (duplicated) {
      throw AppException.badRequest('这句你已经写过了，换一句吧');
    }

    // 入库前过一遍 AI 审核：通过→visible，拒绝→rejected，拿不准 / 调用失败→pending 转人工。
    // 审核失败不阻塞提交：先把用户写的内容存下来交运营兜底，不因 AI 抖动就丢掉。
    const moderation = await this.moderate(topic.title, topic.starterEn, checked);
    const status =
      moderation.decision === 'approve' ? 'visible' : moderation.decision === 'reject' ? 'rejected' : 'pending';

    const row = await this.prisma.chainEntry.create({
      data: {
        topicId: BigInt(topicId),
        userId: uid,
        contentEn: checked.contentEn,
        contentZh: checked.contentZh.length > 0 ? checked.contentZh : null,
        status,
        moderationNote: moderation.reason || null,
      },
      select: { id: true, contentEn: true, contentZh: true, likeCount: true, createdAt: true },
    });

    this.logger.log(
      `接龙提交 topic=${topicId} user=${userId} entry=${row.id} status=${status}（${moderation.reason}）「${topic.title}」`,
    );
    return {
      id: Number(row.id),
      alias: aliasOf(userId, topicId),
      contentEn: row.contentEn,
      contentZh: row.contentZh,
      likeCount: row.likeCount,
      liked: false,
      mine: true,
      createdAt: row.createdAt.toISOString(),
      status,
      moderationNote: moderation.reason || null,
    };
  }

  /**
   * 接龙 AI 审核（失败兜底为转人工）。
   * 审核是入库前的必要一步，但它的失败不该让整次提交失败——内容先存下来，
   * 由运营在后台复核；AI 挂了不代表用户写的东西该丢。
   */
  private async moderate(
    topicTitle: string,
    starterEn: string,
    checked: { contentEn: string; contentZh: string },
  ): Promise<ChainModerationResult> {
    try {
      return await this.moderator.moderateChainEntry({
        topicTitle,
        starterEn,
        contentEn: checked.contentEn,
        contentZh: checked.contentZh || null,
      });
    } catch (error) {
      this.logger.warn(`接龙 AI 审核失败，转人工：${error instanceof Error ? error.message : String(error)}`);
      return { decision: 'review', reason: 'AI 审核不可用，转人工' };
    }
  }

  /** 点赞 / 取消点赞（幂等：重复点等于取消）。 */
  async toggleLike(userId: number, entryId: number): Promise<{ liked: boolean; likeCount: number }> {
    const uid = BigInt(userId);
    const entry = await this.getVisibleEntry(entryId);

    try {
      await this.prisma.chainEntryLike.create({ data: { entryId: BigInt(entryId), userId: uid } });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // 已经赞过 → 取消
      await this.prisma.chainEntryLike.delete({
        where: { entryId_userId: { entryId: BigInt(entryId), userId: uid } },
      });
      const updated = await this.prisma.chainEntry.update({
        where: { id: BigInt(entryId) },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });
      return { liked: false, likeCount: Math.max(0, updated.likeCount) };
    }

    const updated = await this.prisma.chainEntry.update({
      where: { id: BigInt(entryId) },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });
    void entry;
    return { liked: true, likeCount: updated.likeCount };
  }

  /**
   * 举报一条接龙。一人一条只能报一次；达阈值自动隐藏。
   * @returns reportCount 当前举报数 / hidden 是否已隐藏
   */
  async report(userId: number, entryId: number, reason: string): Promise<{ reportCount: number; hidden: boolean }> {
    await this.getVisibleEntry(entryId);

    try {
      await this.prisma.chainEntryReport.create({
        data: { entryId: BigInt(entryId), userId: BigInt(userId), reason: reason.slice(0, 20) },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw AppException.badRequest('你已经举报过这一条了');
      }
      throw error;
    }

    const updated = await this.prisma.chainEntry.update({
      where: { id: BigInt(entryId) },
      data: { reportCount: { increment: 1 } },
      select: { reportCount: true, status: true },
    });

    if (updated.status === 'visible' && updated.reportCount >= CHAIN_REPORT_HIDE_AT) {
      await this.prisma.chainEntry.update({
        where: { id: BigInt(entryId) },
        data: { status: 'hidden' },
      });
      this.logger.warn(`接龙条目被举报隐藏 entry=${entryId} reports=${updated.reportCount}`);
      return { reportCount: updated.reportCount, hidden: true };
    }
    return { reportCount: updated.reportCount, hidden: false };
  }

  /* ------------------------------ 后台 ------------------------------ */

  /** 后台分页列表（可按状态 / 关键词 / 主题筛选）。 */
  async adminList(query: Record<string, unknown>): Promise<{ list: ChainEntryAdminItem[]; total: number }> {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20) || 20));
    const keyword = typeof query.keyword === 'string' ? query.keyword.trim() : '';
    const status = typeof query.status === 'string' && query.status ? query.status : undefined;
    const topicId = Number(query.topicId ?? 0) || 0;

    const where = {
      ...(status ? { status } : {}),
      ...(topicId > 0 ? { topicId: BigInt(topicId) } : {}),
      ...(keyword ? { contentEn: { contains: keyword } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.chainEntry.findMany({
        where,
        orderBy: [{ reportCount: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          topicId: true,
          userId: true,
          contentEn: true,
          contentZh: true,
          likeCount: true,
          reportCount: true,
          status: true,
          moderationNote: true,
          createdAt: true,
          topic: { select: { title: true } },
        },
      }),
      this.prisma.chainEntry.count({ where }),
    ]);

    return {
      list: rows.map((row) => ({
        id: Number(row.id),
        topicId: Number(row.topicId),
        topicTitle: row.topic.title,
        contentEn: row.contentEn,
        contentZh: row.contentZh,
        likeCount: row.likeCount,
        reportCount: row.reportCount,
        status: row.status,
        moderationNote: row.moderationNote,
        userId: Number(row.userId),
        createdAt: row.createdAt.toISOString(),
      })),
      total,
    };
  }

  /** 后台设置条目状态（visible 通过 / rejected 拒绝 / hidden 隐藏）。 */
  async adminSetStatus(entryId: number, status: 'visible' | 'hidden' | 'rejected'): Promise<void> {
    const exists = await this.prisma.chainEntry.findUnique({
      where: { id: BigInt(entryId) },
      select: { id: true },
    });
    if (!exists) throw AppException.notFound('条目不存在');
    await this.prisma.chainEntry.update({ where: { id: BigInt(entryId) }, data: { status } });
  }

  /** 后台删除条目（物理删除，级联清点赞与举报记录）。 */
  async adminRemove(entryId: number): Promise<void> {
    const exists = await this.prisma.chainEntry.findUnique({
      where: { id: BigInt(entryId) },
      select: { id: true },
    });
    if (!exists) throw AppException.notFound('条目不存在');
    await this.prisma.chainEntry.delete({ where: { id: BigInt(entryId) } });
  }

  /** 主题下拉选项（后台筛选用）。 */
  async adminTopics(): Promise<Array<{ id: number; title: string }>> {
    const rows = await this.prisma.chainTopic.findMany({
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      select: { id: true, title: true },
    });
    return rows.map((row) => ({ id: Number(row.id), title: row.title }));
  }

  /* ------------------------------ 内部 ------------------------------ */

  private async getEnabledTopic(topicId: number) {
    const topic = await this.prisma.chainTopic.findUnique({
      where: { id: BigInt(topicId) },
      select: { id: true, title: true, starterEn: true, promptZh: true, status: true, source: true },
    });
    if (!topic || topic.status !== 1) {
      throw AppException.notFound('接龙主题不存在或已下线');
    }
    return topic;
  }

  private async getVisibleEntry(entryId: number) {
    const entry = await this.prisma.chainEntry.findUnique({
      where: { id: BigInt(entryId) },
      select: { id: true, status: true, likeCount: true },
    });
    if (!entry || entry.status !== 'visible') {
      throw AppException.notFound('这条接龙不存在');
    }
    return entry;
  }
}
