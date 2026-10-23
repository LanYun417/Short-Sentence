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
import { AnswerSentenceDto } from './dto.js';

/** 间隔重复梯度（天）：下标 = reviewLevel。 */
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
}

/** 提交答案结果（含正确答案，用于翻转面）。 */
export interface AnswerResult {
  sentenceId: number;
  isCorrect: boolean;
  sentenceEn: string;
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

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
    private readonly checkinService: CheckinService,
  ) {}

  /**
   * 抽下一张卡：按 newRatio 概率取新题，否则取到期复习题；
   * 一侧无候选时回落到另一侧；最近 N 次答过的题（防重窗口）两侧都不出。
   *
   * @param difficulty 目标难度（1 易 / 2 中 / 3 难），仅作用于**新题**——
   *   复习题必须按间隔重复排期走，按难度过滤会打乱复习节奏。该难度无可用新题时回落到不限难度。
   */
  async next(userId: number, difficulty?: number): Promise<NextQuestion> {
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
    };
  }

  /**
   * 提交答案：比对 → 记录 → 排期 → 累积打卡。
   */
  async answer(userId: number, sentenceId: number, dto: AnswerSentenceDto): Promise<AnswerResult> {
    const sentence = await this.prisma.sentence.findFirst({
      where: { id: BigInt(sentenceId), status: 'ready' },
      select: { id: true, sentenceEn: true, translationZh: true, ipa: true, imageFileId: true },
    });
    if (!sentence) {
      throw AppException.notFound('题目不存在或未就绪');
    }

    const trimmed = dto.userAnswer.trim();
    const isCorrect = trimmed.length > 0 && normalizeAnswer(trimmed) === normalizeAnswer(sentence.sentenceEn);

    // 间隔重复：同题取最近一次的等级递进
    const last = await this.prisma.sentenceRecord.findFirst({
      where: { userId: BigInt(userId), sentenceId: sentence.id },
      orderBy: { createdAt: 'desc' },
      select: { reviewLevel: true },
    });
    const level = isCorrect ? Math.min((last?.reviewLevel ?? 0) + 1, REVIEW_INTERVAL_DAYS.length - 1) : 0;
    const nextReviewAt = this.addDays(new Date(), REVIEW_INTERVAL_DAYS[level]);

    await this.prisma.sentenceRecord.create({
      data: {
        userId: BigInt(userId),
        sentenceId: sentence.id,
        userAnswer: trimmed.slice(0, 300),
        isCorrect: isCorrect ? 1 : 0,
        elapsedMs: Math.max(0, dto.elapsedMs ?? 0),
        reviewLevel: level,
        nextReviewAt,
      },
    });
    await this.checkinService.recordAnswer(userId);

    const favorited = await this.isFavorited(userId, sentence.id);
    const today = await this.checkinService.getToday(userId);
    return {
      sentenceId: Number(sentence.id),
      isCorrect,
      sentenceEn: sentence.sentenceEn,
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
