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
import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../../common/exception/app.exception.js';
import { config } from '../../../common/config/config.js';
import { FileService } from '../../../common/file/file.service.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { buildPageResult, parsePagination, readNumber } from '../../../common/utils/utils.js';
import type { PageResult } from '../../../common/types.js';
import { CheckinService } from '../checkin/checkin.service.js';
import { GamifyService, XP_RULES } from '../gamify/gamify.service.js';
import { StageService } from '../stage/stage.service.js';
import { AnswerBossDto, AnswerSentenceDto, type AnswerMode } from './dto.js';

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

/** 今日复习计划建议一轮的题数（不做硬性上限，用户可继续刷）。 */
const REVIEW_PLAN_SUGGESTED = 20;
/** 弱点词根统计窗口（与答题记录默认保留天数一致） */
const WEAKNESS_WINDOW_DAYS = 30;
/** 弱点统计单次读取的答题记录上限（防止极端用户在内存里堆太多行） */
const WEAKNESS_MAX_RECORDS = 2000;
/** 功能词：不列入「弱点词根」—— them/very 这类词错一次不代表词根没掌握 */
const WEAKNESS_STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'of',
  'to',
  'in',
  'on',
  'at',
  'for',
  'with',
  'from',
  'by',
  'as',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'am',
  'do',
  'does',
  'did',
  'have',
  'has',
  'had',
  'i',
  'you',
  'he',
  'she',
  'it',
  'we',
  'they',
  'me',
  'him',
  'her',
  'us',
  'them',
  'my',
  'your',
  'his',
  'its',
  'our',
  'their',
  'this',
  'that',
  'these',
  'those',
  'there',
  'here',
  'what',
  'which',
  'who',
  'when',
  'where',
  'why',
  'how',
  'not',
  'no',
  'yes',
  'if',
  'so',
  'than',
  'then',
  'just',
  'very',
  'too',
  'also',
  'up',
  'down',
  'out',
  'over',
  'about',
  'into',
  'can',
  'could',
  'will',
  'would',
  'should',
  'may',
  'might',
  'must',
  'one',
  'two',
  'three',
  'get',
  'got',
  'go',
  'going',
]);

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

/** 今日复习计划中的一条待复习卡（按逾期优先排序）。 */
export interface ReviewPlanItem {
  sentenceId: number;
  translationZh: string;
  imageUrl: string | null;
  categoryName: string | null;
  /** 本次复习到期时间 */
  dueAt: Date;
  /** 是否逾期（早于今天零点） */
  overdue: boolean;
  /** 当前间隔重复等级 */
  level: number;
  /** 上一轮是否答对 */
  lastCorrect: boolean;
}

/** 今日复习计划概览（与「一键开刷」的 source=review 同口径）。 */
export interface ReviewPlan {
  /** 今日到期（含逾期）的独立题数 */
  total: number;
  /** 其中逾期题数 */
  overdue: number;
  /** 今天已完成复习的独立题数 */
  completedToday: number;
  /** 建议一轮复习的题数 */
  suggestedLimit: number;
  /** 按场景分组的待复习题数（降序） */
  byCategory: Array<{ name: string; count: number }>;
  /** 前 N 张待复习卡预览（前端可直接展示，不必再逐题查库） */
  items: ReviewPlanItem[];
}

/** 弱点词根：按错词自动归类后的一个词/词根条目。 */
export interface WeakRootItem {
  /** 归一化后的英文词 */
  word: string;
  /** 该词在本句中的中文释义（题库逐词释义 JSON；没有则 null） */
  meaning: string | null;
  /** 词根词典命中时的解析摘要（未收录则 null） */
  rootAnalysis: string | null;
  /** 近 30 天答错次数 */
  wrongCount: number;
  /** 近 30 天总作答次数 */
  totalCount: number;
  /** 上次答错时间 */
  lastWrongAt: Date;
  /** 典型错题例句（最多 3 条，只包含答错记录） */
  examples: Array<{
    sentenceId: number;
    translationZh: string;
    imageUrl: string | null;
    userAnswer: string | null;
  }>;
}

/** 弱点词根报告。 */
export interface WeaknessReport {
  /** 统计窗口（天） */
  windowDays: number;
  /** 窗口内答错总次数 */
  totalWrong: number;
  items: WeakRootItem[];
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
   * 只听发音（TTS）用的原文：盲听模式下题面不给中文题干，
   * 前端只朗读这个字符串、**不渲染成文字**——答案文本绝不能出现在 DOM 里。
   * 与 words 同理：都是给「作答」而非「阅读」用。
   */
  ttsText: string;
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

/** 每日 Boss：当天固定一道挑战题（难度 3 优先），答对给额外经验（一天一次）。 */
export interface BossToday {
  /** 东八区日期（Boss 按此日切题） */
  date: string;
  /** 今天是否已通关 */
  cleared: boolean;
  /** 通关额外经验（与作答经验叠加） */
  bonusXp: number;
  /** 题目（不含英文原句，与刷题同口径）；池子为空时为 null */
  question: {
    sentenceId: number;
    translationZh: string;
    ipa: string | null;
    imageUrl: string | null;
    difficulty: number;
    categoryName: string | null;
  } | null;
}

/** Boss 作答结果：在普通作答结果上叠加通关信息。 */
export interface BossAnswerResult extends AnswerResult {
  /** 本次是否首次通关（已通关后再答为 false） */
  bossCleared: boolean;
  /** 本次获得的 Boss 额外经验（0 = 未答对 / 今天已领过） */
  bossBonus: number;
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
  /** 历史记录专用：本次作答是否正确（listHistory / listReview 返回） */
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
/** 东八区偏移（Boss 按自然日切题、按日幂等，必须与服务端其它日期口径一致）。 */
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 东八区日期键（YYYY-MM-DD）。 */
function shanghaiDateKey(): string {
  return new Date(Date.now() + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
}

/** 东八区今天零点（复习计划的「逾期」分界线）。 */
function shanghaiDayStart(): Date {
  const now = new Date(Date.now() + SHANGHAI_OFFSET_MS);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - SHANGHAI_OFFSET_MS);
}

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
  // 盲听模式：题干不给，只靠听发音写整句——难度不低于默写，按标准规则发放
  listen: {
    first: 'answer_correct_first',
    review: 'answer_correct_review',
    wrong: 'answer_wrong',
  },
};

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
    private readonly checkinService: CheckinService,
    private readonly gamify: GamifyService,
    private readonly stage: StageService,
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
   * @param source 抽题来源偏好：`review` 只抽到期复习题（复习要成串才有效果）、
   *   `new` 只抽新题；不传走日常混抽。节日/场景专项优先于此参数。
   */
  async next(
    userId: number,
    difficulty?: number,
    festival?: string,
    categoryId?: number,
    source?: 'review' | 'new',
    /** 内部递归用：已判定缺图、本轮要排除的题 id（外部不要传）。 */
    missingImageExcludes: number[] = [],
  ): Promise<NextQuestion> {
    const recentIds = [
      ...(await this.recentSentenceIds(userId, config.sentence.antiRepeatWindow)),
      ...missingImageExcludes,
    ];
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
      return this.buildChecked(
        userId,
        festivalSentenceId,
        'new',
        difficulty,
        festival,
        categoryId,
        source,
        missingImageExcludes,
      );
    }

    // 场景题库：专门刷题——只在该场景当前（未退场）的题库里抽
    if (categoryId && categoryId > 0) {
      const categorySentenceId = await this.pickCategorySentence(categoryId, recentIds, mastery);
      if (categorySentenceId === null) {
        throw AppException.notFound('该场景题库暂无可用题目');
      }
      return this.buildChecked(
        userId,
        categorySentenceId,
        'new',
        difficulty,
        festival,
        categoryId,
        source,
        missingImageExcludes,
      );
    }

    // 「复习中心」一键开刷：只走一侧，不给概率。
    // 复习要成串才有效果——从「今日待复习 N」点进来的用户期待一路都是到期复习题，
    // 混入新题会把间隔重复的安排冲散（刷两张就散，等于没复习）。
    if (source === 'review') {
      const reviewId = await this.pickDueReviewSentence(userId, recentIds);
      if (reviewId === null) {
        throw AppException.notFound('今日没有到期要复习的题，去刷点新题吧');
      }
      return this.buildChecked(
        userId,
        reviewId,
        'review',
        difficulty,
        festival,
        categoryId,
        source,
        missingImageExcludes,
      );
    }
    if (source === 'new') {
      let newId = await this.pickReadySentence(recentIds, difficulty, mastery);
      // 指定难度下没有可用新题：回落到不限难度，避免用户被卡住
      if (newId === null && difficulty) {
        newId = await this.pickReadySentence(recentIds, undefined, mastery);
      }
      if (newId === null) {
        throw AppException.notFound('暂无可用的新题，稍后再来');
      }
      return this.buildChecked(userId, newId, 'new', difficulty, festival, categoryId, source, missingImageExcludes);
    }

    const wantNew = Math.random() < config.sentence.newRatio;

    let sentenceId: number | null;
    let pickedSource: 'new' | 'review';
    if (wantNew) {
      sentenceId = await this.pickReadySentence(recentIds, difficulty, mastery);
      pickedSource = 'new';
      // 指定难度下没有可用新题：回落到不限难度，避免用户被卡住
      if (sentenceId === null && difficulty) {
        sentenceId = await this.pickReadySentence(recentIds, undefined, mastery);
      }
      if (sentenceId === null) {
        sentenceId = await this.pickDueReviewSentence(userId, recentIds);
        pickedSource = 'review';
      }
    } else {
      sentenceId = await this.pickDueReviewSentence(userId, recentIds);
      pickedSource = 'review';
      if (sentenceId === null) {
        sentenceId = await this.pickReadySentence(recentIds, difficulty, mastery);
        pickedSource = 'new';
        if (sentenceId === null && difficulty) {
          sentenceId = await this.pickReadySentence(recentIds, undefined, mastery);
        }
      }
    }
    if (sentenceId === null) {
      throw AppException.notFound('暂无可用题目，休息一下 or 等待每日更新');
    }
    return this.buildChecked(
      userId,
      sentenceId,
      pickedSource,
      difficulty,
      festival,
      categoryId,
      source,
      missingImageExcludes,
    );
  }

  /**
   * 抽题末端校验：题目选好后、组卡前，确认配图物理文件还在磁盘上。
   *
   * 背景：抽题 SQL 已过滤 `imageFileId > 0`，但拦不住「sys_file 记录还在、
   * 磁盘 webp 被 git clean / 卷重置清掉」——那样会下发一张破图卡。
   * 校验到缺图就把该题加入排除集、递归重抽（最多 8 次，避免整库缺图时死循环）；
   * 超限后仍返回该题，由前端 @error 降级兜底，绝不 404 卡死用户。
   */
  private async buildChecked(
    userId: number,
    sentenceId: number,
    pickedSource: 'new' | 'review',
    difficulty: number | undefined,
    festival: string | undefined,
    categoryId: number | undefined,
    source: 'review' | 'new' | undefined,
    excludes: number[],
  ): Promise<NextQuestion> {
    // 先拿到 imageFileId（buildNextQuestion 里也要查，这里复用同一条查询的思路）
    const row = await this.prisma.sentence.findUnique({
      where: { id: BigInt(sentenceId) },
      select: { imageFileId: true },
    });
    const imageOk = row && row.imageFileId > 0n ? await this.fileService.existsOnDisk(Number(row.imageFileId)) : false;
    if (!imageOk && excludes.length < 8) {
      return this.next(userId, difficulty, festival, categoryId, source, [...excludes, sentenceId]);
    }
    return this.buildNextQuestion(userId, sentenceId, pickedSource);
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
      ttsText: sentence.sentenceEn,
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
        // 情景闯关：按分类推进关卡进度，需要场景名定位剧情
        categoryId: true,
        category: { select: { name: true } },
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
    // 情景闯关进度：答对才推进。进度单独落库（答题记录只留 30 天，派生会让关卡倒退）；
    // 这一笔是附加统计，写失败不该让用户看到「提交失败」，故旁路吞掉只记日志。
    await this.stage
      .recordAnswer(userId, Number(sentence.categoryId), sentence.category.name, isCorrect)
      .catch((error: unknown) => {
        this.logger.warn(`情景闯关进度写入失败（不影响答题）：${String(error)}`);
      });

    // 微游戏化：按作答质量与模式发 XP（服务端权威 + event_key 幂等），并尝试解锁成就
    // 模式只决定用哪组规则，经验值恒由服务端算——拼词约为默写六成，盲听按默写标准
    const rule = XP_EVENT[dto.mode ?? 'input'];
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

  /**
   * 每日 Boss：按日期**确定性**选一道题（同一天所有人同一题，换天换题）。
   *
   * 为什么确定性而不是随机：Boss 要有仪式感，也便于分享「今天这道」；
   * 随机抽会让同一天刷新出不同题，体验不一致。难度 3 优先，池空逐级回落。
   */
  async getBoss(userId: number): Promise<BossToday> {
    const date = shanghaiDateKey();
    const cleared = await this.isBossCleared(userId, date);
    const boss = await this.pickBossSentence(date);
    return {
      date,
      cleared,
      bonusXp: XP_RULES.boss_clear,
      question: boss
        ? {
            sentenceId: Number(boss.id),
            translationZh: boss.translationZh,
            ipa: boss.ipa,
            imageUrl: boss.imageFileId > 0n ? await this.resolveImageUrl(Number(boss.imageFileId)) : null,
            difficulty: boss.difficulty,
            categoryName: boss.category?.name ?? null,
          }
        : null,
    };
  }

  /** 今天的 Boss 是否已通关（与发经验同一条幂等键，避免两套口径漂移）。 */
  private async isBossCleared(userId: number, date: string): Promise<boolean> {
    const row = await this.prisma.clientXpLog.findUnique({
      where: { eventKey: `boss:${userId}:${date}` },
      select: { id: true },
    });
    return row !== null;
  }

  /** 按日期选 Boss 题：同一天恒定、换天换题；难度 3 → 2 → 1 逐级回落。 */
  private async pickBossSentence(date: string) {
    const dayNumber = Math.floor(Date.parse(`${date}T00:00:00+08:00`) / 86400000);
    for (const difficulty of [3, 2, 1]) {
      const where = { status: 'ready' as const, retiredAt: null, difficulty };
      const count = await this.prisma.sentence.count({ where });
      if (count === 0) {
        continue;
      }
      const rows = await this.prisma.sentence.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: dayNumber % count,
        take: 1,
        select: {
          id: true,
          translationZh: true,
          ipa: true,
          imageFileId: true,
          difficulty: true,
          category: { select: { name: true } },
        },
      });
      if (rows[0]) {
        return rows[0];
      }
    }
    return null;
  }

  /**
   * 提交 Boss 答案：判分/记录/间隔重复/成就**完全复用** `answer()`，
   * 仅在此基础上补一份「通关」额外经验（按日期幂等，一天一次）。
   * 这样 Boss 不会成为第二套判分逻辑——口径永远与刷题一致。
   */
  async answerBoss(userId: number, sentenceId: number, dto: AnswerBossDto): Promise<BossAnswerResult> {
    const date = shanghaiDateKey();
    const boss = await this.pickBossSentence(date);
    if (!boss) {
      throw AppException.notFound('今日暂无 Boss 题');
    }
    if (boss.id !== BigInt(sentenceId)) {
      throw AppException.badRequest('这不是今天的 Boss 题');
    }
    const result = await this.answer(userId, sentenceId, {
      userAnswer: dto.userAnswer,
      mode: 'input',
    });
    let bossCleared = false;
    let bossBonus = 0;
    if (result.isCorrect) {
      const awarded = await this.gamify.awardXp(userId, 'boss_clear', `boss:${userId}:${date}`, XP_RULES.boss_clear);
      if (awarded) {
        bossCleared = true;
        bossBonus = XP_RULES.boss_clear;
      }
    }
    return { ...result, xpEarned: result.xpEarned + bossBonus, bossCleared, bossBonus };
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
    // 复习池 = 所有到期该复习的题（答错当天复现 + 答对按间隔到期），
    // 与 memory-stats 的「今日待复习」同一口径——否则用户在记忆健康卡片看到
    // 「N 题待复习」、点进来却是另一批题，数字对不上就等于没打通。
    //
    // `kind=wrong` 只看错题（用户口中的「错题本」）：不新增页面，作为复习池的
    // 筛选维度，避免为「错题」再造一个入口、加重导航负担。
    const kind = query.kind === 'wrong' ? 'wrong' : 'all';
    const where = {
      userId: BigInt(userId),
      nextReviewAt: { lte: new Date() },
      ...(kind === 'wrong' ? { isCorrect: 0 } : {}),
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
          isCorrect: true,
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
        // 复习池现在含两类题：答错（当天复现）与答对（间隔到期巩固）
        isCorrect: row.isCorrect === 1,
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
    // 到期即该复习，不分答对答错：
    // - 答错：nextReviewAt 恒为当天（当天立即复现，见 answer 的排期逻辑）
    // - 答对：按间隔重复排期（1/3/7/N 天后），到期正是巩固时点
    // 历史上这里写死 isCorrect: 0，结果「答对且到期」的题谁都抽不到——
    // 记忆健康页的待复习数字由此而来，用户却永远刷不到，曲线成了摆设。
    const where: Record<string, unknown> = {
      userId: BigInt(userId),
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

    const distribution = Array.from<number>({ length: 30 }).fill(0);
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

  /**
   * 导出收藏句子给 Anki（全量、不分页）。
   * 按收藏时间倒序；上限 5000 条保护（收藏超过这个量级 Anki 导入也不现实）。
   */
  async exportFavoritesForAnki(userId: number): Promise<Array<{ en: string; zh: string; ipa: string }>> {
    const rows = await this.prisma.sentenceFavorite.findMany({
      where: { userId: BigInt(userId) },
      orderBy: { createdAt: 'desc' },
      take: 5000,
      select: {
        sentence: { select: { sentenceEn: true, translationZh: true, ipa: true } },
      },
    });
    return rows
      .filter((row) => row.sentence)
      .map((row) => ({
        en: row.sentence.sentenceEn,
        zh: row.sentence.translationZh,
        ipa: row.sentence.ipa ?? '',
      }));
  }

  /**
   * 今日复习计划：从「已到期」的间隔重复排期里按题去重，按逾期优先列出待复习卡。
   *
   * 与 `next(source=review)` 同一候选条件（到期 + 题目就绪 + 有配图），
   * 所以这里显示「待复习 N」时，一键开刷不会刷到另一批题。
   * 预览只取前 limit 张，total 统计最多 max(300, limit*10) 道独立题（再多一轮也刷不完）。
   */
  async getReviewPlan(userId: number, limit = REVIEW_PLAN_SUGGESTED): Promise<ReviewPlan> {
    const uid = BigInt(userId);
    const now = new Date();
    const dayStart = shanghaiDayStart();
    const take = Math.max(300, limit * 10);
    const rows = await this.prisma.sentenceRecord.findMany({
      where: {
        userId: uid,
        nextReviewAt: { lte: now },
        sentence: { status: 'ready', retiredAt: null, imageFileId: { gt: 0n } },
      },
      // 到期时间倒序：同一题多次到期时先取最新那排期（答对会往后推、答错会重置为当天）
      orderBy: [{ nextReviewAt: 'desc' }, { id: 'desc' }],
      take: take * 3,
      select: {
        sentenceId: true,
        isCorrect: true,
        reviewLevel: true,
        nextReviewAt: true,
        sentence: {
          select: {
            translationZh: true,
            imageFileId: true,
            category: { select: { name: true } },
          },
        },
      },
    });

    // 按题去重；take*3 只是给「同题多记录」留余量，最终仍只保留 take 道独立题
    const latest = new Map<number, (typeof rows)[number]>();
    for (const row of rows) {
      const id = Number(row.sentenceId);
      if (!latest.has(id)) {
        latest.set(id, row);
      }
      if (latest.size >= take) {
        break;
      }
    }

    const categoryCount = new Map<string, number>();
    let overdue = 0;
    const ordered = [...latest.entries()]
      .map(([sentenceId, row]) => {
        const dueAt = row.nextReviewAt ?? now;
        const isOverdue = dueAt.getTime() < dayStart.getTime();
        if (isOverdue) {
          overdue += 1;
        }
        const name = row.sentence?.category?.name ?? '未分类';
        categoryCount.set(name, (categoryCount.get(name) ?? 0) + 1);
        return {
          sentenceId,
          translationZh: row.sentence?.translationZh ?? '',
          imageFileId: row.sentence?.imageFileId ?? 0n,
          categoryName: row.sentence?.category?.name ?? null,
          dueAt,
          overdue: isOverdue,
          level: row.reviewLevel,
          lastCorrect: row.isCorrect === 1,
        };
      })
      .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.dueAt.getTime() - b.dueAt.getTime());

    // 今日已复习的独立题数（同一题今天答两次只算一次）
    const todayRows = await this.prisma.sentenceRecord.findMany({
      where: { userId: uid, createdAt: { gte: dayStart } },
      take: 1000,
      select: { sentenceId: true },
    });
    const completedToday = new Set(todayRows.map((row) => Number(row.sentenceId))).size;

    const items: ReviewPlanItem[] = await Promise.all(
      ordered.slice(0, limit).map(async (item) => ({
        sentenceId: item.sentenceId,
        translationZh: item.translationZh,
        imageUrl: item.imageFileId > 0n ? await this.resolveImageUrl(Number(item.imageFileId)) : null,
        categoryName: item.categoryName,
        dueAt: item.dueAt,
        overdue: item.overdue,
        level: item.level,
        lastCorrect: item.lastCorrect,
      })),
    );

    return {
      total: latest.size,
      overdue,
      completedToday,
      suggestedLimit: REVIEW_PLAN_SUGGESTED,
      byCategory: [...categoryCount.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      items,
    };
  }

  /**
   * 弱点词根：近 30 天答错的句子按「词」自动归类，按错次排序。
   *
   * 为什么按词而不是整句：同一词根会在多个句子里反复错（unavoidable / avoid），
   * 整句错题本看不到这个规律；按词聚合后能直接看到「哪几个词最该补」。
   * 中文释义优先取题库的逐词释义 JSON；词根词典命中时再附解析摘要（未收录也能用）。
   */
  async getWeakness(userId: number, limit = 20): Promise<WeaknessReport> {
    const since = new Date(Date.now() - WEAKNESS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.sentenceRecord.findMany({
      where: { userId: BigInt(userId), createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: WEAKNESS_MAX_RECORDS,
      select: {
        isCorrect: true,
        userAnswer: true,
        createdAt: true,
        sentence: {
          select: {
            id: true,
            sentenceEn: true,
            translationZh: true,
            imageFileId: true,
            wordMeanings: true,
          },
        },
      },
    });

    interface WeakStat {
      wrongCount: number;
      totalCount: number;
      lastWrongAt: Date;
      meaning: string | null;
      examples: Array<{
        sentenceId: number;
        translationZh: string;
        imageUrl: string | null;
        userAnswer: string | null;
      }>;
      fileIds: number[];
    }
    const stats = new Map<string, WeakStat>();
    const meaningsBySentence = new Map<number, Record<string, string> | null>();
    let totalWrong = 0;

    for (const row of rows) {
      const sentence = row.sentence;
      if (!sentence?.sentenceEn) {
        continue;
      }
      const sentenceId = Number(sentence.id);
      if (!meaningsBySentence.has(sentenceId)) {
        meaningsBySentence.set(sentenceId, this.parseWordMeanings(sentence.wordMeanings));
      }
      const meanings = meaningsBySentence.get(sentenceId);
      const isWrong = row.isCorrect === 0;
      if (isWrong) {
        totalWrong += 1;
      }
      const words = sentence.sentenceEn
        .toLowerCase()
        .match(/[a-z]+(?:'[a-z]+)?/g)
        ?.filter((word) => word.length >= 3 && !WEAKNESS_STOPWORDS.has(word));
      if (!words?.length) {
        continue;
      }
      for (const word of new Set(words)) {
        let stat = stats.get(word);
        if (!stat) {
          stat = {
            wrongCount: 0,
            totalCount: 0,
            lastWrongAt: row.createdAt,
            meaning: meanings?.[word] ?? null,
            examples: [],
            fileIds: [],
          };
          stats.set(word, stat);
        }
        stat.totalCount += 1;
        if (!stat.meaning && meanings?.[word]) {
          stat.meaning = meanings[word];
        }
        if (isWrong) {
          stat.wrongCount += 1;
          if (stat.examples.length < 3) {
            stat.examples.push({
              sentenceId,
              translationZh: sentence.translationZh,
              imageUrl: null,
              userAnswer: row.userAnswer,
            });
            stat.fileIds.push(Number(sentence.imageFileId));
          }
          if (row.createdAt.getTime() > stat.lastWrongAt.getTime()) {
            stat.lastWrongAt = row.createdAt;
          }
        }
      }
    }

    const top = [...stats.entries()]
      .filter(([, stat]) => stat.wrongCount > 0)
      .sort(
        (a, b) =>
          b[1].wrongCount - a[1].wrongCount ||
          b[1].wrongCount / b[1].totalCount - a[1].wrongCount / a[1].totalCount ||
          a[0].localeCompare(b[0]),
      )
      .slice(0, limit);

    // 只对最终展示的少量词查词根词典（未收录不影响归类）
    const dictionary = await this.prisma.wordRoot.findMany({
      where: { word: { in: top.map(([word]) => word) } },
      select: { word: true, analysis: true },
    });
    const analysisByWord = new Map<string, string | null>();
    for (const entry of dictionary) {
      const analysis = entry.analysis as { explanation?: unknown } | null;
      const text = analysis && typeof analysis.explanation === 'string' ? analysis.explanation.trim() : '';
      analysisByWord.set(entry.word, text ? text.slice(0, 200) : null);
    }

    const items: WeakRootItem[] = await Promise.all(
      top.map(async ([word, stat]) => ({
        word,
        meaning: stat.meaning,
        rootAnalysis: analysisByWord.get(word) ?? null,
        wrongCount: stat.wrongCount,
        totalCount: stat.totalCount,
        lastWrongAt: stat.lastWrongAt,
        examples: await Promise.all(
          stat.examples.map(async (example, index) => {
            const fileId = stat.fileIds[index] ?? 0;
            return {
              ...example,
              imageUrl: fileId > 0 ? await this.resolveImageUrl(fileId) : null,
            };
          }),
        ),
      })),
    );

    return { windowDays: WEAKNESS_WINDOW_DAYS, totalWrong, items };
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
