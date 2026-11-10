/**
 * 情景闯关服务（关卡 = 场景分类，玩法 = 场景长对话）。
 *
 * 2026-11-09 改造：从「在该场景答对 N 句」改为 **AI 角色扮演长对话**。
 * - 每个关卡是一段场景：用户扮演 userRole，与 1~3 个 AI 角色围绕 goal 对话；
 * - 通关 = 聊够 minTurns 轮 **且** AI 判定目标达成；达到 maxTurns 仍未达成则结束但可重来；
 * - 解锁规则不变（每章首关默认解锁，章内顺序解锁），但**只认对话通关**
 *   （study_stage_progress.dialogueClearedAt）；旧版答对计数只作历史展示。
 * - 奖励幂等仍复用 GamifyService 的 `stage:{userId}:{categoryId}`。
 */
import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { isFestivalName } from '../../../common/calendar/festivals.js';
import { AgnesImageProvider } from '../../../common/ai/agnes-image.provider.js';
import { FileService } from '../../../common/file/file.service.js';
import { config } from '../../../common/config/config.js';
import {
  AgnesSentenceProvider,
  type StageDialogueHint,
  type StageDialogueReply,
  type StageDialogueSummary,
} from '../../../common/ai/agnes-sentence.provider.js';
import { withRetry } from '../../../common/ai/concurrency.js';
import { AppException } from '../../../common/exception/app.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { GamifyService } from '../gamify/gamify.service.js';
import {
  STAGE_CHAPTERS,
  STAGE_COVER_STYLE_SUFFIX,
  STAGE_STORIES,
  stageRoleOf,
  type StageLine,
  type StageRole,
  type StageStory,
} from './stage-stories.js';

/** 场景角色（下发前端展示）。 */
export interface StageRoleView {
  nameEn: string;
  name: string;
  emoji: string;
}

/** 单关视图。 */
export interface StageView {
  /** 关卡 id = 场景分类 id */
  id: number;
  name: string;
  nameEn: string | null;
  icon: string | null;
  title: string;
  intro: string;
  outro: string;
  /** 本关对话目标 */
  goal: string;
  /** 通关所需最少用户轮数 */
  minTurns: number;
  /** 硬上限轮数 */
  maxTurns: number;
  roles: StageRoleView[];
  rewardXp: number;
  /** 是否已通关（对话口径） */
  cleared: boolean;
  /** 是否已解锁 */
  unlocked: boolean;
  /** 奖励是否已领取 */
  claimed: boolean;
  /** 进度百分比（通关 100；进行中按轮数估算，封顶 90） */
  progress: number;
  /** 最近一次通关对话的轮数 */
  turns: number;
  /** 旧版「答对句数」（仅历史展示，不再决定通关） */
  legacyCorrectCount: number;
  /** @deprecated 兼容 Android 旧版关卡页：新口径下等于 minTurns */
  target: number;
  /** @deprecated 兼容 Android 旧版关卡页：新口径下等于当前会话轮数 */
  correctCount: number;
  /** @deprecated 兼容 Android 旧版关卡页 */
  answerCount: number;
  /** @deprecated 兼容 Android 旧版关卡页：该场景就绪题数 */
  bankCount: number;
  /** 进行中的会话 id（没有则 null） */
  activeSessionId: number | null;
}

/** 章节视图。 */
export interface StageChapterView {
  key: string;
  name: string;
  subtitle: string;
  /** AI 生成的封面图 URL；未生成时为 null（前端回落到渐变+emoji） */
  coverUrl: string | null;
  stages: StageView[];
  clearedCount: number;
  total: number;
}

/** 闯关总览。 */
export interface StageOverview {
  chapters: StageChapterView[];
  clearedStages: number;
  totalStages: number;
  /** 已解锁但未通关的关卡数 */
  activeStages: number;
  /** 可领取奖励的关卡数 */
  claimable: number;
  /** 当前推荐关卡（第一个已解锁未通关） */
  recommendedId: number | null;
}

/** 一句对话消息。 */
export interface StageDialogueMessageView {
  id: number;
  role: 'npc' | 'user';
  speaker: string | null;
  contentEn: string;
  contentZh: string | null;
  createdAt: string;
}

/** 对话会话视图（进入关卡时返回）。 */
export interface StageDialogueView {
  sessionId: number;
  status: string;
  turnCount: number;
  goalReached: boolean;
  cleared: boolean;
  /** 当前是否显示中文翻译（用户偏好，刷新后回显） */
  showTranslation: boolean;
  /** 当前候选英文短句（含中文；续聊/刷新时回显，避免丢失） */
  hints: StageDialogueHint[];
  title: string;
  intro: string;
  goal: string;
  minTurns: number;
  maxTurns: number;
  roles: StageRoleView[];
  messages: StageDialogueMessageView[];
  summary: string | null;
  feedback: StageDialogueSummary | null;
}

/** 一轮对话的结果。 */
export interface StageTurnResult {
  replies: StageDialogueReply[];
  turnCount: number;
  goalReached: boolean;
  ended: boolean;
  cleared: boolean;
  /** 本轮模型给出的候选英文短句（含中文，动态更新） */
  hints: StageDialogueHint[];
  summary: string | null;
  feedback: StageDialogueSummary | null;
}

/** 通关奖励的 XP 幂等键。 */
function claimKey(userId: number, categoryId: number): string {
  return `stage:${userId}:${categoryId}`;
}

/** 无翻译通关加成的 XP 幂等键（与基础奖励分开，避免重复领取时互相吞掉）。 */
function bonusKey(userId: number, categoryId: number): string {
  return `stage-bonus:${userId}:${categoryId}`;
}

/** 无翻译通关的额外经验比例（在基础奖励之上再加 50%）。 */
const NO_TRANSLATION_BONUS_RATIO = 0.5;

/** 从 DB 存的 JSON 字符串还原复盘（坏数据不影响会话读取）。 */
function parseFeedback(raw: string | null): StageDialogueSummary | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StageDialogueSummary;
    return typeof parsed.summary === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 从 DB 存的 JSON 字符串还原候选短句。
 * 兼容旧数据：存量 `last_hints` 是纯字符串数组，映射成 `{en, zh: ''}`——
 * zh 为空时前端不显示悬停翻译，而不是把候选丢掉。坏数据回落到剧情 starterHints。
 */
function parseHints(raw: string | null, fallback: StageDialogueHint[]): StageDialogueHint[] {
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const out: StageDialogueHint[] = [];
      for (const item of parsed) {
        if (out.length >= 3) break;
        if (typeof item === 'string') {
          const en = item.trim();
          if (en && /[A-Za-z]/.test(en)) out.push({ en: en.slice(0, 80), zh: '' });
          continue;
        }
        if (typeof item !== 'object' || item === null) continue;
        const { en, zh } = item as Record<string, unknown>;
        if (typeof en === 'string' && en.trim() && /[A-Za-z]/.test(en)) {
          out.push({ en: en.trim().slice(0, 80), zh: typeof zh === 'string' ? zh.trim().slice(0, 100) : '' });
        }
      }
      if (out.length > 0) return out;
    }
  } catch {
    // 落到 fallback
  }
  return fallback;
}

@Injectable()
export class StageService {
  private readonly logger = new Logger(StageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gamify: GamifyService,
    private readonly ai: AgnesSentenceProvider,
    private readonly imageGen: AgnesImageProvider,
    private readonly fileService: FileService,
  ) {}

  /** 闯关地图：章节 + 关卡 + 我的对话进度。 */
  async getStages(userId: number): Promise<StageOverview> {
    const uid = BigInt(userId);
    const [categories, progresses, claims, activeSessions, bankCounts, coverUrls, stories] = await Promise.all([
      this.prisma.sentenceCategory.findMany({
        where: { status: 1 },
        orderBy: [{ sort: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true, nameEn: true, icon: true },
      }),
      this.prisma.studyStageProgress.findMany({
        where: { userId: uid },
        select: { categoryId: true, correctCount: true, dialogueClearedAt: true, dialogueTurns: true },
      }),
      this.prisma.clientXpLog.findMany({
        where: { userId: uid, eventKey: { startsWith: `stage:${userId}:` } },
        select: { eventKey: true },
      }),
      this.prisma.stageDialogueSession.findMany({
        where: { userId: uid, status: 'active' },
        select: { id: true, categoryId: true, turnCount: true },
      }),
      // 兼容 Android 旧版关卡页（按场景可刷题数决定是否显示「去练习」）
      this.prisma.sentence.groupBy({
        by: ['categoryId'],
        where: { status: 'ready', retiredAt: null, imageFileId: { gt: 0n } },
        _count: { _all: true },
      }),
      // 章节封面：一章一张 AI 图，已生成则下发 URL，前端有图用图、无图回落渐变+emoji
      this.coverUrlMapOf(),
      // 关卡剧情：从 stage_story 表读（启用的），章内按 sort 排序
      this.listStories(1),
    ]);

    const categoryByName = new Map(categories.filter((row) => !isFestivalName(row.name)).map((row) => [row.name, row]));
    const progressByCategory = new Map(progresses.map((row) => [String(row.categoryId), row]));
    const claimedSet = new Set(claims.map((row) => row.eventKey));
    const activeByCategory = new Map(activeSessions.map((row) => [String(row.categoryId), row]));
    const bankByCategory = new Map(bankCounts.map((row) => [String(row.categoryId), row._count._all]));

    const chapters: StageChapterView[] = [];
    let clearedStages = 0;
    let activeStages = 0;
    let claimable = 0;
    let recommendedId: number | null = null;

    for (const chapter of STAGE_CHAPTERS) {
      const storiesOfChapter = stories.filter((item) => item.chapter === chapter.key);
      const stages: StageView[] = [];
      // 章内顺序解锁：上一关未通关，下一关锁住
      let previousCleared = true;

      for (const story of storiesOfChapter) {
        const category = categoryByName.get(story.category);
        // 分类被删/禁用/改名时跳过该关，而不是造一个点不进去的空关卡
        if (!category) continue;

        const id = Number(category.id);
        const progress = progressByCategory.get(String(category.id));
        const active = activeByCategory.get(String(category.id));
        const cleared = Boolean(progress?.dialogueClearedAt);
        const unlocked = previousCleared;
        const claimed = claimedSet.has(claimKey(userId, id));
        const turns = progress?.dialogueTurns ?? 0;
        const progressPct = cleared ? 100 : Math.min(90, Math.round(((active?.turnCount ?? 0) / story.minTurns) * 100));

        if (cleared) {
          clearedStages += 1;
        } else if (unlocked) {
          activeStages += 1;
          if (recommendedId === null) recommendedId = id;
        }
        if (cleared && !claimed) claimable += 1;

        stages.push({
          id,
          name: category.name,
          nameEn: category.nameEn,
          icon: category.icon,
          title: story.title,
          intro: story.intro,
          outro: story.outro,
          goal: story.goal,
          minTurns: story.minTurns,
          maxTurns: story.maxTurns,
          roles: story.roles.map((role) => ({ nameEn: role.nameEn, name: role.name, emoji: role.emoji })),
          rewardXp: story.rewardXp,
          cleared,
          unlocked,
          claimed,
          progress: progressPct,
          turns,
          legacyCorrectCount: progress?.correctCount ?? 0,
          // ↓ 兼容 Android 旧版关卡页（新口径把「句」换成「轮」）
          target: story.minTurns,
          correctCount: active?.turnCount ?? turns,
          answerCount: active?.turnCount ?? 0,
          bankCount: bankByCategory.get(String(category.id)) ?? 0,
          activeSessionId: active ? Number(active.id) : null,
        });
        previousCleared = cleared;
      }

      if (stages.length > 0) {
        chapters.push({
          key: chapter.key,
          name: chapter.name,
          subtitle: chapter.subtitle,
          coverUrl: coverUrls.get(chapter.key) ?? null,
          stages,
          clearedCount: stages.filter((item) => item.cleared).length,
          total: stages.length,
        });
      }
    }

    return {
      chapters,
      clearedStages,
      // STAGE_TOTAL 曾是代码常量 STAGE_STORIES.length；故事迁到 stage_story 表后，总数以启用关卡数为准
      totalStages: chapters.reduce((sum, item) => sum + item.total, 0),
      activeStages,
      claimable,
      recommendedId,
    };
  }

  /* ------------------------------ 章节封面（AI 生图） ------------------------------ */

  /** 章节 key → 封面 URL 映射（未生成为缺席；file 记录被删则视为 null）。 */
  private async coverUrlMapOf(): Promise<Map<string, string>> {
    const rows = await this.prisma.stageChapterCover.findMany({
      where: { chapterKey: { in: STAGE_CHAPTERS.map((item) => item.key) } },
      select: { chapterKey: true, fileId: true },
    });
    const map = new Map<string, string>();
    for (const row of rows) {
      const url = await this.coverUrlOf(row.fileId);
      if (url) map.set(row.chapterKey, url);
    }
    return map;
  }

  /** 由文件 id 解析封面访问 URL（0/缺失返回 null）。 */
  private async coverUrlOf(fileId: bigint): Promise<string | null> {
    if (fileId <= 0n) return null;
    const file = await this.fileService.findById(Number(fileId));
    return file?.fileUrl ?? null;
  }

  /**
   * 生成（或重新生成）某章封面：AI 生图 → sharp 转 webp → file 表落盘 →
   * stage_chapter_cover 按 chapter_key 唯一 upsert（重复生成覆盖旧图引用）。
   * @param regenerate 为 true 时即使已有封面也强制重生成
   */
  async generateChapterCover(
    chapterKey: string,
    regenerate = false,
  ): Promise<{ chapterKey: string; coverUrl: string }> {
    const chapter = STAGE_CHAPTERS.find((item) => item.key === chapterKey);
    if (!chapter) throw AppException.notFound(`章节不存在：${chapterKey}`);

    const existing = await this.prisma.stageChapterCover.findUnique({ where: { chapterKey } });
    if (existing && !regenerate) {
      const url = await this.coverUrlOf(existing.fileId);
      if (url) return { chapterKey, coverUrl: url };
      // file 记录已被删但封面行还在：落下去重生成
      this.logger.warn(`[Stage] 章节 ${chapterKey} 的封面文件缺失，重新生成`);
    }

    const prompt = `${chapter.coverPrompt}, ${STAGE_COVER_STYLE_SUFFIX}`;
    const image = await withRetry(
      () =>
        this.imageGen.generate(prompt, {
          size: config.stage.coverSize,
          ratio: config.stage.coverRatio,
        }),
      { maxAttempts: 4, baseDelayMs: 5000, maxDelayMs: 30000 },
    );
    const webp = await sharp(image.buffer)
      .resize({ width: config.stage.coverMaxWidth, withoutEnlargement: true })
      .webp({ quality: config.stage.coverQuality })
      .toBuffer();
    const saved = await this.fileService.save(`stage-cover-${chapterKey}.webp`, 'image/webp', webp, null);

    const row = await this.prisma.stageChapterCover.upsert({
      where: { chapterKey },
      create: { chapterKey, fileId: BigInt(saved.file.id), prompt },
      update: { fileId: BigInt(saved.file.id), prompt },
    });
    const coverUrl = (await this.coverUrlOf(row.fileId)) ?? saved.file.fileUrl;
    this.logger.log(`[Stage] 章节 ${chapterKey}（${chapter.name}）封面生成完成：${coverUrl}`);
    return { chapterKey, coverUrl };
  }

  /**
   * 补齐缺失的章节封面（定时任务用）：只生成「还没有封面行」的章节，
   * 已有封面不覆盖——想换图走后台手动「重新生成」。单章失败不影响其他章。
   */
  async generateMissingChapterCovers(): Promise<{ generated: string[]; skipped: string[]; failed: string[] }> {
    const existing = await this.prisma.stageChapterCover.findMany({
      where: { chapterKey: { in: STAGE_CHAPTERS.map((item) => item.key) } },
      select: { chapterKey: true },
    });
    const has = new Set(existing.map((row) => row.chapterKey));
    const generated: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];
    for (const chapter of STAGE_CHAPTERS) {
      if (has.has(chapter.key)) {
        skipped.push(chapter.key);
        continue;
      }
      try {
        await this.generateChapterCover(chapter.key);
        generated.push(chapter.key);
      } catch (error) {
        failed.push(chapter.key);
        this.logger.error(`[Stage] 章节 ${chapter.key} 封面生成失败：${(error as Error).message}`);
      }
    }
    this.logger.log(
      `[Stage] 封面补生成完成：新增 ${generated.length} 张，跳过 ${skipped.length} 张，失败 ${failed.length} 张`,
    );
    return { generated, skipped, failed };
  }

  /** 后台-封面管理列表：每章一行（含未生成的），带封面 URL 与生成信息。 */
  async adminCovers(): Promise<StageChapterCoverItem[]> {
    const rows = await this.prisma.stageChapterCover.findMany({
      where: { chapterKey: { in: STAGE_CHAPTERS.map((item) => item.key) } },
      select: { chapterKey: true, fileId: true, prompt: true, generatedAt: true },
    });
    const byKey = new Map(rows.map((row) => [row.chapterKey, row]));
    const items: StageChapterCoverItem[] = [];
    for (const chapter of STAGE_CHAPTERS) {
      const row = byKey.get(chapter.key);
      items.push({
        chapterKey: chapter.key,
        chapterName: chapter.name,
        coverUrl: row ? await this.coverUrlOf(row.fileId) : null,
        prompt: row?.prompt ?? chapter.coverPrompt,
        generatedAt: row ? row.generatedAt.toISOString() : null,
      });
    }
    return items;
  }

  /* ------------------------------ 关卡剧情（stage_story 表，后台可 CRUD） ------------------------------ */

  /** 服务启动时用代码种子 STAGE_STORIES 幂等回填 stage_story：category 已存在则跳过，不覆盖运营改动。 */
  async onModuleInit(): Promise<void> {
    const existing = await this.prisma.stageStory.findMany({ select: { category: true } });
    const has = new Set(existing.map((row) => row.category));
    const missing = STAGE_STORIES.filter((item) => !has.has(item.category));
    if (missing.length === 0) return;
    await this.prisma.stageStory.createMany({
      data: missing.map((item) => ({
        chapterKey: item.chapter,
        category: item.category,
        title: item.title,
        intro: item.intro,
        outro: item.outro,
        userRole: item.userRole,
        setting: item.setting,
        goal: item.goal,
        minTurns: item.minTurns,
        maxTurns: item.maxTurns,
        target: item.target,
        rewardXp: item.rewardXp,
        roles: item.roles as never,
        opening: item.opening as never,
        starterHints: item.starterHints as never,
        sort: STAGE_STORIES.indexOf(item) + 1,
      })),
      skipDuplicates: true,
    });
    this.logger.log(`[Stage] stage_story 种子回填 ${missing.length} 条关卡（已有 ${has.size} 条跳过）`);
  }

  /** 读取关卡表并映射为剧情结构。status 传 1 只取启用；排序 = 章节顺序 → sort → id。 */
  private async listStories(status?: number): Promise<StageStory[]> {
    const rows = await this.prisma.stageStory.findMany({
      where: status === undefined ? {} : { status },
    });
    const chapterOrder = new Map(STAGE_CHAPTERS.map((item, index) => [item.key, index]));
    return rows
      .map((row) => this.toStory(row))
      .sort(
        (a, b) =>
          (chapterOrder.get(a.chapter) ?? 99) - (chapterOrder.get(b.chapter) ?? 99) || (a.sort ?? 0) - (b.sort ?? 0),
      );
  }

  /** stage_story 行 → StageStory（Json 字段做兜底解析，坏数据不炸整页）。 */
  private toStory(row: {
    chapterKey: string;
    category: string;
    title: string;
    intro: string;
    outro: string;
    userRole: string;
    setting: string;
    goal: string;
    minTurns: number;
    maxTurns: number;
    target: number;
    rewardXp: number;
    roles: unknown;
    opening: unknown;
    starterHints: unknown;
    sort?: number;
  }): StageStory & { sort: number } {
    const asRoles = Array.isArray(row.roles) ? (row.roles as StageRole[]) : [];
    const asOpening = Array.isArray(row.opening) ? (row.opening as StageLine[]) : [];
    const asHints = Array.isArray(row.starterHints) ? (row.starterHints as Array<{ en: string; zh: string }>) : [];
    return {
      chapter: row.chapterKey,
      category: row.category,
      title: row.title,
      intro: row.intro,
      outro: row.outro,
      userRole: row.userRole,
      setting: row.setting,
      goal: row.goal,
      minTurns: row.minTurns,
      maxTurns: row.maxTurns,
      target: row.target,
      rewardXp: row.rewardXp,
      roles: asRoles,
      opening: asOpening,
      starterHints: asHints,
      sort: row.sort ?? 0,
    };
  }

  /** 按分类 id 取启用的关卡剧情（对话链路入口）。 */
  private async storyOfCategory(categoryId: number): Promise<StageStory | undefined> {
    const category = await this.prisma.sentenceCategory.findUnique({
      where: { id: BigInt(categoryId) },
      select: { name: true },
    });
    if (!category) return undefined;
    const row = await this.prisma.stageStory.findUnique({
      where: { category: category.name },
    });
    if (!row || row.status !== 1) return undefined;
    return this.toStory(row);
  }

  /** 校验并归一化关卡提交数据（新增/编辑共用）。返回可直接写库的 data。 */
  private validateStoryInput(input: CreateStageStoryInput): Record<string, unknown> {
    if (!STAGE_CHAPTERS.some((item) => item.key === input.chapterKey)) {
      throw AppException.badRequest(`章节不存在：${input.chapterKey}`);
    }
    if (!Array.isArray(input.roles) || input.roles.length < 1 || input.roles.length > 3) {
      throw AppException.badRequest('出场角色需要 1~3 人');
    }
    const roleNames = new Set(input.roles.map((role) => role.nameEn));
    for (const role of input.roles) {
      if (!role.nameEn?.trim() || !role.name?.trim() || !role.persona?.trim()) {
        throw AppException.badRequest('角色的英文名/中文名/人设都不能为空');
      }
    }
    for (const line of input.opening ?? []) {
      if (!roleNames.has(line.speaker)) {
        throw AppException.badRequest(`开场白 speaker「${line.speaker}」不在出场角色里`);
      }
    }
    if (input.minTurns < 1 || input.minTurns > 50) throw AppException.badRequest('minTurns 需在 1~50 之间');
    if (input.maxTurns < input.minTurns || input.maxTurns > 100) {
      throw AppException.badRequest('maxTurns 需 >= minTurns 且 <= 100');
    }
    if (input.rewardXp < 0 || input.rewardXp > 10000) throw AppException.badRequest('rewardXp 需在 0~10000 之间');
    return {
      chapterKey: input.chapterKey,
      category: input.category.trim(),
      title: input.title.trim(),
      intro: input.intro.trim(),
      outro: input.outro.trim(),
      userRole: input.userRole.trim(),
      setting: input.setting.trim(),
      goal: input.goal.trim(),
      minTurns: input.minTurns,
      maxTurns: input.maxTurns,
      target: input.target ?? 5,
      rewardXp: input.rewardXp,
      roles: input.roles,
      opening: input.opening ?? [],
      starterHints: input.starterHints ?? [],
    };
  }

  /** 后台-关卡列表（含停用的，附分类 id 与会话/参与/通关统计）。 */
  async adminStories(): Promise<StageStoryAdminItem[]> {
    const [rows, categories, sessionCounts, participantRaw, clearedCounts] = await Promise.all([
      this.prisma.stageStory.findMany(),
      this.prisma.sentenceCategory.findMany({ select: { id: true, name: true } }),
      this.prisma.stageDialogueSession.groupBy({ by: ['categoryId'], _count: { _all: true } }),
      this.prisma.stageDialogueSession.groupBy({ by: ['userId', 'categoryId'], _count: { _all: true } }),
      this.prisma.studyStageProgress.groupBy({
        by: ['categoryId'],
        where: { dialogueClearedAt: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const categoryByName = new Map(categories.map((row) => [row.name, Number(row.id)]));
    const chapterNameOf = new Map(STAGE_CHAPTERS.map((item) => [item.key, item.name]));
    const sessionOf = new Map(sessionCounts.map((row) => [String(row.categoryId), row._count._all]));
    const clearedOf = new Map(clearedCounts.map((row) => [String(row.categoryId), row._count._all]));
    const participantOf = new Map<string, number>();
    for (const row of participantRaw) {
      const key = String(row.categoryId);
      participantOf.set(key, (participantOf.get(key) ?? 0) + 1);
    }
    const chapterOrder = new Map(STAGE_CHAPTERS.map((item, index) => [item.key, index]));
    return rows
      .map((row) => ({
        id: Number(row.id),
        chapterKey: row.chapterKey,
        chapterName: chapterNameOf.get(row.chapterKey) ?? row.chapterKey,
        category: row.category,
        categoryId: categoryByName.get(row.category) ?? null,
        title: row.title,
        intro: row.intro,
        outro: row.outro,
        userRole: row.userRole,
        setting: row.setting,
        goal: row.goal,
        minTurns: row.minTurns,
        maxTurns: row.maxTurns,
        target: row.target,
        rewardXp: row.rewardXp,
        roles: Array.isArray(row.roles) ? (row.roles as unknown as StageRole[]) : [],
        opening: Array.isArray(row.opening) ? (row.opening as unknown as StageLine[]) : [],
        starterHints: Array.isArray(row.starterHints)
          ? (row.starterHints as unknown as Array<{ en: string; zh: string }>)
          : [],
        sort: row.sort,
        status: row.status,
        sessionCount: sessionOf.get(String(categoryByName.get(row.category) ?? 0n)) ?? 0,
        participantCount: participantOf.get(String(categoryByName.get(row.category) ?? 0n)) ?? 0,
        clearedCount: clearedOf.get(String(categoryByName.get(row.category) ?? 0n)) ?? 0,
        createdAt: row.createdAt.toISOString(),
      }))
      .sort(
        (a, b) =>
          (chapterOrder.get(a.chapterKey) ?? 99) - (chapterOrder.get(b.chapterKey) ?? 99) ||
          a.sort - b.sort ||
          a.id - b.id,
      );
  }

  /** 后台-新增关卡：分类必须真实存在且未被其他关卡占用，落到该章 sort 末尾。 */
  async createStory(input: CreateStageStoryInput): Promise<{ id: number }> {
    const data = this.validateStoryInput(input);
    const category = await this.prisma.sentenceCategory.findFirst({
      where: { name: data.category as string },
      select: { id: true, status: true },
    });
    if (!category) throw AppException.badRequest(`场景分类不存在：${data.category}`);
    if (category.status !== 1) throw AppException.badRequest(`场景分类已停用：${data.category}`);
    const taken = await this.prisma.stageStory.findUnique({ where: { category: data.category as string } });
    if (taken) throw AppException.conflict(`该分类已绑定关卡「${taken.title}」`);
    const last = await this.prisma.stageStory.aggregate({
      where: { chapterKey: data.chapterKey as string },
      _max: { sort: true },
    });
    const row = await this.prisma.stageStory.create({
      data: { ...data, sort: (last._max.sort ?? 0) + 1, status: 1 } as never,
    });
    this.logger.log(`[Stage] 新增关卡 #${row.id}「${row.title}」（${row.category} / ${row.chapterKey}）`);
    return { id: Number(row.id) };
  }

  /** 后台-编辑关卡：category 不允许改（进度/会话按 categoryId 挂，改了会断历史）。 */
  async updateStory(id: number, input: UpdateStageStoryInput): Promise<void> {
    const row = await this.prisma.stageStory.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw AppException.notFound('关卡不存在');
    if (input.category !== undefined && input.category.trim() !== row.category) {
      throw AppException.badRequest('不允许修改关卡绑定的分类（历史进度按分类记录）');
    }
    // 未提交的字段回落到旧值，再整体走新增同款校验
    const merged = {
      chapterKey: input.chapterKey ?? row.chapterKey,
      category: row.category,
      title: input.title ?? row.title,
      intro: input.intro ?? row.intro,
      outro: input.outro ?? row.outro,
      userRole: input.userRole ?? row.userRole,
      setting: input.setting ?? row.setting,
      goal: input.goal ?? row.goal,
      minTurns: input.minTurns ?? row.minTurns,
      maxTurns: input.maxTurns ?? row.maxTurns,
      target: input.target ?? row.target,
      rewardXp: input.rewardXp ?? row.rewardXp,
      roles: (input.roles ?? (Array.isArray(row.roles) ? row.roles : [])) as StageRole[],
      opening: (input.opening ?? (Array.isArray(row.opening) ? row.opening : [])) as StageLine[],
      starterHints: (input.starterHints ?? (Array.isArray(row.starterHints) ? row.starterHints : [])) as Array<{
        en: string;
        zh: string;
      }>,
    };
    const data = this.validateStoryInput(merged);
    await this.prisma.stageStory.update({ where: { id: row.id }, data: data as never });
    this.logger.log(`[Stage] 编辑关卡 #${row.id}「${row.title}」`);
  }

  /** 后台-启停关卡：停用后客户端地图/详情不可见，历史进度与会话保留。 */
  async setStoryStatus(id: number, status: 0 | 1): Promise<void> {
    const row = await this.prisma.stageStory.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw AppException.notFound('关卡不存在');
    await this.prisma.stageStory.update({ where: { id: row.id }, data: { status } });
    this.logger.log(`[Stage] 关卡 #${row.id}「${row.title}」${status === 1 ? '启用' : '停用'}`);
  }

  /** 后台-删除关卡：物理删除（进度/会话挂 categoryId，不受影响；分类随之可重新绑定）。 */
  async deleteStory(id: number): Promise<{ sessionCount: number }> {
    const row = await this.prisma.stageStory.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw AppException.notFound('关卡不存在');
    const category = await this.prisma.sentenceCategory.findFirst({
      where: { name: row.category },
      select: { id: true },
    });
    const sessionCount = category
      ? await this.prisma.stageDialogueSession.count({ where: { categoryId: category.id } })
      : 0;
    await this.prisma.stageStory.delete({ where: { id: row.id } });
    this.logger.log(`[Stage] 删除关卡 #${row.id}「${row.title}」（关联会话 ${sessionCount} 条保留）`);
    return { sessionCount };
  }

  /** 后台-章内排序：ids 必须全部属于该章节，按数组顺序重写 sort。 */
  async reorderStories(chapterKey: string, ids: number[]): Promise<void> {
    if (!STAGE_CHAPTERS.some((item) => item.key === chapterKey)) {
      throw AppException.badRequest(`章节不存在：${chapterKey}`);
    }
    const rows = await this.prisma.stageStory.findMany({
      where: { id: { in: ids.map((id) => BigInt(id)) } },
      select: { id: true, chapterKey: true },
    });
    if (rows.length !== ids.length || rows.some((row) => row.chapterKey !== chapterKey)) {
      throw AppException.badRequest('ids 必须全部属于该章节');
    }
    await this.prisma.$transaction(
      ids.map((id, index) => this.prisma.stageStory.update({ where: { id: BigInt(id) }, data: { sort: index + 1 } })),
    );
  }

  /* ------------------------------ 场景长对话 ------------------------------ */

  /**
   * 进入关卡：有进行中的会话就续聊，否则新建并把开场白写进消息表。
   * @param restart 为 true 时把旧会话标记 abandoned 后重新开一局
   */
  async startDialogue(userId: number, categoryId: number, restart = false): Promise<StageDialogueView> {
    const story = await this.storyOfCategory(categoryId);
    if (!story) throw AppException.notFound('关卡不存在');
    await this.assertUnlocked(userId, categoryId);

    const uid = BigInt(userId);
    const cid = BigInt(categoryId);
    const active = await this.prisma.stageDialogueSession.findFirst({
      where: { userId: uid, categoryId: cid, status: 'active' },
      orderBy: { id: 'desc' },
    });

    if (active && !restart) {
      return this.dialogueView(active, story);
    }
    if (active && restart) {
      await this.prisma.stageDialogueSession.update({
        where: { id: active.id },
        data: { status: 'abandoned', endedAt: new Date() },
      });
    }

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.stageDialogueSession.create({
        data: {
          userId: uid,
          categoryId: cid,
          // 默认开启翻译；translationUsed 在用户实际「开着翻译发消息」时才置位，
          // 这样「进局就关掉翻译」仍可拿到无翻译加成，而「全程开着、最后一句才关」会被粘住。
          showTranslation: true,
          translationUsed: false,
          lastHints: JSON.stringify(story.starterHints),
        },
        select: { id: true },
      });
      await tx.stageDialogueMessage.createMany({
        data: story.opening.map((line) => ({
          sessionId: created.id,
          role: 'npc',
          speaker: line.speaker,
          contentEn: line.contentEn,
          contentZh: line.contentZh,
        })),
      });
      return created;
    });
    this.logger.log(`情景对话开始 user=${userId} category=${categoryId} session=${session.id}`);
    return this.dialogueView(session, story);
  }

  /** 只读取进行中的会话（没有返回 null，用于刷新页面时判断）。 */
  async getDialogue(userId: number, categoryId: number): Promise<StageDialogueView | null> {
    const story = await this.storyOfCategory(categoryId);
    if (!story) throw AppException.notFound('关卡不存在');
    const active = await this.prisma.stageDialogueSession.findFirst({
      where: { userId: BigInt(userId), categoryId: BigInt(categoryId), status: 'active' },
      orderBy: { id: 'desc' },
    });
    return active ? this.dialogueView(active, story) : null;
  }

  /**
   * 用户说一句 → 模型以 1~3 个角色回应 → 判定是否结束。
   *
   * 顺序很关键：**先拿到模型输出，再一次性落库**（用户消息 + NPC 台词），
   * AI 挂了就不写任何东西，用户可原样重发，不会留下半截对话。
   */
  async sendMessage(userId: number, categoryId: number, raw: string, showTranslation = true): Promise<StageTurnResult> {
    const story = await this.storyOfCategory(categoryId);
    if (!story) throw AppException.notFound('关卡不存在');
    const content = (raw ?? '').replace(/\s+/g, ' ').trim();
    if (!content) throw AppException.badRequest('先说点什么吧');
    if (content.length > 300) throw AppException.badRequest('一句最多 300 个字符');
    // 这是英语对话练习：纯中文 / 纯符号不算一次发言，也不能占通关轮数。
    // 数字允许（场景里常要报手机号、房号、时间），只拦截「既无字母也无数字」的输入。
    // 卡住时给一句可直接照着说的英文，比单纯报错更贴合学习场景。
    if (!/[A-Za-z0-9]/.test(content)) {
      throw AppException.badRequest(
        '这一关请用英语说一句；不知道怎么说可以试试 “I’m not sure” 或 “Could you repeat that?”',
      );
    }

    const uid = BigInt(userId);
    const cid = BigInt(categoryId);
    const session = await this.prisma.stageDialogueSession.findFirst({
      where: { userId: uid, categoryId: cid, status: 'active' },
      orderBy: { id: 'desc' },
    });
    if (!session) throw AppException.badRequest('对话已结束，请重新进入关卡');

    const stored = await this.prisma.stageDialogueMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { id: 'asc' },
      select: { role: true, speaker: true, contentEn: true },
    });
    const history = stored.map((row) => ({
      role: row.role,
      speaker: row.speaker,
      contentEn: row.contentEn,
    }));
    const turnCount = session.turnCount + 1;

    let result;
    try {
      result = await this.ai.stageDialogueTurn({
        scene: {
          title: story.title,
          setting: story.setting,
          userRole: story.userRole,
          goal: story.goal,
          roles: story.roles.map((role) => ({ nameEn: role.nameEn, persona: role.persona })),
          minTurns: story.minTurns,
          maxTurns: story.maxTurns,
        },
        history,
        userMessage: content,
        turnCount,
      });
    } catch (error) {
      this.logger.warn(`情景对话 AI 调用失败 user=${userId} session=${session.id}：${String(error)}`);
      throw AppException.serviceUnavailable('对方暂时没能回应，请再发一次');
    }

    // 模型空输出 / speaker 写错都要兜底，聊天不能因为模型抽风断掉
    let replies = result.replies;
    if (replies.length === 0) {
      replies = [
        {
          speaker: story.roles[0]?.nameEn ?? 'NPC',
          contentEn: 'Sorry, could you say that again?',
          contentZh: '抱歉，能再说一遍吗？',
        },
      ];
    }
    replies = replies.map((reply) => ({
      ...reply,
      speaker: stageRoleOf(story, reply.speaker) ? reply.speaker : (story.roles[0]?.nameEn ?? 'NPC'),
    }));

    // 服务端兜底：模型再乐观，也不能在用户只蹦了一个词（或答非所问）时判定目标达成。
    // 上一轮已经达成的结论保留，避免重复达成又把目标打回未达成。
    const englishWords = (content.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length;
    const goalReached = session.goalReached || (result.goalReached && englishWords >= 2);
    // 结束只由服务端裁决：轮数够 + 目标达成，或撞到硬上限。模型说 ended 不算数。
    const ended = (turnCount >= story.minTurns && goalReached) || turnCount >= story.maxTurns;
    const cleared = ended && goalReached && turnCount >= story.minTurns;
    const feedback = ended ? await this.summarize(story, history, content, replies, cleared) : null;

    // 候选短句：模型没给（老模型/解析失败）时回落到本关 starterHints
    const hints = result.hints.length > 0 ? result.hints : story.starterHints;
    const showTr = showTranslation !== false;
    // translationUsed 粘性：任一句话发送时翻译处于开启即记 true，之后无法撤销——
    // 这样「全程开着、最后一句才关」仍会被判定用过翻译，拿不到无翻译加成。
    const translationUsed = session.translationUsed || showTr;

    await this.prisma.$transaction(async (tx) => {
      await tx.stageDialogueMessage.createMany({
        data: [
          { sessionId: session.id, role: 'user', speaker: null, contentEn: content, contentZh: null },
          ...replies.map((reply) => ({
            sessionId: session.id,
            role: 'npc',
            speaker: reply.speaker,
            contentEn: reply.contentEn,
            contentZh: reply.contentZh || null,
          })),
        ],
      });
      await tx.stageDialogueSession.update({
        where: { id: session.id },
        data: {
          turnCount,
          goalReached,
          cleared,
          showTranslation: showTr,
          translationUsed,
          lastHints: JSON.stringify(hints),
          ...(ended
            ? {
                status: cleared ? 'completed' : 'ended',
                endedAt: new Date(),
                summary: feedback?.summary ?? null,
                feedback: feedback ? JSON.stringify(feedback) : null,
              }
            : {}),
        },
      });
      if (cleared) {
        await tx.studyStageProgress.upsert({
          where: { userId_categoryId: { userId: uid, categoryId: cid } },
          create: { userId: uid, categoryId: cid, dialogueClearedAt: new Date(), dialogueTurns: turnCount },
          update: { dialogueClearedAt: new Date(), dialogueTurns: turnCount },
        });
      }
    });

    return {
      replies,
      turnCount,
      goalReached,
      ended,
      cleared,
      hints,
      summary: feedback?.summary ?? null,
      feedback,
    };
  }

  /** 主动结束（没聊满也能结束，但只有达成目标且轮数够才算通关）。 */
  async endDialogue(userId: number, categoryId: number): Promise<StageDialogueView> {
    const story = await this.storyOfCategory(categoryId);
    if (!story) throw AppException.notFound('关卡不存在');
    const session = await this.prisma.stageDialogueSession.findFirst({
      where: { userId: BigInt(userId), categoryId: BigInt(categoryId), status: 'active' },
      orderBy: { id: 'desc' },
    });
    if (!session) throw AppException.badRequest('对话已经结束了');

    const stored = await this.prisma.stageDialogueMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { id: 'asc' },
      select: { role: true, speaker: true, contentEn: true },
    });
    const cleared = session.goalReached && session.turnCount >= story.minTurns;
    const feedback = await this.summarize(
      story,
      stored.map((row) => ({ role: row.role, speaker: row.speaker, contentEn: row.contentEn })),
      '',
      [],
      cleared,
    );
    await this.prisma.stageDialogueSession.update({
      where: { id: session.id },
      data: {
        status: cleared ? 'completed' : 'ended',
        cleared,
        endedAt: new Date(),
        summary: feedback.summary,
        feedback: JSON.stringify(feedback),
      },
    });
    if (cleared) {
      await this.prisma.studyStageProgress.upsert({
        where: { userId_categoryId: { userId: BigInt(userId), categoryId: BigInt(categoryId) } },
        create: {
          userId: BigInt(userId),
          categoryId: BigInt(categoryId),
          dialogueClearedAt: new Date(),
          dialogueTurns: session.turnCount,
        },
        update: { dialogueClearedAt: new Date(), dialogueTurns: session.turnCount },
      });
    }
    return this.dialogueView({ id: session.id }, story);
  }

  /** 生成中文复盘；AI 不可用时用通用文案，绝不阻塞通关。 */
  private async summarize(
    story: StageStory,
    history: Array<{ role: string; speaker: string | null; contentEn: string }>,
    lastUser: string,
    lastReplies: StageDialogueReply[],
    cleared: boolean,
  ): Promise<StageDialogueSummary> {
    const tail = [
      ...(lastUser ? [{ role: 'user', speaker: null, contentEn: lastUser }] : []),
      ...lastReplies.map((reply) => ({ role: 'npc', speaker: reply.speaker, contentEn: reply.contentEn })),
    ];
    try {
      return await this.ai.stageDialogueSummary({
        scene: { title: story.title, goal: story.goal },
        history: [...history, ...tail].slice(-30),
        cleared,
      });
    } catch (error) {
      this.logger.warn(`情景对话复盘生成失败：${String(error)}`);
      return {
        summary: cleared ? '这一关的目标你达成了，故事往前走了一段。' : '这段对话先到这里，换个说法再来一次。',
        highlights: ['你坚持把这个场景聊完了'],
        improvements: ['试着把回答再展开一两句'],
      };
    }
  }

  /** 装配会话视图（开场白/历史/复盘一次性给前端）。 */
  private async dialogueView(session: { id: bigint }, story: StageStory): Promise<StageDialogueView> {
    const row = await this.prisma.stageDialogueSession.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        status: true,
        turnCount: true,
        goalReached: true,
        cleared: true,
        showTranslation: true,
        lastHints: true,
        summary: true,
        feedback: true,
      },
    });
    if (!row) throw AppException.notFound('对话不存在');
    const messages = await this.prisma.stageDialogueMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { id: 'asc' },
      select: { id: true, role: true, speaker: true, contentEn: true, contentZh: true, createdAt: true },
    });
    return {
      sessionId: Number(row.id),
      status: row.status,
      turnCount: row.turnCount,
      goalReached: row.goalReached,
      cleared: row.cleared,
      showTranslation: row.showTranslation,
      hints: parseHints(row.lastHints, story.starterHints),
      title: story.title,
      intro: story.intro,
      goal: story.goal,
      minTurns: story.minTurns,
      maxTurns: story.maxTurns,
      roles: story.roles.map((role) => ({ nameEn: role.nameEn, name: role.name, emoji: role.emoji })),
      messages: messages.map((item) => ({
        id: Number(item.id),
        role: item.role === 'user' ? 'user' : 'npc',
        speaker: item.speaker,
        contentEn: item.contentEn,
        contentZh: item.contentZh,
        createdAt: item.createdAt.toISOString(),
      })),
      summary: row.summary,
      feedback: parseFeedback(row.feedback),
    };
  }

  /** 校验关卡是否已解锁（对话通关口径）。 */
  private async assertUnlocked(userId: number, categoryId: number): Promise<void> {
    const overview = await this.getStages(userId);
    const stage = overview.chapters.flatMap((item) => item.stages).find((item) => item.id === categoryId);
    if (!stage) throw AppException.notFound('关卡不存在');
    if (!stage.unlocked) throw AppException.badRequest('先完成上一关的场景对话吧');
  }

  /* ------------------------------ 旧版答题统计 ------------------------------ */

  /**
   * 记录一次作答（旧版口径，仅保留历史统计）。
   * 不再写 dialogueClearedAt，不影响解锁与通关；任何异常都不应影响答题结果。
   */
  async recordAnswer(userId: number, categoryId: number, categoryName: string, isCorrect: boolean): Promise<void> {
    // 只记录「已绑定关卡」的分类（答题链路对每题都会调过来，未绑定直接跳过）
    const bound = await this.prisma.stageStory.findUnique({ where: { category: categoryName }, select: { id: true } });
    if (!bound) return;
    const uid = BigInt(userId);
    const cid = BigInt(categoryId);
    await this.prisma.studyStageProgress.upsert({
      where: { userId_categoryId: { userId: uid, categoryId: cid } },
      create: { userId: uid, categoryId: cid, correctCount: isCorrect ? 1 : 0, answerCount: 1 },
      update: {
        answerCount: { increment: 1 },
        ...(isCorrect ? { correctCount: { increment: 1 } } : {}),
      },
    });
  }

  /** 领取通关奖励（幂等；只认对话通关）。无翻译通关额外加成。 */
  async claim(userId: number, categoryId: number): Promise<ClaimResult> {
    const story = await this.storyOfCategory(categoryId);
    if (!story) throw AppException.notFound('关卡不存在');

    const uid = BigInt(userId);
    const cid = BigInt(categoryId);
    const [progress, user, existing, clearing] = await Promise.all([
      this.prisma.studyStageProgress.findUnique({
        where: { userId_categoryId: { userId: uid, categoryId: cid } },
        select: { dialogueClearedAt: true },
      }),
      this.prisma.clientUser.findUnique({ where: { id: uid }, select: { xp: true } }),
      this.prisma.clientXpLog.findUnique({ where: { eventKey: claimKey(userId, categoryId) }, select: { id: true } }),
      // 找出通关的那一局（最近一次 cleared 的会话），用它的 translationUsed 判定是否无翻译通关
      this.prisma.stageDialogueSession.findFirst({
        where: { userId: uid, categoryId: cid, cleared: true },
        orderBy: { endedAt: 'desc' },
        select: { translationUsed: true },
      }),
    ]);

    if (!progress?.dialogueClearedAt) {
      throw AppException.badRequest('完成场景对话并达成目标后才能领取');
    }
    if (existing) {
      return { awarded: false, alreadyClaimed: true, rewardXp: 0, bonusXp: 0, xp: user?.xp ?? 0 };
    }

    // 本局全程关闭翻译 → 额外加成（基础奖励的 50%）；用过翻译则不加。
    const noTranslation = !clearing?.translationUsed;
    const bonus = noTranslation ? Math.round(story.rewardXp * NO_TRANSLATION_BONUS_RATIO) : 0;

    const baseAwarded = await this.gamify.awardXp(userId, 'stage_clear', claimKey(userId, categoryId), story.rewardXp);
    const bonusAwarded =
      bonus > 0
        ? await this.gamify.awardXp(userId, 'stage_no_translation', bonusKey(userId, categoryId), bonus)
        : false;
    const latest =
      baseAwarded || bonusAwarded
        ? await this.prisma.clientUser.findUnique({ where: { id: uid }, select: { xp: true } })
        : user;
    return {
      awarded: baseAwarded || bonusAwarded,
      alreadyClaimed: false,
      rewardXp: baseAwarded ? story.rewardXp : 0,
      bonusXp: bonusAwarded ? bonus : 0,
      xp: latest?.xp ?? 0,
    };
  }

  /**
   * 切换翻译显示开关（持久化到会话）。
   * 开启翻译即把 translationUsed 置位（粘性，不可撤销）——防止「全程开着、最后一句才关」骗加成。
   * 关闭翻译不清空 translationUsed，已用过就仍是用过。
   */
  async setTranslation(userId: number, categoryId: number, show: boolean): Promise<{ showTranslation: boolean }> {
    const session = await this.prisma.stageDialogueSession.findFirst({
      where: { userId: BigInt(userId), categoryId: BigInt(categoryId), status: 'active' },
      orderBy: { id: 'desc' },
    });
    if (!session) throw AppException.badRequest('没有进行中的对话');
    await this.prisma.stageDialogueSession.update({
      where: { id: session.id },
      data: {
        showTranslation: show,
        translationUsed: session.translationUsed || show,
      },
    });
    return { showTranslation: show };
  }

  /** 已通关关卡数（成就判定用；只数对话通关）。 */
  async clearedCount(userId: number): Promise<number> {
    return this.prisma.studyStageProgress.count({
      where: { userId: BigInt(userId), dialogueClearedAt: { not: null } },
    });
  }

  /* ------------------------------ 后台管理（运营） ------------------------------ */

  /** 后台-关卡总览条目：剧情 + 每关的参与/通关/领奖统计。 */
  async adminOverview(): Promise<StageAdminChapter[]> {
    const categories = await this.prisma.sentenceCategory.findMany({
      where: { status: 1 },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true },
    });
    const categoryByName = new Map(categories.map((row) => [row.name, row]));

    // 一次性聚合各关卡的会话/进度统计，避免每关一条查询
    const [sessionAll, sessionActive, sessionCleared, sessionNoTrans, clearedProgress, participantRaw, claimKeys] =
      await Promise.all([
        this.prisma.stageDialogueSession.groupBy({ by: ['categoryId'], _count: { _all: true } }),
        this.prisma.stageDialogueSession.groupBy({
          by: ['categoryId'],
          where: { status: 'active' },
          _count: { _all: true },
        }),
        this.prisma.stageDialogueSession.groupBy({
          by: ['categoryId'],
          where: { cleared: true },
          _count: { _all: true },
          _avg: { turnCount: true },
        }),
        this.prisma.stageDialogueSession.groupBy({
          by: ['categoryId'],
          where: { cleared: true, translationUsed: false },
          _count: { _all: true },
        }),
        this.prisma.studyStageProgress.groupBy({
          by: ['categoryId'],
          where: { dialogueClearedAt: { not: null } },
          _count: { _all: true },
        }),
        // 参与人数 = 去重用户数，Prisma 的 count(distinct) 按关卡逐条太碎，用一条原生聚合
        this.prisma.$queryRaw<Array<{ cid: bigint; cnt: bigint | number }>>`
          SELECT category_id AS cid, COUNT(DISTINCT user_id) AS cnt
          FROM stage_dialogue_session
          GROUP BY category_id`,
        // 领奖数：eventKey = `stage:{userId}:{categoryId}`；startsWith 'stage:' 天然排除 stage-bonus:
        this.prisma.clientXpLog.findMany({ where: { eventKey: { startsWith: 'stage:' } }, select: { eventKey: true } }),
      ]);

    const countOf = (rows: Array<{ categoryId: bigint; _count: { _all: number } }>, cid: bigint): number =>
      rows.find((row) => row.categoryId === cid)?._count._all ?? 0;
    const avgOf = (
      rows: Array<{ categoryId: bigint; _avg: { turnCount: number | null } }>,
      cid: bigint,
    ): number | null => {
      const hit = rows.find((row) => row.categoryId === cid);
      return hit?._avg.turnCount ?? null;
    };
    const participantOf = new Map<string, number>(participantRaw.map((row) => [String(row.cid), Number(row.cnt)]));
    const claimedOf = new Map<string, number>();
    for (const row of claimKeys) {
      // 解析 `stage:{userId}:{categoryId}` 的末段 categoryId
      const parts = row.eventKey.split(':');
      const cid = parts[2];
      if (cid) claimedOf.set(cid, (claimedOf.get(cid) ?? 0) + 1);
    }

    const chapters: StageAdminChapter[] = [];
    const [coverUrls, stories] = await Promise.all([this.coverUrlMapOf(), this.listStories(1)]);
    for (const chapter of STAGE_CHAPTERS) {
      const stages: StageAdminOverviewItem[] = [];
      for (const story of stories.filter((item) => item.chapter === chapter.key)) {
        const category = categoryByName.get(story.category);
        if (!category) continue;
        const cid = category.id;
        const cleared = countOf(clearedProgress as never, cid);
        const claimed = claimedOf.get(String(cid)) ?? 0;
        stages.push({
          id: Number(cid),
          categoryName: category.name,
          chapter: chapter.key,
          title: story.title,
          goal: story.goal,
          minTurns: story.minTurns,
          maxTurns: story.maxTurns,
          rewardXp: story.rewardXp,
          sessionCount: countOf(sessionAll as never, cid),
          activeSessionCount: countOf(sessionActive as never, cid),
          participantCount: participantOf.get(String(cid)) ?? 0,
          clearedCount: cleared,
          clearedSessionCount: countOf(sessionCleared as never, cid),
          avgClearedTurns: avgOf(sessionCleared as never, cid),
          noTranslationClearedCount: countOf(sessionNoTrans as never, cid),
          claimableCount: Math.max(0, cleared - claimed),
        });
      }
      if (stages.length > 0) {
        chapters.push({
          key: chapter.key,
          name: chapter.name,
          subtitle: chapter.subtitle,
          coverUrl: coverUrls.get(chapter.key) ?? null,
          stages,
        });
      }
    }
    return chapters;
  }

  /** 后台-对话会话分页列表（可按关卡/状态/用户/无翻译筛选）。 */
  async adminSessionList(query: Record<string, unknown>): Promise<{ list: StageSessionAdminItem[]; total: number }> {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20) || 20));
    const categoryId = Number(query.categoryId ?? 0) || 0;
    const status = typeof query.status === 'string' && query.status ? query.status : undefined;
    const userId = Number(query.userId ?? 0) || 0;
    const noTranslation = query.noTranslation === '1' || query.noTranslation === true;
    const keyword = typeof query.keyword === 'string' ? query.keyword.trim() : '';

    // 用户昵称关键词需要先落到 userId 集合
    let keywordUserIds: bigint[] | undefined;
    if (keyword) {
      const users = await this.prisma.clientUser.findMany({
        where: { nickname: { contains: keyword } },
        select: { id: true },
      });
      keywordUserIds = users.map((row) => row.id);
      if (keywordUserIds.length === 0) {
        return { list: [], total: 0 };
      }
    }

    const where = {
      ...(categoryId > 0 ? { categoryId: BigInt(categoryId) } : {}),
      ...(status ? { status } : {}),
      ...(userId > 0 ? { userId: BigInt(userId) } : {}),
      ...(noTranslation ? { translationUsed: false, cleared: true } : {}),
      ...(keywordUserIds ? { userId: { in: keywordUserIds } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.stageDialogueSession.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          userId: true,
          categoryId: true,
          status: true,
          turnCount: true,
          goalReached: true,
          cleared: true,
          showTranslation: true,
          translationUsed: true,
          startedAt: true,
          endedAt: true,
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.stageDialogueSession.count({ where }),
    ]);

    const userIds = [...new Set(rows.map((row) => row.userId))];
    const users = await this.prisma.clientUser.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nickname: true },
    });
    const nicknameOf = new Map(users.map((row) => [String(row.id), row.nickname]));
    const categoryNames = new Map(
      (await this.prisma.sentenceCategory.findMany({ select: { id: true, name: true } })).map((row) => [
        String(row.id),
        row.name,
      ]),
    );
    // 关卡标题/目标从 stage_story 表取（关卡被删时回落分类名）
    const storyRows = await this.prisma.stageStory.findMany({
      where: { category: { in: [...categoryNames.values()] } },
      select: { category: true, title: true, goal: true },
    });
    const storyOfName = new Map(storyRows.map((row) => [row.category, row]));

    const list: StageSessionAdminItem[] = rows.map((row) => {
      const categoryName = categoryNames.get(String(row.categoryId)) ?? '';
      return {
        id: Number(row.id),
        userId: Number(row.userId),
        nickname: nicknameOf.get(String(row.userId)) ?? `用户${Number(row.userId)}`,
        categoryId: Number(row.categoryId),
        stageTitle: storyOfName.get(categoryName)?.title ?? categoryName,
        status: row.status,
        turnCount: row.turnCount,
        goalReached: row.goalReached,
        cleared: row.cleared,
        showTranslation: row.showTranslation,
        translationUsed: row.translationUsed,
        messageCount: row._count.messages,
        startedAt: row.startedAt.toISOString(),
        endedAt: row.endedAt?.toISOString() ?? null,
      };
    });
    return { list, total };
  }

  /** 后台-会话详情：完整消息流（运营抽查 AI 回复质量 / 处理客诉）。 */
  async adminSessionDetail(sessionId: number): Promise<StageSessionAdminDetail> {
    const session = await this.prisma.stageDialogueSession.findUnique({
      where: { id: BigInt(sessionId) },
      select: {
        id: true,
        userId: true,
        categoryId: true,
        status: true,
        turnCount: true,
        goalReached: true,
        cleared: true,
        showTranslation: true,
        translationUsed: true,
        summary: true,
        startedAt: true,
        endedAt: true,
      },
    });
    if (!session) throw AppException.notFound('会话不存在');
    const [messages, user, category] = await Promise.all([
      this.prisma.stageDialogueMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { id: 'asc' },
        select: { id: true, role: true, speaker: true, contentEn: true, contentZh: true, createdAt: true },
      }),
      this.prisma.clientUser.findUnique({ where: { id: session.userId }, select: { nickname: true } }),
      this.prisma.sentenceCategory.findUnique({ where: { id: session.categoryId }, select: { name: true } }),
    ]);
    const story = category
      ? await this.prisma.stageStory.findUnique({
          where: { category: category.name },
          select: { title: true, goal: true },
        })
      : null;
    return {
      id: Number(session.id),
      userId: Number(session.userId),
      nickname: user?.nickname ?? `用户${Number(session.userId)}`,
      categoryId: Number(session.categoryId),
      stageTitle: story?.title ?? category?.name ?? '',
      goal: story?.goal ?? '',
      status: session.status,
      turnCount: session.turnCount,
      goalReached: session.goalReached,
      cleared: session.cleared,
      showTranslation: session.showTranslation,
      translationUsed: session.translationUsed,
      summary: session.summary,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      messages: messages.map((row) => ({
        id: Number(row.id),
        role: row.role,
        speaker: row.speaker,
        contentEn: row.contentEn,
        contentZh: row.contentZh,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  /** 后台-强制结束进行中的会话（处理模型卡死/客诉等异常；不改通关与进度）。 */
  async adminCloseSession(sessionId: number): Promise<void> {
    const session = await this.prisma.stageDialogueSession.findUnique({
      where: { id: BigInt(sessionId) },
      select: { id: true, status: true },
    });
    if (!session) throw AppException.notFound('会话不存在');
    if (session.status !== 'active') throw AppException.badRequest('会话已结束，无需处理');
    await this.prisma.stageDialogueSession.update({
      where: { id: session.id },
      data: { status: 'ended', endedAt: new Date() },
    });
  }
}

/** 领取结果。 */
export interface ClaimResult {
  /** 本次是否真的发放了经验（false = 已领过 / 撞每日上限） */
  awarded: boolean;
  /** 是否此前已领取 */
  alreadyClaimed: boolean;
  /** 本次实发基础经验（已领过或撞上限为 0） */
  rewardXp: number;
  /** 无翻译通关的额外加成经验（本局全程关闭翻译才计；已领过或撞上限为 0） */
  bonusXp: number;
  /** 领取后的总经验 */
  xp: number;
}

/* ------------------------------ 后台管理视图类型 ------------------------------ */

/** 后台-关卡总览条目。 */
export interface StageAdminOverviewItem {
  id: number;
  categoryName: string;
  chapter: string;
  title: string;
  goal: string;
  minTurns: number;
  maxTurns: number;
  rewardXp: number;
  /** 产生过会话的总次数 */
  sessionCount: number;
  /** 进行中的会话数 */
  activeSessionCount: number;
  /** 去重参与用户数 */
  participantCount: number;
  /** 对话通关人数（study_stage_progress.dialogueClearedAt 非空） */
  clearedCount: number;
  /** 通关的会话数 */
  clearedSessionCount: number;
  /** 通关会话平均轮数 */
  avgClearedTurns: number | null;
  /** 无翻译通关的会话数 */
  noTranslationClearedCount: number;
  /** 已通关但未领奖人数 */
  claimableCount: number;
}

/** 后台-关卡总览章节。 */
export interface StageAdminChapter {
  key: string;
  name: string;
  subtitle: string;
  /** AI 封面图 URL；未生成时为 null（后台可据此显示「待生成」） */
  coverUrl: string | null;
  stages: StageAdminOverviewItem[];
}

/** 后台-章节封面管理条目。 */
export interface StageChapterCoverItem {
  chapterKey: string;
  chapterName: string;
  coverUrl: string | null;
  /** 实际生图用的完整提示词（含风格后缀；未生成时为该章的场景描述） */
  prompt: string;
  generatedAt: string | null;
}

/** 新增/编辑关卡的提交数据（DTO 与 service 共用的形状）。 */
export interface CreateStageStoryInput {
  chapterKey: string;
  /** 绑定的场景分类名（sentence_category.name）；编辑时不可修改 */
  category: string;
  title: string;
  intro: string;
  outro: string;
  userRole: string;
  setting: string;
  goal: string;
  minTurns: number;
  maxTurns: number;
  target?: number;
  rewardXp: number;
  roles: StageRole[];
  opening: StageLine[];
  starterHints: Array<{ en: string; zh: string }>;
}

/** 编辑关卡：全字段可选（category 除外，见 updateStory）。 */
export type UpdateStageStoryInput = Partial<CreateStageStoryInput>;

/** 后台-关卡管理条目。 */
export interface StageStoryAdminItem {
  id: number;
  chapterKey: string;
  chapterName: string;
  category: string;
  /** 分类 id（分类被删时为 null） */
  categoryId: number | null;
  title: string;
  intro: string;
  outro: string;
  userRole: string;
  setting: string;
  goal: string;
  minTurns: number;
  maxTurns: number;
  target: number;
  rewardXp: number;
  roles: StageRole[];
  opening: StageLine[];
  starterHints: Array<{ en: string; zh: string }>;
  sort: number;
  /** 1 启用 / 0 停用 */
  status: number;
  sessionCount: number;
  participantCount: number;
  clearedCount: number;
  createdAt: string;
}

/** 后台-会话列表条目。 */
export interface StageSessionAdminItem {
  id: number;
  userId: number;
  nickname: string;
  categoryId: number;
  stageTitle: string;
  status: string;
  turnCount: number;
  goalReached: boolean;
  cleared: boolean;
  showTranslation: boolean;
  translationUsed: boolean;
  messageCount: number;
  startedAt: string;
  endedAt: string | null;
}

/** 后台-会话详情（含完整消息）。 */
export interface StageSessionAdminDetail extends Omit<StageSessionAdminItem, 'messageCount'> {
  goal: string;
  summary: string | null;
  messages: Array<{
    id: number;
    role: string;
    speaker: string | null;
    contentEn: string;
    contentZh: string | null;
    createdAt: string;
  }>;
}
