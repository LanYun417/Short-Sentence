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
import { AppException } from '../../../common/exception/app.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { GamifyService, XP_RULES } from '../gamify/gamify.service.js';
import type { IpaLearnedDto } from './dto.js';

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
