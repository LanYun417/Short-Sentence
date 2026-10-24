/**
 * 刷题服务（客户端）。
 * 模块职责：8:2 混题抽题（新题 + 到期复习）、答案比对与记录、间隔重复排期、
 * 收藏开关、收藏夹与复习池列表。
 *
 * 设计要点：
 * - **答案不下发**：`next` 的响应不含 sentenceEn/ipa，翻转后才能通过 `answer` 拿到；
 * - **比对在后端**：规范化（小写/去首尾标点/压缩空白）后全等才算对，前端只做同口径预校验；
 * - **复习池不另建表**：由 sentence_record（isCorrect=0 且 nextReviewAt<=now）派生；
 * - **间隔重复**：答对 level+1（1/3/7/15/30 天），答错回落到「明天」。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/exception/app.exception.js';
import { config } from '../../../common/config/config.js';
import { FileService } from '../../../common/file/file.service.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { buildPageResult, parsePagination } from '../../../common/utils/utils.js';
import type { PageResult } from '../../../common/types.js';
import { CheckinService } from '../checkin/checkin.service.js';
import { GamifyService, XP_RULES } from '../gamify/gamify.service.js';
import { AnswerSentenceDto, type AnswerMode } from './dto.js';

/**
 * 间隔重复梯度（天）：下标 = reviewLevel。
 * 下标 0（答错/未掌握）**不再走天数梯度**——答错立即到期（见 answer()）；
 * 保留占位只是为了避免下标偏移，其值无实际意义。
 */
const REVIEW_INTERVAL_DAYS = [1, 3, 7, 15, 30];

/** 复习池候选批大小（在此范围内随机取，兼顾「到期优先」与「不总是同一题」）。 */
const REVIEW_POOL_BATCH = 50;

/** 下一张卡（不含答案字段）。 */
export interface NextQuestion {
  sentenceId: number;
  /** 中文题干 */
  translationZh: string;
  /** 场景图 URL（16:9） */
  imageUrl: string | null;
  categoryName: string | null;
  difficulty: number;
  /** 今日已完成题数 */
  todayDone: number;
  /** 今日目标题数 */
  todayGoal: number;
  /** 本题来源：new 新题 / review 复习题 */
  source: 'new' | 'review';
  /**
   * 拼词模式的候选词块（打乱后的英文单词，含原标点）。
   * 仅 `mode=assemble` 时下发；输入模式恒为 null —— 否则等于把答案提前给了用户。
   */
  words: string[] | null;
}

/** 提交答案结果（含正确答案，用于翻转面）。 */
export interface AnswerResult {
  sentenceId: number;
  isCorrect: boolean;
  sentenceEn: string;
  /** 其他可接受的等价表达（输入模式用：写出任一条即算对；不含 sentenceEn 本身） */
  validAnswers: string[];
  translationZh: string;
  ipa: string | null;
  imageUrl: string | null;
  /** 当前是否已收藏 */
  favorited: boolean;
  todayDone: number;
  todayGoal: number;
}

/** 收藏夹条目。 */
export interface SentenceLibraryItem {
  sentenceId: number;
  sentenceEn: string;
  translationZh: string;
  ipa: string | null;
  imageUrl: string | null;
  categoryName: string | null;
  difficulty: number;
  /** 收藏时间（收藏夹）/ 最近作答时间（复习池） */
  createdAt: Date;
  /** 复习池专用：连续答对等级 */
  reviewLevel?: number;
  /** 复习池专用：下次复习时间 */
  nextReviewAt: Date | null;
}

/**
 * 答案规范化：小写、去首尾标点、压缩连续空白。
 * 前后端共用同一口径（前端 utils/answer-normalize 是同实现），任何一侧单独放宽都会造成「前端对、后端错」。
 */
export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * 解析备用答案（Sentence.alternateAnswers 的 JSON 字符串）。
 * 容错：非 JSON / 非法结构 / 空值一律回退空数组（等同于「只有主句一个答案」）。
 * 去重与截断口径与生题侧一致，避免脏数据影响判定。
 */
export function parseAlternateAnswers(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of parsed) {
      if (typeof item !== 'string') {
        continue;
      }
      const text = item.trim();
      const key = normalizeAnswer(text);
      if (!text || !key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push(text.slice(0, 300));
      if (out.length >= 5) {
        break;
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * 把英文句子拆成词块并打乱（拼词模式用）。
 *
 * 按空白拆词，**词块保留原标点**（`I'm`、`minutes?`）——拼回去与原句逐字一致，
 * 因此答案比对口径不必为拼词模式做任何放宽（仍然只认全等）。
 *
 * 打乱用 Fisher–Yates；若结果恰好与原文同序（两三个词的短句很容易出现），
 * 整体左移一位——否则等于把答案原样摆在用户面前。
 */
export function shuffleWords(sentenceEn: string): string[] {
  const words = sentenceEn.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return words;
  }
  const original = words.slice();
  for (let i = words.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  if (words.every((word, index) => word === original[index])) {
    const first = words.shift();
    if (first !== undefined) {
      words.push(first);
    }
  }
  return words;
}

/**
 * 作答模式 → XP 事件类型。
 * 拼词模式的选项就在眼前，识别难度低于默写，因此经验按约六成发放（数值见 XP_RULES）。
 * 客户端只上报「用了哪种模式」，经验值恒由服务端决定。
 */
const XP_EVENT: Record<
  AnswerMode,
  { first: keyof typeof XP_RULES; review: keyof typeof XP_RULES; wrong: keyof typeof XP_RULES }
> = {
  input: {
    first: 'answer_correct_first',
    review: 'answer_correct_review',
    wrong: 'answer_wrong',
  },
  assemble: {
    first: 'answer_correct_first_assemble',
    review: 'answer_correct_review_assemble',
    wrong: 'answer_wrong_assemble',
  },
};

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
    private readonly checkinService: CheckinService,
    private readonly gamify: GamifyService,
  ) {}

  /**
   * 抽下一张卡：按 newRatio 概率取新题，否则取到期复习题；
   * 一侧无候选时回落到另一侧；最近 N 次答过的题（防重窗口）两侧都不出。
   *
   * @param difficulty 目标难度（1 易 / 2 中 / 3 难），仅作用于**新题**——
   *   复习题必须按间隔重复排期走，按难度过滤会打乱复习节奏。该难度无可用新题时回落到不限难度。
   * @param mode 作答模式；`assemble` 时下发打乱词块，其余情况不下发（输入模式拿不到答案）。
   */
  async next(userId: number, difficulty?: number, mode?: AnswerMode): Promise<NextQuestion> {
    const recentIds = await this.recentSentenceIds(userId, config.sentence.antiRepeatWindow);
    const wantNew = Math.random() < config.sentence.newRatio;

    let sentenceId: number | null;
    let source: 'new' | 'review';
    if (wantNew) {
      sentenceId = await this.pickReadySentence(recentIds, difficulty);
      source = 'new';
      // 指定难度下没有可用新题：回落到不限难度，避免用户被卡住
      if (sentenceId === null && difficulty) {
        sentenceId = await this.pickReadySentence(recentIds);
      }
      if (sentenceId === null) {
        sentenceId = await this.pickDueReviewSentence(userId, recentIds);
        source = 'review';
      }
    } else {
      sentenceId = await this.pickDueReviewSentence(userId, recentIds);
      source = 'review';
      if (sentenceId === null) {
        sentenceId = await this.pickReadySentence(recentIds, difficulty);
        source = 'new';
        if (sentenceId === null && difficulty) {
          sentenceId = await this.pickReadySentence(recentIds);
        }
      }
    }
    if (sentenceId === null) {
      throw AppException.notFound('暂无可用题目，休息一下 or 等待每日更新');
    }

    const sentence = await this.prisma.sentence.findUnique({
      where: { id: BigInt(sentenceId) },
      select: {
        id: true,
        sentenceEn: true,
        translationZh: true,
        imageFileId: true,
        difficulty: true,
        category: { select: { name: true } },
      },
    });
    if (!sentence) {
      throw AppException.notFound('题目不存在');
    }

    const today = await this.checkinService.getToday(userId);
    return {
      sentenceId: Number(sentence.id),
      translationZh: sentence.translationZh,
      imageUrl: sentence.imageFileId > 0n ? await this.resolveImageUrl(Number(sentence.imageFileId)) : null,
      categoryName: sentence.category?.name ?? null,
      difficulty: sentence.difficulty,
      todayDone: today?.doneCount ?? 0,
      todayGoal: config.sentence.dailyGoal,
      source,
      words: mode === 'assemble' ? shuffleWords(sentence.sentenceEn) : null,
    };
  }

  /**
   * 提交答案：比对 → 记录 → 排期 → 累积打卡。
   */
  async answer(userId: number, sentenceId: number, dto: AnswerSentenceDto): Promise<AnswerResult> {
    const sentence = await this.prisma.sentence.findFirst({
      where: { id: BigInt(sentenceId), status: 'ready' },
      select: {
        id: true,
        sentenceEn: true,
        alternateAnswers: true,
        translationZh: true,
        ipa: true,
        imageFileId: true,
      },
    });
    if (!sentence) {
      throw AppException.notFound('题目不存在或未就绪');
    }

    const trimmed = dto.userAnswer.trim();
    // 输入模式不唯一答案：命中「主句 或 任一备用表达」即算对（规范化后全等，与单答案同口径）。
    // 拼词模式词块恒由主句拆分而来，实际只会命中主句，但走同一条判定链路，不特例分支。
    const validAnswers = parseAlternateAnswers(sentence.alternateAnswers).filter(
      (item) => normalizeAnswer(item) !== normalizeAnswer(sentence.sentenceEn),
    );
    const isCorrect =
      trimmed.length > 0 &&
      [sentence.sentenceEn, ...validAnswers].some(
        (candidate) => normalizeAnswer(trimmed) === normalizeAnswer(candidate),
      );

    // 间隔重复：同题取最近一次的等级递进
    const last = await this.prisma.sentenceRecord.findFirst({
      where: { userId: BigInt(userId), sentenceId: sentence.id },
      orderBy: { createdAt: 'desc' },
      select: { reviewLevel: true },
    });
    const level = isCorrect ? Math.min((last?.reviewLevel ?? 0) + 1, REVIEW_INTERVAL_DAYS.length - 1) : 0;
    // 答错：**立即到期**——当天就在错题库与练习流中复现（此前答错也走 +1 天，
    // 导致用户刚答错时错题库恒为空，看起来像数据坏了）。
    // 练习流不会因此连续追问同一题：next() 有防重窗口（recentSentenceIds）兜底。
    // 答对：按间隔重复等级走天数梯度。
    const nextReviewAt = isCorrect ? this.addDays(new Date(), REVIEW_INTERVAL_DAYS[level]) : new Date();

    const record = await this.prisma.sentenceRecord.create({
      data: {
        userId: BigInt(userId),
        sentenceId: sentence.id,
        userAnswer: trimmed.slice(0, 300),
        isCorrect: isCorrect ? 1 : 0,
        elapsedMs: Math.max(0, dto.elapsedMs ?? 0),
        reviewLevel: level,
        nextReviewAt,
      },
      select: { id: true },
    });
    await this.checkinService.recordAnswer(userId);

    // 微游戏化：按作答质量与模式发 XP（服务端权威 + event_key 幂等），并尝试解锁成就
    // 模式只决定用哪组规则，经验值恒由服务端算——拼词模式经验约为默写六成
    const rule = XP_EVENT[dto.mode === 'assemble' ? 'assemble' : 'input'];
    const eventType: keyof typeof XP_RULES = isCorrect ? (last ? rule.review : rule.first) : rule.wrong;
    await this.gamify.awardXp(userId, eventType, `answer:${record.id}`, XP_RULES[eventType]);

    const favorited = await this.isFavorited(userId, sentence.id);
    const today = await this.checkinService.getToday(userId);

    // 完成每日目标额外奖励（按日期幂等，一天一次）
    if (today?.completed) {
      await this.gamify.awardXp(userId, 'daily_goal', `daily_goal:${userId}:${today.date}`, XP_RULES.daily_goal);
    }
    await this.gamify.checkAchievements(userId);

    return {
      sentenceId: Number(sentence.id),
      isCorrect,
      sentenceEn: sentence.sentenceEn,
      // 下发全部可接受写法（主句已单独展示，这里只给备用表达，供「其他正确写法」提示）
      validAnswers,
      translationZh: sentence.translationZh,
      ipa: sentence.ipa,
      imageUrl: sentence.imageFileId > 0n ? await this.resolveImageUrl(Number(sentence.imageFileId)) : null,
      favorited,
      todayDone: today?.doneCount ?? 0,
      todayGoal: config.sentence.dailyGoal,
    };
  }

  /** 收藏 / 取消收藏（返回最终状态）。 */
  async toggleFavorite(userId: number, sentenceId: number): Promise<{ favorited: boolean }> {
    const sentence = await this.prisma.sentence.findUnique({
      where: { id: BigInt(sentenceId) },
      select: { id: true },
    });
    if (!sentence) {
      throw AppException.notFound('题目不存在');
    }
    const existing = await this.prisma.sentenceFavorite.findUnique({
      where: { userId_sentenceId: { userId: BigInt(userId), sentenceId: sentence.id } },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.sentenceFavorite.delete({ where: { id: existing.id } });
      return { favorited: false };
    }
    await this.prisma.sentenceFavorite.create({
      data: { userId: BigInt(userId), sentenceId: sentence.id },
    });
    // 微游戏化：收藏发 XP（按 userId+sentenceId 幂等，反复收藏不重复给）+ 尝试解锁成就
    await this.gamify.awardXp(userId, 'favorite', `favorite:${userId}:${sentence.id}`, XP_RULES.favorite);
    await this.gamify.checkAchievements(userId);
    return { favorited: true };
  }

  /** 收藏夹（分页，按收藏时间倒序）。 */
  async listFavorites(userId: number, query: Record<string, unknown>): Promise<PageResult<SentenceLibraryItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where = { userId: BigInt(userId) };
    const [rows, total] = await Promise.all([
      this.prisma.sentenceFavorite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          createdAt: true,
          sentence: {
            select: {
              id: true,
              sentenceEn: true,
              translationZh: true,
              ipa: true,
              imageFileId: true,
              difficulty: true,
              category: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.sentenceFavorite.count({ where }),
    ]);
    const list: SentenceLibraryItem[] = [];
    for (const row of rows) {
      const sentence = row.sentence;
      if (!sentence) {
        continue;
      }
      list.push({
        sentenceId: Number(sentence.id),
        sentenceEn: sentence.sentenceEn,
        translationZh: sentence.translationZh,
        ipa: sentence.ipa,
        imageUrl: sentence.imageFileId > 0n ? await this.resolveImageUrl(Number(sentence.imageFileId)) : null,
        categoryName: sentence.category?.name ?? null,
        difficulty: sentence.difficulty,
        createdAt: row.createdAt,
        nextReviewAt: null,
      });
    }
    return buildPageResult(list, total, page, pageSize);
  }

  /** 复习池（分页：答错且到期，按到期时间升序）。 */
  async listReview(userId: number, query: Record<string, unknown>): Promise<PageResult<SentenceLibraryItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where = {
      userId: BigInt(userId),
      isCorrect: 0,
      nextReviewAt: { lte: new Date() },
      sentence: { status: 'ready' },
    };
    const [rows, total] = await Promise.all([
      this.prisma.sentenceRecord.findMany({
        where,
        orderBy: [{ nextReviewAt: 'asc' }, { id: 'desc' }],
        skip: offset,
        take: limit,
        select: {
          createdAt: true,
          reviewLevel: true,
          nextReviewAt: true,
          sentence: {
            select: {
              id: true,
              sentenceEn: true,
              translationZh: true,
              ipa: true,
              imageFileId: true,
              difficulty: true,
              category: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.sentenceRecord.count({ where }),
    ]);
    const list: SentenceLibraryItem[] = [];
    for (const row of rows) {
      const sentence = row.sentence;
      if (!sentence) {
        continue;
      }
      list.push({
        sentenceId: Number(sentence.id),
        sentenceEn: sentence.sentenceEn,
        translationZh: sentence.translationZh,
        ipa: sentence.ipa,
        imageUrl: sentence.imageFileId > 0n ? await this.resolveImageUrl(Number(sentence.imageFileId)) : null,
        categoryName: sentence.category?.name ?? null,
        difficulty: sentence.difficulty,
        createdAt: row.createdAt,
        reviewLevel: row.reviewLevel,
        nextReviewAt: row.nextReviewAt,
      });
    }
    return buildPageResult(list, total, page, pageSize);
  }

  /** 最近 N 次答过的句子 id（防重窗口；N=0 时返回空数组）。 */
  private async recentSentenceIds(userId: number, window: number): Promise<number[]> {
    if (window <= 0) {
      return [];
    }
    const rows = await this.prisma.sentenceRecord.findMany({
      where: { userId: BigInt(userId) },
      orderBy: { createdAt: 'desc' },
      take: window,
      select: { sentenceId: true },
    });
    return rows.map((row) => Number(row.sentenceId));
  }

  /**
   * 随机取一道就绪新题。
   * 用「count → 随机 offset → take 1」而非 ORDER BY RAND()：
   * Prisma 的 orderBy 不支持 RAND()，且全表 RAND 在大表上是 O(N) 排序；
   * 随机 offset 方案只需一次 count（status 有索引）与一次 limit 查询。
   *
   * @param difficulty 难度筛选（1/2/3）；不传则不限难度。
   */
  private async pickReadySentence(excludeIds: number[], difficulty?: number): Promise<number | null> {
    const where: Record<string, unknown> = { status: 'ready' };
    if (difficulty) {
      where.difficulty = difficulty;
    }
    if (excludeIds.length > 0) {
      where.id = { notIn: excludeIds.map((id) => BigInt(id)) };
    }
    const total = await this.prisma.sentence.count({ where });
    if (total === 0) {
      return null;
    }
    const offset = Math.floor(Math.random() * total);
    const rows = await this.prisma.sentence.findMany({
      where,
      orderBy: { id: 'asc' },
      skip: offset,
      take: 1,
      select: { id: true },
    });
    return rows[0] ? Number(rows[0].id) : null;
  }

  /** 取一道到期复习题（到期最早的优先，候选批内随机打散避免「永远同一题」）。 */
  private async pickDueReviewSentence(userId: number, excludeIds: number[]): Promise<number | null> {
    const where: Record<string, unknown> = {
      userId: BigInt(userId),
      isCorrect: 0,
      nextReviewAt: { lte: new Date() },
      sentence: { status: 'ready' },
    };
    if (excludeIds.length > 0) {
      where.sentenceId = { notIn: excludeIds.map((id) => BigInt(id)) };
    }
    const rows = await this.prisma.sentenceRecord.findMany({
      where,
      orderBy: [{ nextReviewAt: 'asc' }, { id: 'asc' }],
      take: REVIEW_POOL_BATCH,
      select: { sentenceId: true },
    });
    if (rows.length === 0) {
      return null;
    }
    const picked = rows[Math.floor(Math.random() * rows.length)];
    return Number(picked.sentenceId);
  }

  /** 判断是否已收藏。 */
  private async isFavorited(userId: number, sentenceId: bigint): Promise<boolean> {
    const row = await this.prisma.sentenceFavorite.findUnique({
      where: { userId_sentenceId: { userId: BigInt(userId), sentenceId } },
      select: { id: true },
    });
    return row !== null;
  }

  /** 图片文件 id → 访问 URL（文件缺失返回 null）。 */
  private async resolveImageUrl(fileId: number): Promise<string | null> {
    const file = await this.fileService.findById(fileId);
    return file?.fileUrl ?? null;
  }

  /** 日期加法（返回新 Date）。 */
  private addDays(base: Date, days: number): Date {
    const next = new Date(base);
    next.setDate(next.getDate() + days);
    return next;
  }
}
