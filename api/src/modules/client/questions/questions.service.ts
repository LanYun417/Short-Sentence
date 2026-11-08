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
import { buildPageResult, parsePagination, readNumber } from '../../../common/utils/utils.js';
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

/** 已毕业题的 reviewLevel 编码（高于正常 5 档梯度，便于复盘与可视化区分）。 */
const GRADUATE_LEVEL = REVIEW_INTERVAL_DAYS.length;

/** 复习池候选批大小（在此范围内随机取，兼顾「到期优先」与「不总是同一题」）。 */
const REVIEW_POOL_BATCH = 50;

/** 某用户某题的「累计答对」聚合（抽题时由 sentence_record 实时 groupBy 得到，不另建表）。 */
interface MasteryEntry {
  sentenceId: number;
  correctCount: number;
  lastCorrectAt: Date;
}

/** 记忆健康概览（供前端「遗忘曲线 / 待复习分布」可视化）。 */
export interface MemoryStats {
  /** 有答对记录的不同题数（≈已复习题数） */
  reviewed: number;
  /** 累计答对 >= graduateAt 的题数（已毕业，转入长期维护） */
  graduated: number;
  /** 今天到期需复习的题数 */
  dueToday: number;
  /** 未来 7 天内到期 */
  dueIn7: number;
  /** 未来 30 天内到期 */
  dueIn30: number;
  /** 未来 30 天每天到期题数分布（长度 30，索引 0 = 今天） */
  distribution: number[];
  /** 理论遗忘曲线：R(day)=exp(-day/S)，S 取维护基线；长度 31（day 0..30） */
  retentionCurve: Array<{ day: number; retention: number }>;
}

/** 一颗「记忆星」：用户学过的某个句子在星系中的可视化表示。 */
export interface GalaxyStar {
  /** 归一化坐标 0..1；由后端按 sentenceId 确定性生成，保证 Web/App 一致且刷新不跳 */
  x: number;
  y: number;
  /** 星点半径（相对单位，前端按画布比例缩放） */
  radius: number;
  /** 亮度 0..1：记忆强度 × 新鲜度 */
  brightness: number;
  /** gold=已毕业 / stable=记忆稳固 / faded=到期该复习（暖色提醒） */
  tone: 'gold' | 'stable' | 'faded';
  /** 所属星座（场景分类）id */
  categoryId: number;
}

/** 一个星座（场景分类）。未点亮的也会返回，供前端画「待探索」轮廓。 */
export interface GalaxyCluster {
  categoryId: number;
  name: string;
  nameEn: string | null;
  /** 星座中心归一化坐标 0..1 */
  x: number;
  y: number;
  /** 该场景学过的句数 */
  starCount: number;
  graduated: number;
  dueCount: number;
  /** 平均记忆强度 0..1 */
  avgStrength: number;
}

/** 记忆星系：把「学过的句子」画成一片星空，按场景聚成星座。 */
export interface MemoryGalaxy {
  stars: GalaxyStar[];
  clusters: GalaxyCluster[];
  /** 学过的总句数（超过渲染上限时可能大于 stars.length） */
  totalLearned: number;
  /** 全局已毕业星数 */
  graduated: number;
  /** 全局今日到期需复习的星数（与 MemoryStats.dueToday 同口径） */
  dueCount: number;
  /** 已点亮星座数（至少学过 1 句） */
  litClusters: number;
  totalClusters: number;
}

/**
 * 确定性伪随机（mulberry32）：同一 seed 恒得同一序列。
 * 星点坐标不能每次刷新都变，否则「我的星系」失去收藏感。
 */
function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 下一张卡（不含答案字段）。 */
export interface NextQuestion {
  sentenceId: number;
  /** 中文题干 */
  translationZh: string;
  /** 场景图 URL（16:9） */
  imageUrl: string | null;
  categoryName: string | null;
  /** 节日题库：所属节日名（普通题为 null；卡片上展示节日徽标） */
  festivalName: string | null;
  difficulty: number;
  /** 今日已完成题数 */
  todayDone: number;
  /** 今日目标题数 */
  todayGoal: number;
  /** 本题来源：new 新题 / review 复习题 */
  source: 'new' | 'review';
  /**
   * 拼词模式的候选词块（打乱后的英文单词，含原标点）。
   * **恒定下发**（不再依赖 mode）——这样客户端切换「输入 / 拼词」时沿用当前题即可，
   * 无需重抽（Web / App 一致）。词块为打乱顺序，不构成答案的直接泄露。
   */
  words: string[] | null;
  /**
   * 选词模式的逐词中文释义（词 → 该词在本句中的含义）。
   * 与 `words` 一样恒定下发；旧题 / 生成失败时为 null（前端不显示悬浮提示）。
   */
  wordMeanings: Record<string, string> | null;
}

/** 节日题库（用户端「专门刷题」入口）。 */
export interface FestivalBank {
  /** 节日名（如「春节」） */
  name: string;
  /** 当前题库的题目数（只算就绪且未退场） */
  count: number;
  /** 该期节日的公历日期（YYYY-MM-DD） */
  date: string | null;
  /**
   * 封面图 URL：取该节日题库里一张已生成配图的题当封面（贴合节日主题、免费复用已生成的插画）。
   * 没有可用配图时为 null，前端回退到渐变底色。
   */
  coverUrl: string | null;
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
  /**
   * 题目解析（语法点 / 时态 / 关键词形与搭配 / 易错点）。
   * **无论答对答错都下发**：这是学习闭环的核心——用户要知道为什么这么写。
   * 空值 = 该题还没生成解析（老题尚未回填），客户端不显示解析块。
   */
  explanation: string | null;
  imageUrl: string | null;
  /** 当前是否已收藏 */
  favorited: boolean;
  todayDone: number;
  todayGoal: number;
  /** 本次作答获得的经验（重复作答 / 幂等命中为 0） */
  xpEarned: number;
  /** 本次作答恰好完成每日目标的额外奖励经验（未触发为 0） */
  goalBonus: number;
  /** 本次新解锁的成就（客户端可直接弹提示） */
  newAchievements: Array<{ code: string; name: string }>;
  /**
   * 是否为「复习期未到」的重复作答（防重放命中）。
   * 此时只返回判分结果，不落记录、不发经验、不计打卡（详见 `answer()`）。
   */
  repeated?: boolean;
}

/** 收藏夹条目。 */
export interface SentenceLibraryItem {
  sentenceId: number;
  sentenceEn: string;
  translationZh: string;
  ipa: string | null;
  /** 题目解析（语法 / 时态 / 词形；点开句子复习时展示；老题可能为空） */
  explanation: string | null;
  imageUrl: string | null;
  categoryName: string | null;
  difficulty: number;
  /** 收藏时间（收藏夹）/ 最近作答时间（复习池） */
  createdAt: Date;
  /** 复习池专用：连续答对等级 */
  reviewLevel?: number;
  /** 复习池专用：下次复习时间 */
  nextReviewAt: Date | null;
  /** 历史记录专用：本次作答是否正确（仅 listHistory 返回） */
  isCorrect?: boolean;
  /** 历史记录专用：用户本次的实际作答（答错时回显；仅 listHistory 返回） */
  userAnswer?: string | null;
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
   * @param festival 节日题库名（如「春节」）。传了则只从该节日的**当前题库**抽题（专门刷题），
   *   不混入日常题与复习题；不传走日常混抽。
   * @param categoryId 场景分类 id。传了则只从该场景的题库抽题（专门刷题）；
   *   与 festival 互斥，festival 优先；两者都不传走日常混抽。
   */
  async next(userId: number, difficulty?: number, festival?: string, categoryId?: number): Promise<NextQuestion> {
    const recentIds = await this.recentSentenceIds(userId, config.sentence.antiRepeatWindow);
    // 「累计答对」降权：答对越多，随机抽中概率越低（不再硬禁抽——
    // 毕业题靠拉长的复习间隔自然淡出，到期仍会出现，符合间隔重复）。
    const mastery = await this.groupMastery(userId);

    // 节日题库：专门刷题——只在该节日当前（未退场）的题库里抽
    const festivalName = festival?.trim();
    if (festivalName) {
      const festivalSentenceId = await this.pickFestivalSentence(festivalName, recentIds, mastery);
      if (festivalSentenceId === null) {
        throw AppException.notFound(`「${festivalName}」题库暂无可用题目`);
      }
      return this.buildNextQuestion(userId, festivalSentenceId, 'new');
    }

    // 场景题库：专门刷题——只在该场景当前（未退场）的题库里抽
    if (categoryId && categoryId > 0) {
      const categorySentenceId = await this.pickCategorySentence(categoryId, recentIds, mastery);
      if (categorySentenceId === null) {
        throw AppException.notFound('该场景题库暂无可用题目');
      }
      return this.buildNextQuestion(userId, categorySentenceId, 'new');
    }

    const wantNew = Math.random() < config.sentence.newRatio;

    let sentenceId: number | null;
    let source: 'new' | 'review';
    if (wantNew) {
      sentenceId = await this.pickReadySentence(recentIds, difficulty, mastery);
      source = 'new';
      // 指定难度下没有可用新题：回落到不限难度，避免用户被卡住
      if (sentenceId === null && difficulty) {
        sentenceId = await this.pickReadySentence(recentIds, undefined, mastery);
      }
      if (sentenceId === null) {
        sentenceId = await this.pickDueReviewSentence(userId, recentIds);
        source = 'review';
      }
    } else {
      sentenceId = await this.pickDueReviewSentence(userId, recentIds);
      source = 'review';
      if (sentenceId === null) {
        sentenceId = await this.pickReadySentence(recentIds, difficulty, mastery);
        source = 'new';
        if (sentenceId === null && difficulty) {
          sentenceId = await this.pickReadySentence(recentIds, undefined, mastery);
        }
      }
    }
    if (sentenceId === null) {
      throw AppException.notFound('暂无可用题目，休息一下 or 等待每日更新');
    }
    return this.buildNextQuestion(userId, sentenceId, source);
  }

  /** 题目 id → 下一张卡（含今日进度与拼词词块）。 */
  private async buildNextQuestion(userId: number, sentenceId: number, source: 'new' | 'review'): Promise<NextQuestion> {
    const sentence = await this.prisma.sentence.findUnique({
      where: { id: BigInt(sentenceId) },
      select: {
        id: true,
        sentenceEn: true,
        translationZh: true,
        imageFileId: true,
        difficulty: true,
        festivalName: true,
        wordMeanings: true,
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
      festivalName: sentence.festivalName,
      difficulty: sentence.difficulty,
      todayDone: today?.doneCount ?? 0,
      todayGoal: config.sentence.dailyGoal,
      source,
      words: shuffleWords(sentence.sentenceEn),
      wordMeanings: this.parseWordMeanings(sentence.wordMeanings),
    };
  }

  /**
   * 解析逐词释义 JSON。
   * 旧题 / 脏数据一律返回 null——前端据此不显示悬浮提示，绝不抛错影响抽题。
   */
  private parseWordMeanings(raw: string | null): Record<string, string> | null {
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }
      const out: Record<string, string> = {};
      for (const [word, meaning] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof meaning === 'string' && meaning.trim()) {
          out[word] = meaning.trim().slice(0, 30);
        }
      }
      return Object.keys(out).length > 0 ? out : null;
    } catch {
      return null;
    }
  }

  /**
   * 当前有题的节日题库（按节日日期倒序）。
   * 只统计「就绪且未退场」的题——退场旧题不会出现在列表里。
   */
  async listFestivals(): Promise<FestivalBank[]> {
    const rows = await this.prisma.sentence.groupBy({
      by: ['festivalName'],
      // 题数按「真正可抽」统计：与抽题条件一致，避免显示 100 题却点进去抽不到
      where: { status: 'ready', retiredAt: null, imageFileId: { gt: 0n }, festivalName: { not: null } },
      _count: { _all: true },
      _max: { festivalDate: true },
    });
    const banks = rows
      .map((row) => ({
        name: row.festivalName ?? '',
        count: row._count._all,
        date: row._max.festivalDate ?? null,
        coverUrl: null as string | null,
      }))
      .filter((row) => row.name.length > 0)
      // 按节日日期**升序**（元旦 → 跨年夜）：用户端当时间轴看，
      // 而不是从年底倒着排。同一节日跨年重新生成时日期会更新，顺序仍稳定。
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.name.localeCompare(b.name));

    // 封面优先用**节日专属封面**：为该节日单独生成的标志性主视觉，挂在节日分类上
    // （见 SentenceGenService.generateFestivalCover）。
    // 没有专属封面时才回退到「从题库里挑一张」——题图只体现节日氛围，常常看不出是哪个
    // 节日（元旦=两人喝热饮、春节=提行李出门）。
    const categories = await this.prisma.sentenceCategory.findMany({
      where: { name: { in: banks.map((bank) => bank.name) } },
      select: { name: true, coverFileId: true },
    });
    const dedicatedCover = new Map<string, number>();
    for (const category of categories) {
      // 同名分类可能不止一个（历史遗留），取第一个有封面的
      if (category.coverFileId > 0n && !dedicatedCover.has(category.name)) {
        dedicatedCover.set(category.name, Number(category.coverFileId));
      }
    }

    // 并发解析，避免 21 个节日串行等 IO。
    await Promise.all(
      banks.map(async (bank) => {
        const dedicated = dedicatedCover.get(bank.name);
        if (dedicated !== undefined) {
          const url = await this.resolveImageUrl(dedicated);
          if (url) {
            bank.coverUrl = url;
            return;
          }
        }
        // 回退：取该节日里 imageFileId 最小的就绪题（确定性、稳定，刷新不换图）
        const cover = await this.prisma.sentence.findFirst({
          where: {
            festivalName: bank.name,
            status: 'ready',
            retiredAt: null,
            imageFileId: { gt: 0n },
          },
          orderBy: { id: 'asc' },
          select: { imageFileId: true },
        });
        if (cover && cover.imageFileId > 0n) {
          bank.coverUrl = await this.resolveImageUrl(Number(cover.imageFileId));
        }
      }),
    );

    return banks;
  }

  /** 从指定节日题库随机抽一道（排除防重窗口，并按累计答对数降权）。 */
  private async pickFestivalSentence(
    festivalName: string,
    excludeIds: number[],
    mastery: MasteryEntry[],
  ): Promise<number | null> {
    return this.pickBankSentence({ festivalName }, excludeIds, mastery);
  }

  /** 从指定场景题库随机抽一道（同上）。 */
  private async pickCategorySentence(
    categoryId: number,
    excludeIds: number[],
    mastery: MasteryEntry[],
  ): Promise<number | null> {
    return this.pickBankSentence({ categoryId: BigInt(categoryId) }, excludeIds, mastery);
  }

  /**
   * 从指定题库（where 描述的子集：节日 / 场景分类）随机抽一道。
   * 在「count + 随机 offset」均匀随机之上叠加「累计答对」权重（见 pickWeightedSentence）。
   *
   * `imageFileId > 0` 是下发前的最后一道保险：正常生成链路里 status 与图片是同一条
   * update 写入的，但运营手工改状态 / 补图脚本中途放行 / sys_file 记录被删都可能留下
   * 「ready 但无图」的脏数据。只靠状态过滤会把这类题抽出来变成一张空图卡。
   */
  private async pickBankSentence(
    where: Record<string, unknown>,
    excludeIds: number[],
    mastery: MasteryEntry[],
  ): Promise<number | null> {
    const baseWhere: Record<string, unknown> = {
      status: 'ready',
      retiredAt: null,
      imageFileId: { gt: 0n },
      ...where,
    };
    const entries = await this.filterMasteryBySentence(mastery, baseWhere, excludeIds);
    return this.pickWeightedSentence(baseWhere, excludeIds, entries);
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
        explanation: true,
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
      select: { reviewLevel: true, nextReviewAt: true },
    });

    // 防重放（服务端权威）：上一轮**答对**且复习期还没到，说明这句压根不该被作答。
    // 正常用户抽不到它——`next()` 只下发新题或**已到期**的复习题；能打到这里只可能是
    // 脚本拿着已知答案反复提交同一句。这种请求照常判分（让用户看得到对错），
    // 但**不落记录、不发经验、不计打卡**：否则重放可以同时刷经验、刷今日完成数，
    // 还会把复习等级一路顶到最高（等于把用户自己的复习节奏搞坏）。
    // 注意「答错」的 nextReviewAt 恒为 now（当天立即复现，见下），所以错题回路不受影响。
    const due = !last || !last.nextReviewAt || last.nextReviewAt.getTime() <= Date.now();
    if (!due) {
      const repeatedFavorite = await this.isFavorited(userId, sentence.id);
      const repeatedToday = await this.checkinService.getToday(userId);
      return {
        sentenceId: Number(sentence.id),
        isCorrect,
        sentenceEn: sentence.sentenceEn,
        validAnswers,
        translationZh: sentence.translationZh,
        ipa: sentence.ipa,
        explanation: sentence.explanation,
        imageUrl: sentence.imageFileId > 0n ? await this.resolveImageUrl(Number(sentence.imageFileId)) : null,
        favorited: repeatedFavorite,
        todayDone: repeatedToday?.doneCount ?? 0,
        todayGoal: config.sentence.dailyGoal,
        xpEarned: 0,
        goalBonus: 0,
        newAchievements: [],
        repeated: true,
      };
    }

    // 间隔重复（FSRS-light）：答对按「累计答对次数」驱动复习间隔；答错立即到期。
    // - 未毕业（累计答对 < graduateAt）：沿用 5 档梯度 [1,3,7,15,30] 天。
    // - 已毕业（累计答对 >= graduateAt）：转入长期维护，间隔随毕业后答对次数指数增长并封顶。
    const graduateAt = config.sentence.masteryGraduateAt;
    const correctTotal = await this.prisma.sentenceRecord.count({
      where: { userId: BigInt(userId), sentenceId: sentence.id, isCorrect: 1 },
    });
    const correctTotalAfter = correctTotal + (isCorrect ? 1 : 0);

    let level: number;
    let intervalDays: number;
    if (!isCorrect) {
      level = 0;
      intervalDays = 0;
    } else if (correctTotalAfter < graduateAt) {
      level = Math.min((last?.reviewLevel ?? 0) + 1, REVIEW_INTERVAL_DAYS.length - 1);
      intervalDays = REVIEW_INTERVAL_DAYS[level];
    } else {
      const afterGrad = Math.min(correctTotalAfter - graduateAt, config.sentence.masteryMaintenanceCap);
      level = GRADUATE_LEVEL;
      intervalDays = Math.round(
        config.sentence.masteryMaintenanceBase * Math.pow(config.sentence.masteryMaintenanceGrowth, afterGrad),
      );
    }
    const nextReviewAt = isCorrect ? this.addDays(new Date(), intervalDays) : new Date();

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
    // 返回值给客户端做「+N XP」的即时反馈：幂等命中（重复提交）时为 0，不虚报
    const xpAwarded = await this.gamify.awardXp(userId, eventType, `answer:${record.id}`, XP_RULES[eventType]);

    const favorited = await this.isFavorited(userId, sentence.id);
    const today = await this.checkinService.getToday(userId);

    // 完成每日目标额外奖励（按日期幂等，一天一次）
    let goalBonus = 0;
    if (today?.completed) {
      const awarded = await this.gamify.awardXp(
        userId,
        'daily_goal',
        `daily_goal:${userId}:${today.date}`,
        XP_RULES.daily_goal,
      );
      if (awarded) {
        goalBonus = XP_RULES.daily_goal;
      }
    }
    const newAchievements = await this.gamify.checkAchievements(userId);

    return {
      sentenceId: Number(sentence.id),
      isCorrect,
      sentenceEn: sentence.sentenceEn,
      // 下发全部可接受写法（主句已单独展示，这里只给备用表达，供「其他正确写法」提示）
      validAnswers,
      translationZh: sentence.translationZh,
      ipa: sentence.ipa,
      explanation: sentence.explanation,
      imageUrl: sentence.imageFileId > 0n ? await this.resolveImageUrl(Number(sentence.imageFileId)) : null,
      favorited,
      todayDone: today?.doneCount ?? 0,
      todayGoal: config.sentence.dailyGoal,
      xpEarned: xpAwarded ? XP_RULES[eventType] : 0,
      goalBonus,
      newAchievements,
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

  /**
   * 收藏夹 / 学习记录共用的筛选构造（难度 / 场景 / 时间范围）。
   * 日期按 UTC 自然日边界（to 含当天 23:59:59.999）；空集时不拼接，避免多余条件影响索引。
   */
  private buildRecordFilters(query: Record<string, unknown>): {
    sentenceWhere: Record<string, unknown>;
    dateWhere: Record<string, unknown>;
  } {
    const difficulty = readNumber(query.difficulty);
    const categoryId = readNumber(query.categoryId);
    const from = typeof query.from === 'string' && query.from ? query.from : undefined;
    const to = typeof query.to === 'string' && query.to ? query.to : undefined;

    const sentenceWhere: Record<string, unknown> = {};
    if (difficulty) {
      sentenceWhere.difficulty = difficulty;
    }
    if (categoryId) {
      sentenceWhere.categoryId = BigInt(categoryId);
    }
    const dateWhere: Record<string, unknown> = {};
    if (from) {
      dateWhere.gte = new Date(`${from}T00:00:00.000Z`);
    }
    if (to) {
      dateWhere.lte = new Date(`${to}T23:59:59.999Z`);
    }
    return { sentenceWhere, dateWhere };
  }

  /** 收藏夹（分页，支持难度 / 场景 / 收藏时间范围筛选，按收藏时间倒序）。 */
  async listFavorites(userId: number, query: Record<string, unknown>): Promise<PageResult<SentenceLibraryItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const { sentenceWhere, dateWhere } = this.buildRecordFilters(query);
    const where: Record<string, unknown> = { userId: BigInt(userId) };
    if (Object.keys(sentenceWhere).length > 0) {
      where.sentence = sentenceWhere;
    }
    if (Object.keys(dateWhere).length > 0) {
      where.createdAt = dateWhere;
    }
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
              explanation: true,
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
        explanation: sentence.explanation,
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
      // 已退场的旧节日题不再进复习池（收藏/历史仍可见）
      sentence: { status: 'ready', retiredAt: null },
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
              explanation: true,
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
        explanation: sentence.explanation,
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

  /**
   * 学习记录（全量历史，分页 + 多维度筛选）。
   *
   * 与 listReview（仅「答错且到期」的复习池）不同，这里返回**用户答过的每一条记录**，
   * 不做 isCorrect / nextReviewAt 的限制，因此可以看到所有过往作答（含已掌握的）。
   *
   * 筛选维度：
   * - `type`：all 全部 / wrong 仅错题(isCorrect=0) / right 仅对题(isCorrect=1)
   * - `difficulty`：句子难度（1/2/3）
   * - `categoryId`：场景分类
   * - `from` / `to`：作答时间范围（按 UTC 自然日边界；to 含当天 23:59:59.999）
   * 排序：最近作答时间倒序。
   *
   * 已软删除 / 不存在的句子（sentence 为 null）会被跳过，不计入总数。
   */
  async listHistory(userId: number, query: Record<string, unknown>): Promise<PageResult<SentenceLibraryItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const typeFilter = typeof query.type === 'string' ? query.type : 'all';
    const { sentenceWhere, dateWhere } = this.buildRecordFilters(query);
    // 历史只保留最近一个月（不论对错）：未显式指定起始日期时，按保留天数截断
    if (!dateWhere.gte && config.sentence.recordRetentionDays > 0) {
      dateWhere.gte = new Date(Date.now() - config.sentence.recordRetentionDays * 24 * 60 * 60 * 1000);
    }

    const where: Record<string, unknown> = { userId: BigInt(userId) };
    if (Object.keys(sentenceWhere).length > 0) {
      where.sentence = sentenceWhere;
    }
    if (typeFilter === 'wrong') {
      where.isCorrect = 0;
    } else if (typeFilter === 'right') {
      where.isCorrect = 1;
    }
    if (Object.keys(dateWhere).length > 0) {
      where.createdAt = dateWhere;
    }

    const [rows, total] = await Promise.all([
      this.prisma.sentenceRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          isCorrect: true,
          userAnswer: true,
          reviewLevel: true,
          nextReviewAt: true,
          sentence: {
            select: {
              id: true,
              sentenceEn: true,
              translationZh: true,
              ipa: true,
              explanation: true,
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
        explanation: sentence.explanation,
        imageUrl: sentence.imageFileId > 0n ? await this.resolveImageUrl(Number(sentence.imageFileId)) : null,
        categoryName: sentence.category?.name ?? null,
        difficulty: sentence.difficulty,
        createdAt: row.createdAt,
        isCorrect: row.isCorrect === 1,
        userAnswer: row.userAnswer,
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
  private async pickReadySentence(
    excludeIds: number[],
    difficulty?: number,
    mastery: MasteryEntry[] = [],
  ): Promise<number | null> {
    // retiredAt 非空 = 已退场的旧节日题：不再进入练习流（收藏/历史仍可见）
    // imageFileId > 0：无配图的题不下发（详见 pickBankSentence 的说明）
    const baseWhere: Record<string, unknown> = { status: 'ready', retiredAt: null, imageFileId: { gt: 0n } };
    if (difficulty) {
      baseWhere.difficulty = difficulty;
    }
    const entries = await this.filterMasteryBySentence(mastery, baseWhere, excludeIds);
    return this.pickWeightedSentence(baseWhere, excludeIds, entries);
  }

  /** 取一道到期复习题（到期最早的优先，候选批内随机打散避免「永远同一题」）。 */
  private async pickDueReviewSentence(userId: number, excludeIds: number[]): Promise<number | null> {
    const where: Record<string, unknown> = {
      userId: BigInt(userId),
      isCorrect: 0,
      nextReviewAt: { lte: new Date() },
      // 已退场的旧节日题不再进复习池（收藏/历史仍可见）；无配图的题同样不进
      sentence: { status: 'ready', retiredAt: null, imageFileId: { gt: 0n } },
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

  /**
   * 记忆健康概览：已复习 / 已毕业题数、未来待复习分布、理论遗忘曲线。
   * 供前端「遗忘曲线 / 待复习分布」可视化；数据来自 sentence_record 的答对记录 nextReviewAt。
   */
  async getMemoryStats(userId: number): Promise<MemoryStats> {
    const DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const horizon = now + 30 * DAY;

    // 未来 30 天内到期的「已答对」记录（含已到期的），每条带 nextReviewAt
    const records = await this.prisma.sentenceRecord.findMany({
      where: {
        userId: BigInt(userId),
        isCorrect: 1,
        nextReviewAt: { lte: new Date(horizon) },
      },
      select: { sentenceId: true, nextReviewAt: true },
      orderBy: { nextReviewAt: 'asc' },
    });
    // 每题取最新一条 nextReviewAt（同题多次答对，排期以后者为准）
    const latest = new Map<number, Date>();
    for (const r of records) {
      if (!r.nextReviewAt) continue;
      const sid = Number(r.sentenceId);
      const t = r.nextReviewAt;
      if (!latest.has(sid) || t.getTime() > latest.get(sid)!.getTime()) {
        latest.set(sid, t);
      }
    }

    const distribution = new Array<number>(30).fill(0);
    let dueToday = 0;
    let dueIn7 = 0;
    let dueIn30 = 0;
    for (const t of latest.values()) {
      const ts = t.getTime();
      if (ts <= endOfToday.getTime()) dueToday++;
      if (ts <= now + 7 * DAY) dueIn7++;
      if (ts <= now + 30 * DAY) dueIn30++;
      const dayIdx = Math.floor((ts - now) / DAY);
      if (dayIdx >= 0 && dayIdx < 30) distribution[dayIdx]++;
    }

    // 累计答对分布：groupBy 后得到「每题答对次数」，直接算已复习 / 已毕业
    const all = await this.prisma.sentenceRecord.groupBy({
      by: ['sentenceId'],
      where: { userId: BigInt(userId), isCorrect: 1 },
      _count: { _all: true },
    });
    const graduateAt = config.sentence.masteryGraduateAt;
    const reviewed = all.length;
    const graduated = all.filter((r) => r._count._all >= graduateAt).length;

    // 理论遗忘曲线：R(d)=exp(-d/S)，S 取毕业后维护基线（仅作可视化示意）
    const S = config.sentence.masteryMaintenanceBase;
    const retentionCurve = Array.from({ length: 31 }, (_, d) => ({
      day: d,
      retention: Number(Math.exp(-d / S).toFixed(4)),
    }));

    return { reviewed, graduated, dueToday, dueIn7, dueIn30, distribution, retentionCurve };
  }

  /**
   * 记忆星系：把用户学过的每个句子渲染成一颗星，按场景分类聚成星座。
   *
   * 视觉语义：
   * - 半径/亮度 = 记忆强度（累计答对次数相对毕业阈值，开方让新手期也有可见差异）；
   * - 金色 = 已毕业、蓝色 = 记忆稳固、暖橙 = 今日到期该复习（亮度按超期天数衰减）；
   * - 坐标为确定性伪随机（seed=sentenceId），星座中心按分类顺序均匀环形排布。
   *
   * 口径与 getMemoryStats 一致：仅取「答对」记录的最新一次排期（复习池权威仍由错题派生），
   * 到期判定用「今天结束前」。坐标由后端算，Web/App 只负责画，避免两端布局漂移。
   * 渲染上限 MAX_STARS 防止极端用户一次拉回过多点位。
   */
  async getMemoryGalaxy(userId: number): Promise<MemoryGalaxy> {
    const DAY = 24 * 60 * 60 * 1000;
    const MAX_STARS = 800;
    const now = Date.now();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const graduateAt = config.sentence.masteryGraduateAt;
    const stability = config.sentence.masteryMaintenanceBase;

    // 1. 每题累计答对次数 + 最后一次答对的排期（groupBy 走索引，避免全量拉记录）
    const grouped = await this.prisma.sentenceRecord.groupBy({
      by: ['sentenceId'],
      where: { userId: BigInt(userId), isCorrect: 1 },
      _count: { _all: true },
      _max: { nextReviewAt: true },
    });

    // 2. 句子 → 场景（题被物理删除时跳过，不画孤儿星）
    const ids = grouped.map((r) => r.sentenceId);
    const sentences = ids.length
      ? await this.prisma.sentence.findMany({
          where: { id: { in: ids } },
          select: { id: true, categoryId: true },
        })
      : [];
    const categoryOf = new Map(sentences.map((s) => [Number(s.id), Number(s.categoryId)]));

    // 3. 全部启用场景（含未点亮的，前端画「待探索」轮廓）
    const categories = await this.prisma.sentenceCategory.findMany({
      where: { status: 1 },
      select: { id: true, name: true, nameEn: true, sort: true },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    const count = Math.max(1, categories.length);
    const centers = new Map<number, { x: number; y: number }>();
    categories.forEach((c, i) => {
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
      centers.set(Number(c.id), {
        x: 0.5 + 0.33 * Math.cos(angle),
        y: 0.5 + 0.33 * Math.sin(angle),
      });
    });

    // 4. 组装每题的记忆状态
    interface GalaxyItem {
      sentenceId: number;
      categoryId: number;
      strength: number;
      graduated: boolean;
      due: boolean;
      freshness: number;
    }
    const byCategory = new Map<number, GalaxyItem[]>();
    let graduated = 0;
    let dueCount = 0;
    for (const r of grouped) {
      const sid = Number(r.sentenceId);
      const categoryId = categoryOf.get(sid);
      if (categoryId === undefined) continue;
      const correct = r._count._all;
      const isGraduated = correct >= graduateAt;
      // 开方：前几次答对也能明显变亮，避免新手期一片暗星
      const strength = Math.min(1, Math.sqrt(Math.min(1, correct / graduateAt)) * 0.82 + 0.18);
      const reviewAt = r._max.nextReviewAt;
      const due = !reviewAt || reviewAt.getTime() <= endOfToday.getTime();
      const overdueDays = reviewAt ? Math.max(0, (now - reviewAt.getTime()) / DAY) : 30;
      // 未到期=1；到期后按 R(d)=exp(-d/S) 衰减，但留 0.4 底亮，避免「忘光了看不见」
      const freshness = due ? Math.max(0.4, Math.exp(-overdueDays / stability)) : 1;
      if (isGraduated) graduated++;
      if (due) dueCount++;
      const item: GalaxyItem = { sentenceId: sid, categoryId, strength, graduated: isGraduated, due, freshness };
      const list = byCategory.get(categoryId) ?? [];
      list.push(item);
      byCategory.set(categoryId, list);
    }

    // 5. 确定性布点：先按 id 排序保证截断稳定，再在各自星座内极坐标散开
    const clamp = (v: number) => Math.min(0.98, Math.max(0.02, v));
    const stars: GalaxyStar[] = [];
    const ordered = [...byCategory.entries()].sort((a, b) => a[0] - b[0]);
    for (const [categoryId, list] of ordered) {
      const center = centers.get(categoryId) ?? { x: 0.5, y: 0.5 };
      const spread = 0.048 + Math.min(0.07, list.length * 0.003);
      for (const it of list) {
        const rand = seededRandom(it.sentenceId * 2654435761);
        const r = Math.sqrt(rand()) * spread;
        const angle = rand() * 2 * Math.PI;
        stars.push({
          x: Number(clamp(center.x + r * Math.cos(angle)).toFixed(4)),
          y: Number(clamp(center.y + r * Math.sin(angle)).toFixed(4)),
          radius: Number((1.1 + it.strength * 1.9 + (it.graduated ? 0.5 : 0)).toFixed(3)),
          brightness: Number(Math.min(1, Math.max(0.25, it.strength * it.freshness)).toFixed(3)),
          tone: it.due ? 'faded' : it.graduated ? 'gold' : 'stable',
          categoryId,
        });
      }
    }

    const clusters: GalaxyCluster[] = categories.map((c) => {
      const cid = Number(c.id);
      const center = centers.get(cid) ?? { x: 0.5, y: 0.5 };
      const list = byCategory.get(cid) ?? [];
      const starCount = list.length;
      const avgStrength = starCount
        ? Number((list.reduce((sum, it) => sum + it.strength, 0) / starCount).toFixed(3))
        : 0;
      return {
        categoryId: cid,
        name: c.name,
        nameEn: c.nameEn,
        x: Number(center.x.toFixed(4)),
        y: Number(center.y.toFixed(4)),
        starCount,
        graduated: list.filter((it) => it.graduated).length,
        dueCount: list.filter((it) => it.due).length,
        avgStrength,
      };
    });

    return {
      stars: stars.slice(0, MAX_STARS),
      clusters,
      totalLearned: stars.length,
      graduated,
      dueCount,
      litClusters: clusters.filter((c) => c.starCount > 0).length,
      totalClusters: clusters.length,
    };
  }

  /**
   * 聚合某用户「累计答对次数 >= 阶梯步长」的题目（答对才计数，答错不清零）。
   * 用 groupBy 走索引，只返回达到降权门槛的少量记录，避免全量拉取。
   */
  private async groupMastery(userId: number): Promise<MasteryEntry[]> {
    const step = config.sentence.masteryStep;
    const rows = await this.prisma.sentenceRecord.groupBy({
      by: ['sentenceId'],
      where: { userId: BigInt(userId), isCorrect: 1 },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    return rows
      .filter((row) => row._count._all >= step)
      .map((row) => ({
        sentenceId: Number(row.sentenceId),
        correctCount: row._count._all,
        lastCorrectAt: row._max.createdAt ?? new Date(0),
      }));
  }

  /** 累计答对权重：每 masteryStep 次答对，权重 × masteryStepFactor（默认每 5 次减半）。 */
  private masteryWeight(correctCount: number): number {
    const step = config.sentence.masteryStep;
    return Math.pow(config.sentence.masteryStepFactor, Math.floor(correctCount / step));
  }

  /**
   * 把全局 mastery 聚合按题库条件（难度/节日/场景）过滤，并剔除防重窗口与禁抽题，
   * 得到「本次候选池内」的高答对题列表（其 sentence 必然满足 baseWhere）。
   */
  private async filterMasteryBySentence(
    mastery: MasteryEntry[],
    baseWhere: Record<string, unknown>,
    excludeIds: number[],
  ): Promise<MasteryEntry[]> {
    if (mastery.length === 0) {
      return [];
    }
    const excluded = new Set(excludeIds);
    const candidates = mastery.filter((m) => !excluded.has(m.sentenceId));
    if (candidates.length === 0) {
      return [];
    }
    const sentences = await this.prisma.sentence.findMany({
      where: { id: { in: candidates.map((m) => BigInt(m.sentenceId)) } },
      select: {
        id: true,
        status: true,
        retiredAt: true,
        difficulty: true,
        festivalName: true,
        categoryId: true,
        imageFileId: true,
      },
    });
    const byId = new Map(sentences.map((s) => [Number(s.id), s]));
    const wantDifficulty = baseWhere.difficulty as number | undefined;
    const wantFestival = baseWhere.festivalName as string | undefined;
    const wantCategory = baseWhere.categoryId as bigint | number | undefined;
    return candidates.filter((m) => {
      const s = byId.get(m.sentenceId);
      // 高答对题是加权池里「直接按 id 抽」的，不经过 baseWhere 的 count/findFirst，
      // 所以这里必须同样把无图题剔掉，否则仍会从侧门抽到空图卡。
      if (!s || s.status !== 'ready' || s.retiredAt !== null || s.imageFileId <= 0n) {
        return false;
      }
      if (wantDifficulty !== undefined && s.difficulty !== wantDifficulty) {
        return false;
      }
      if (wantFestival !== undefined && s.festivalName !== wantFestival) {
        return false;
      }
      if (wantCategory !== undefined && Number(s.categoryId) !== Number(wantCategory)) {
        return false;
      }
      return true;
    });
  }

  /** 按权重从高答对题列表里随机选一道。 */
  private pickByWeight(weighted: Array<{ id: number; w: number }>, r?: number): number | null {
    if (weighted.length === 0) {
      return null;
    }
    const sum = weighted.reduce((acc, e) => acc + e.w, 0);
    if (sum <= 0) {
      return weighted[weighted.length - 1].id;
    }
    let x = r ?? Math.random() * sum;
    for (const e of weighted) {
      if (x < e.w) {
        return e.id;
      }
      x -= e.w;
    }
    return weighted[weighted.length - 1].id;
  }

  /**
   * 加权随机抽一道：候选池 = baseWhere 且不在防重窗口/禁抽表内。
   * 池内大部分题无答对记录（权重 1）；少量高答对题按 masteryWeight 降权。
   * 先按总权重掷点决定落在「普通池」还是「高答对池」，再在对应池内选题，
   * 只需 count + 一次 limit 查询，不把全量 id 拉进内存。
   */
  private async pickWeightedSentence(
    baseWhere: Record<string, unknown>,
    excludeIds: number[],
    entries: MasteryEntry[],
  ): Promise<number | null> {
    const notInBase = [...excludeIds];
    const candidateWhere: Record<string, unknown> = { ...baseWhere };
    if (notInBase.length > 0) {
      candidateWhere.id = { notIn: notInBase.map((id) => BigInt(id)) };
    }
    const total = await this.prisma.sentence.count({ where: candidateWhere });
    if (total === 0) {
      return null;
    }
    // entries 已过滤为候选池内（匹配 baseWhere、非防重、非禁抽），故必然 ⊆ 候选池
    const weighted = entries.map((e) => ({ id: e.sentenceId, w: this.masteryWeight(e.correctCount) }));
    const normalCount = total - entries.length;
    const totalWeight = normalCount + weighted.reduce((acc, e) => acc + e.w, 0);
    if (totalWeight <= 0) {
      return null;
    }
    let r = Math.random() * totalWeight;
    if (r < normalCount && normalCount > 0) {
      // 落在普通池：均匀随机（count + 随机 offset）
      const normalWhere: Record<string, unknown> = { ...candidateWhere };
      const notIn = [...notInBase, ...entries.map((e) => e.sentenceId)];
      normalWhere.id = { notIn: notIn.map((id) => BigInt(id)) };
      const cnt = await this.prisma.sentence.count({ where: normalWhere });
      if (cnt > 0) {
        const offset = Math.floor(Math.random() * cnt);
        const rows = await this.prisma.sentence.findMany({
          where: normalWhere,
          orderBy: { id: 'asc' },
          skip: offset,
          take: 1,
          select: { id: true },
        });
        if (rows[0]) {
          return Number(rows[0].id);
        }
      }
      return this.pickByWeight(weighted);
    }
    r -= normalCount;
    return this.pickByWeight(weighted, r);
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
