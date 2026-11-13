/**
 * 音标学习服务（客户端）。
 *
 * 模块职责：
 * - 音标库只读分发（`ipa_phoneme`，种子写入的静态参考数据）；
 * - 学习进度（`ipa_learning_record`）：「学会了」标记 + 测验对错计数；
 * - 测验判分与发奖（**服务端权威**）：客户端只上报真实选择（题干 + 选了什么），
 *   服务端按音标库的示例词关系判对错、发 XP、记错题。
 *
 * 防刷口径：
 * - 「学会了」每个音标只发一次 XP（event_key 带 symbol、无日期 → 永久幂等）；
 * - 测验答题按「音标 + 日期」发 XP（同一音标同一天反复答对只发一次），
 *   再叠加 gamify 的每日总量上限，双闸门。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/exception/app.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { GamifyService, XP_RULES } from '../gamify/gamify.service.js';
import type { IpaLearnedDto, IpaQuizSubmitDto } from './dto.js';

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
  quizCorrect: number;
  quizWrong: number;
}

/** 测验判分结果（错题也返回，供前端出「错题回顾」）。 */
export interface IpaQuizResult {
  /** 答对数 */
  correctCount: number;
  /** 总题数 */
  total: number;
  /** 本次实发 XP */
  xpAwarded: number;
  /** 错题（题干 + 正确答案） */
  wrong: Array<{ type: string; prompt: string; correct: string }>;
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

  /** 我的进度（已学会数 + 每个音标的测验统计）。 */
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
        quizCorrect: r.quizCorrect,
        quizWrong: r.quizWrong,
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

  /**
   * 提交一整套测验答案：服务端判分、发奖、记错题。
   *
   * 判分方向由题型决定：
   * - `word_to_phoneme`：题干是单词、答案是音标 —— 正确 ⟺ 该单词在此音标的示例词里；
   * - `phoneme_to_word`：题干是音标、答案是单词 —— 正确 ⟺ 该单词在此音标的示例词里。
   * 两个方向共用同一份示例词关系，故都不需要额外存「标准答案表」。
   */
  async submitQuiz(userId: number, dto: IpaQuizSubmitDto): Promise<IpaQuizResult> {
    if (dto.answers.length === 0) {
      throw AppException.badRequest('答案不能为空');
    }
    const phonemes = await this.prisma.ipaPhoneme.findMany();
    const bySymbol = new Map(phonemes.map((p) => [p.symbol, p]));

    let correctCount = 0;
    let xpAwarded = 0;
    const wrong: IpaQuizResult['wrong'] = [];

    for (const item of dto.answers) {
      const prompt = item.prompt.trim();
      const answer = item.answer.trim();
      if (!prompt || !answer) continue;
      // 两个题型最终都归结为「这个单词是不是这个音标的示例词」：按题型取音标侧与单词侧
      const symbol = item.type === 'word_to_phoneme' ? answer : prompt;
      const word = item.type === 'word_to_phoneme' ? prompt : answer;
      const phoneme = bySymbol.get(symbol);
      const isCorrect = Boolean(phoneme) && parseWords(phoneme!.exampleWords).includes(word.toLowerCase());

      if (isCorrect) {
        correctCount += 1;
      } else {
        wrong.push({
          type: item.type,
          prompt,
          correct: phoneme
            ? item.type === 'word_to_phoneme'
              ? phoneme.symbol
              : (parseWords(phoneme.exampleWords)[0] ?? '')
            : '',
        });
      }
      // 进步统计：以「被考查的音标」为记录对象（两种题型下它都是 symbol 那一侧）
      await this.recordAnswer(userId, phoneme?.id, isCorrect);
      if (isCorrect && phoneme) {
        const awarded = await this.gamify.awardXp(
          userId,
          'ipa_quiz_correct',
          `ipa-quiz:${userId}:${phoneme.symbol}:${todayKey()}`,
          XP_RULES.ipa_quiz_correct,
        );
        if (awarded) xpAwarded += XP_RULES.ipa_quiz_correct;
      }
    }

    return { correctCount, total: dto.answers.length, xpAwarded, wrong };
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

  /** 记录某音标的测验对错（错题本依据；phonemeId 为空说明题干/答案不在库中，跳过）。 */
  private async recordAnswer(userId: number, phonemeId: bigint | undefined, correct: boolean): Promise<void> {
    if (!phonemeId) return;
    const existing = await this.prisma.ipaLearningRecord.findUnique({
      where: { userId_phonemeId: { userId: BigInt(userId), phonemeId } },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.ipaLearningRecord.update({
        where: { id: existing.id },
        data: correct ? { quizCorrect: { increment: 1 } } : { quizWrong: { increment: 1 } },
      });
    } else {
      await this.prisma.ipaLearningRecord.create({
        data: { userId: BigInt(userId), phonemeId, quizCorrect: correct ? 1 : 0, quizWrong: correct ? 0 : 1 },
      });
    }
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

/** 上海时区当天（YYYY-MM-DD）：与 gamify 的日切口径一致，作为幂等键的一部分。 */
function todayKey(): string {
  const shanghaiNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const year = shanghaiNow.getUTCFullYear();
  const month = String(shanghaiNow.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shanghaiNow.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
