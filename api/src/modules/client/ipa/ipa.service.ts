/**
 * 音标学习服务（客户端）。
 *
 * 模块职责：
 * - 音标库只读分发（`ipa_phoneme`，种子写入的静态参考数据）；
 * - 学习进度（`ipa_learning_record`）：「学会了」标记；
 * - 「学会了」发奖（**服务端权威**）：每音标只发一次 XP（event_key 带 symbol、无日期 → 永久幂等）。
 *
 * 设计口径（与 Web / App 双端同源同契约）：判分与发奖只在服务端，客户端只上报
 * 真实操作（标记学会了），服务端决定是否发 XP，客户端不直接说"我学会了"。
 */
import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import type { Prisma } from '../../../generated/prisma/client.js';
import { AppException } from '../../../common/exception/app.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { GamifyService, XP_RULES } from '../gamify/gamify.service.js';
import { IPA_PHONEME_SEEDS } from './ipa-seeds.js';
import type { IpaLearnedDto, UpdateIpaPhonemeDto } from './dto.js';

/** 音标分组（顺序即学习顺序）。 */
export type IpaPhonemeType = 'vowel' | 'diphthong' | 'consonant_voiceless' | 'consonant_voiced';

/** 分组展示信息（两端共用同一套标题/描述）。 */
export const IPA_GROUPS: Array<{ type: IpaPhonemeType; title: string; hint: string }> = [
  { type: 'vowel', title: '单元音', hint: '12 个：发音时口型不变的元音' },
  { type: 'diphthong', title: '双元音', hint: '8 个：由一个元音滑向另一个元音' },
  { type: 'consonant_voiceless', title: '清辅音', hint: '11 个：声带不振动，送气' },
  { type: 'consonant_voiced', title: '浊辅音', hint: '17 个：声带振动，摸喉咙有震感' },
];

/** 一个音标（对外视图）。 */
export interface IpaPhonemeView {
  /** 音标符号（不含斜线） */
  symbol: string;
  type: IpaPhonemeType;
  /** 示例词 */
  exampleWords: string[];
  /** 中文发音要点 */
  tips: string;
  /** 组内排序 */
  sort: number;
}

/** 我的某个音标进度。 */
export interface IpaProgressItem {
  symbol: string;
  /** 已标记学会 */
  learned: boolean;
}

/** 后台-音标条目（带学会人数）。 */
export interface IpaPhonemeAdminItem {
  id: number;
  symbol: string;
  type: string;
  exampleWords: string[];
  tips: string;
  sort: number;
  /** 学会该音标的用户数 */
  learnedCount: number;
  createdAt: Date;
}

/** 后台-学习统计总览。 */
export interface IpaAdminStats {
  totalPhonemes: number;
  /** 累计「学会了」标记数 */
  totalLearned: number;
  /** 学习用户数（去重） */
  learnerCount: number;
  /** 今日学会标记数 */
  todayLearned: number;
  /** 近 7 天趋势（按服务器本地日） */
  trend: Array<{ date: string; count: number }>;
  /** 学会人数最多的音标 Top5 */
  top: Array<{ symbol: string; count: number }>;
}

/** 后台-学习记录审计条目。 */
export interface IpaLearningRecordAdminItem {
  id: number;
  userId: number;
  email: string;
  nickname: string;
  symbol: string;
  learnedAt: Date;
}

@Injectable()
export class IpaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamify: GamifyService,
  ) {}

  /** 音标库（按类型分组、组内排序）。 */
  async listPhonemes(): Promise<{
    groups: Array<{ type: IpaPhonemeType; title: string; hint: string; items: IpaPhonemeView[] }>;
    total: number;
  }> {
    const rows = await this.prisma.ipaPhoneme.findMany({ orderBy: [{ type: 'asc' }, { sort: 'asc' }] });
    const items: IpaPhonemeView[] = rows.map((row) => ({
      symbol: row.symbol,
      type: row.type as IpaPhonemeType,
      exampleWords: parseWords(row.exampleWords),
      tips: row.tips,
      sort: row.sort,
    }));
    return {
      groups: IPA_GROUPS.map((group) => ({
        ...group,
        items: items.filter((item) => item.type === group.type),
      })).filter((group) => group.items.length > 0),
      total: items.length,
    };
  }

  /** 我的进度（已学会数 + 每个音标的学会标记）。 */
  async progress(userId: number): Promise<{ learnedCount: number; total: number; items: IpaProgressItem[] }> {
    const [records, total] = await Promise.all([
      this.prisma.ipaLearningRecord.findMany({
        where: { userId: BigInt(userId) },
        include: { phoneme: { select: { symbol: true } } },
      }),
      this.prisma.ipaPhoneme.count(),
    ]);
    return {
      learnedCount: records.filter((r) => r.learnedAt !== null).length,
      total,
      items: records.map((r) => ({
        symbol: r.phoneme.symbol,
        learned: r.learnedAt !== null,
      })),
    };
  }

  /**
   * 标记音标「学会了」（每音标只发一次 XP）。
   * @returns 是否首次学会 + 当前已学会总数
   */
  async markLearned(
    userId: number,
    dto: IpaLearnedDto,
  ): Promise<{ symbol: string; firstTime: boolean; xpAwarded: boolean; learnedCount: number }> {
    const phoneme = await this.findPhoneme(dto.symbol);
    const existing = await this.prisma.ipaLearningRecord.findUnique({
      where: { userId_phonemeId: { userId: BigInt(userId), phonemeId: phoneme.id } },
      select: { learnedAt: true },
    });
    const firstTime = !existing?.learnedAt;
    if (firstTime) {
      await this.prisma.ipaLearningRecord.upsert({
        where: { userId_phonemeId: { userId: BigInt(userId), phonemeId: phoneme.id } },
        create: { userId: BigInt(userId), phonemeId: phoneme.id, learnedAt: new Date() },
        update: { learnedAt: new Date() },
      });
    }
    const xpAwarded = firstTime
      ? await this.gamify.awardXp(
          userId,
          'ipa_learned',
          `ipa-learned:${userId}:${phoneme.symbol}`,
          XP_RULES.ipa_learned,
          `音标学会：${phoneme.symbol}`,
        )
      : false;
    const learnedCount = await this.prisma.ipaLearningRecord.count({
      where: { userId: BigInt(userId), learnedAt: { not: null } },
    });
    return { symbol: phoneme.symbol, firstTime, xpAwarded, learnedCount };
  }

  /** 按 symbol 查音标（不存在 → 404，防止客户端编 symbol 发奖）。 */
  private async findPhoneme(symbol: string): Promise<{ id: bigint; symbol: string }> {
    const normalized = symbol.trim().replace(/^\/+|\/+$/g, '');
    const phoneme = await this.prisma.ipaPhoneme.findUnique({
      where: { symbol: normalized },
      select: { id: true, symbol: true },
    });
    if (!phoneme) {
      throw AppException.notFound('音标不存在');
    }
    return phoneme;
  }

  /* ------------------------------ 后台管理 ------------------------------ */

  /**
   * 后台：音标分页列表（带学会人数）。
   * 音标库是 48 条静态参考数据：后台只开放内容字段编辑，不开放增删。
   */
  async adminListPhonemes(query: {
    keyword?: string;
    type?: string;
    page: number;
    pageSize: number;
  }): Promise<{ list: IpaPhonemeAdminItem[]; total: number }> {
    const where: Prisma.IpaPhonemeWhereInput = {};
    if (query.type) {
      where.type = query.type;
    }
    const keyword = query.keyword?.trim();
    if (keyword) {
      where.OR = [
        { symbol: { contains: keyword } },
        { exampleWords: { contains: keyword } },
        { tips: { contains: keyword } },
      ];
    }
    const [total, rows] = await Promise.all([
      this.prisma.ipaPhoneme.count({ where }),
      this.prisma.ipaPhoneme.findMany({
        where,
        orderBy: [{ type: 'asc' }, { sort: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    const counts = await this.prisma.ipaLearningRecord.groupBy({
      by: ['phonemeId'],
      where: { learnedAt: { not: null } },
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((c) => [String(c.phonemeId), c._count._all]));
    const list: IpaPhonemeAdminItem[] = rows.map((row) => ({
      id: Number(row.id),
      symbol: row.symbol,
      type: row.type,
      exampleWords: parseWords(row.exampleWords),
      tips: row.tips,
      sort: row.sort,
      learnedCount: countMap.get(String(row.id)) ?? 0,
      createdAt: row.createdAt,
    }));
    return { list, total };
  }

  /**
   * 后台：更新音标内容字段（type / exampleWords / tips / sort）。
   * symbol 不可改：它是 XP 幂等 event_key 的一部分，改动会导致已学用户重复发奖。
   */
  async adminUpdatePhoneme(id: number, dto: UpdateIpaPhonemeDto): Promise<void> {
    const existing = await this.prisma.ipaPhoneme.findUnique({
      where: { id: BigInt(id) },
      select: { id: true },
    });
    if (!existing) {
      throw AppException.notFound('音标不存在');
    }
    const data: Prisma.IpaPhonemeUpdateInput = {};
    if (dto.type !== undefined) {
      data.type = dto.type;
    }
    if (dto.exampleWords !== undefined) {
      data.exampleWords = JSON.stringify(dto.exampleWords);
    }
    if (dto.tips !== undefined) {
      data.tips = dto.tips;
    }
    if (dto.sort !== undefined) {
      data.sort = dto.sort;
    }
    await this.prisma.ipaPhoneme.update({ where: { id: BigInt(id) }, data });
  }

  /** 后台：按内置种子重置全部音标内容（upsert by symbol；会覆盖手动修改）。 */
  async adminResetSeeds(): Promise<{ updated: number }> {
    for (const [index, seed] of IPA_PHONEME_SEEDS.entries()) {
      await this.prisma.ipaPhoneme.upsert({
        where: { symbol: seed.symbol },
        create: {
          symbol: seed.symbol,
          type: seed.type,
          exampleWords: JSON.stringify(seed.exampleWords),
          tips: seed.tips,
          sort: index,
        },
        update: {
          type: seed.type,
          exampleWords: JSON.stringify(seed.exampleWords),
          tips: seed.tips,
          sort: index,
        },
      });
    }
    return { updated: IPA_PHONEME_SEEDS.length };
  }

  /** 后台：学习统计总览（ totals + 近 7 天趋势 + 学会人数 Top5）。 */
  async adminStats(): Promise<IpaAdminStats> {
    const now = dayjs();
    const todayStart = now.startOf('day').toDate();
    const [totalPhonemes, totalLearned, learnerGroups, todayLearned] = await Promise.all([
      this.prisma.ipaPhoneme.count(),
      this.prisma.ipaLearningRecord.count({ where: { learnedAt: { not: null } } }),
      this.prisma.ipaLearningRecord.groupBy({
        by: ['userId'],
        where: { learnedAt: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.ipaLearningRecord.count({ where: { learnedAt: { gte: todayStart } } }),
    ]);
    // 近 7 天趋势：按服务器本地日切分（与 analytics 口径一致）
    const trend: Array<{ date: string; count: number }> = [];
    for (let i = 6; i >= 0; i -= 1) {
      const start = now.subtract(i, 'day').startOf('day').toDate();
      const end = now.subtract(i, 'day').endOf('day').toDate();
      const count = await this.prisma.ipaLearningRecord.count({
        where: { learnedAt: { gte: start, lte: end } },
      });
      trend.push({ date: now.subtract(i, 'day').format('MM-DD'), count });
    }
    // 学会人数最多的音标 Top5
    const topGroups = await this.prisma.ipaLearningRecord.groupBy({
      by: ['phonemeId'],
      where: { learnedAt: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { phonemeId: 'desc' } },
      take: 5,
    });
    const phonemes = await this.prisma.ipaPhoneme.findMany({
      where: { id: { in: topGroups.map((g) => g.phonemeId) } },
      select: { id: true, symbol: true },
    });
    const symbolMap = new Map(phonemes.map((p) => [String(p.id), p.symbol]));
    const top = topGroups.map((g) => ({
      symbol: symbolMap.get(String(g.phonemeId)) ?? '?',
      count: g._count._all,
    }));
    return {
      totalPhonemes,
      totalLearned,
      learnerCount: learnerGroups.length,
      todayLearned,
      trend,
      top,
    };
  }

  /** 后台：学习记录分页审计（关键字可匹配音标符号/示例词 或 用户邮箱/昵称）。 */
  async adminRecords(query: {
    keyword?: string;
    page: number;
    pageSize: number;
  }): Promise<{ list: IpaLearningRecordAdminItem[]; total: number }> {
    const where: Prisma.IpaLearningRecordWhereInput = { learnedAt: { not: null } };
    const keyword = query.keyword?.trim();
    if (keyword) {
      const [phonemes, users] = await Promise.all([
        this.prisma.ipaPhoneme.findMany({
          where: { OR: [{ symbol: { contains: keyword } }, { exampleWords: { contains: keyword } }] },
          select: { id: true },
        }),
        this.prisma.clientUser.findMany({
          where: { OR: [{ email: { contains: keyword } }, { nickname: { contains: keyword } }] },
          select: { id: true },
        }),
      ]);
      const phonemeIds = phonemes.map((p) => p.id);
      const userIds = users.map((u) => u.id);
      if (!phonemeIds.length && !userIds.length) {
        return { list: [], total: 0 };
      }
      where.OR = [
        ...(phonemeIds.length ? [{ phonemeId: { in: phonemeIds } }] : []),
        ...(userIds.length ? [{ userId: { in: userIds } }] : []),
      ];
    }
    const [total, rows] = await Promise.all([
      this.prisma.ipaLearningRecord.count({ where }),
      this.prisma.ipaLearningRecord.findMany({
        where,
        orderBy: { learnedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { phoneme: { select: { symbol: true } } },
      }),
    ]);
    const users = await this.prisma.clientUser.findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: { id: true, email: true, nickname: true },
    });
    const userMap = new Map(users.map((u) => [String(u.id), u]));
    const list: IpaLearningRecordAdminItem[] = rows.map((r) => {
      const u = userMap.get(String(r.userId));
      return {
        id: Number(r.id),
        userId: Number(r.userId),
        email: u?.email ?? '',
        nickname: u?.nickname ?? '',
        symbol: r.phoneme.symbol,
        learnedAt: r.learnedAt ?? r.createdAt,
      };
    });
    return { list, total };
  }
}

/** 示例词 JSON → 数组（脏数据容错：非字符串项丢弃）。 */
function parseWords(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((w): w is string => typeof w === 'string' && w.length > 0) : [];
  } catch {
    return [];
  }
}
