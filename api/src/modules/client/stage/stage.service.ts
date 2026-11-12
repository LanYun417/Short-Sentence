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
import { normalizeGeneratedImage } from '../../../common/ai/image-normalize.js';
import { isFestivalName } from '../../../common/calendar/festivals.js';
import { ImageGenApiProvider } from '../../../common/ai/image-gen.provider.js';
import { FileService } from '../../../common/file/file.service.js';
import { config } from '../../../common/config/config.js';
import {
  TextChatProvider,
  type StageDialogueHint,
  type StageDialogueReply,
  type StageDialogueSummary,
} from '../../../common/ai/text-chat.provider.js';
import { withRetry } from '../../../common/ai/concurrency.js';
import type { StageStoryDraft } from '../../../common/ai/ai.types.js';
import { AppException } from '../../../common/exception/app.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { GamifyService } from '../gamify/gamify.service.js';
import {
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
  /** 关卡 id（stage_story.id）：对话/领奖接口都用它 */
  id: number;
  /** 所属剧本 id */
  scriptId: number;
  /** 所属场景分类 id（统计/题库入口用） */
  categoryId: number;
  /** 场景分类名（旧客户端展示用） */
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

/** 剧本视图（场景 → 剧本 → 关卡 的第二层）。 */
export interface StageScriptView {
  /** 剧本 id（stage_script.id） */
  id: number;
  /** 所属场景分类 id */
  categoryId: number;
  name: string;
  blurb: string;
  /** AI 生成的封面图 URL；未生成时为 null（前端回落渐变+图标） */
  coverUrl: string | null;
  /** 该剧本下可见关卡数 */
  stageCount: number;
  /** 我已通关的关卡数 */
  clearedCount: number;
  /** 该剧本是否全部通关 */
  completed: boolean;
}

/** 场景视图（顶层：场景分类 + 其下剧本/关卡汇总）。 */
export interface StageSceneView {
  id: number;
  name: string;
  nameEn: string | null;
  icon: string | null;
  /** 该场景下启用的剧本数 */
  scriptCount: number;
  /** 该场景下可见关卡数 */
  stageCount: number;
  /** 我已通关的关卡数 */
  clearedCount: number;
  /** 场景卡封面 = 第一个有封面的剧本封面（都没有则 null） */
  coverUrl: string | null;
}

/**
 * 章节视图（**兼容旧客户端**）。
 *
 * 重构后层级是 场景 → 剧本 → 关卡；旧版客户端仍把「剧本」当章节渲染，
 * 所以总览里继续下发 `chapters`，一个剧本 = 一个 chapter（key=`script-{id}`）。
 */
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
  /** 顶层场景（新客户端地图首页用） */
  scenes: StageSceneView[];
  /** 剧本平铺（兼容旧客户端：一个剧本 = 一个 chapter） */
  chapters: StageChapterView[];
  clearedStages: number;
  totalStages: number;
  /** 已解锁但未通关的关卡数 */
  activeStages: number;
  /** 可领取奖励的关卡数 */
  claimable: number;
  /** 当前推荐关卡（第一个已解锁未通关；story id） */
  recommendedId: number | null;
}

/** 场景详情（场景 → 剧本列表）。 */
export interface StageSceneDetail {
  scene: StageSceneView;
  scripts: StageScriptView[];
}

/** 剧本详情（剧本 → 关卡列表）。 */
export interface StageScriptDetail {
  script: StageScriptView;
  /** 所属场景（展示用） */
  scene: Pick<StageSceneView, 'id' | 'name' | 'nameEn' | 'icon'>;
  stages: StageView[];
  clearedCount: number;
  total: number;
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
    private readonly ai: TextChatProvider,
    private readonly imageGen: ImageGenApiProvider,
    private readonly fileService: FileService,
  ) {}

  /* ------------------------------ 地图组装（场景 → 剧本 → 关卡） ------------------------------ */

  /**
   * 一次性把地图所需数据捞齐并组装好：分类 / 剧本 / 关卡 / 我的进度 / 领奖 / 会话 / 题库数。
   * getStages、getScene、getScript 共用，避免三份重复查询。
   */
  private async buildMap(userId: number): Promise<{
    scenes: StageSceneView[];
    scripts: Array<StageScriptView & { stages: StageView[] }>;
    chapters: StageChapterView[];
    totals: {
      clearedStages: number;
      totalStages: number;
      activeStages: number;
      claimable: number;
      recommendedId: number | null;
    };
  }> {
    const uid = BigInt(userId);
    const [categories, scriptRows, storyRows, storyProgress, legacyProgress, claims, activeSessions, bankCounts] =
      await Promise.all([
        this.prisma.sentenceCategory.findMany({
          where: { status: 1 },
          orderBy: [{ sort: 'asc' }, { id: 'asc' }],
          // coverFileId：闯关场景自己的封面（AI 生成），没有时再回落「第一个剧本封面」
          select: { id: true, name: true, nameEn: true, icon: true, coverFileId: true },
        }),
        this.prisma.stageScript.findMany({ where: { status: 1 }, orderBy: [{ sort: 'asc' }, { id: 'asc' }] }),
        this.prisma.stageStory.findMany({ where: { status: 1 }, orderBy: [{ sort: 'asc' }, { id: 'asc' }] }),
        // 对话进度（按关卡）
        this.prisma.studyStageProgress.findMany({
          where: { userId: uid, storyId: { not: null } },
          select: { storyId: true, categoryId: true, dialogueClearedAt: true, dialogueTurns: true },
        }),
        // 旧版答题统计（按分类，storyId 为空）
        this.prisma.studyStageProgress.findMany({
          where: { userId: uid, storyId: null },
          select: { categoryId: true, correctCount: true },
        }),
        this.prisma.clientXpLog.findMany({
          where: { userId: uid, eventKey: { startsWith: `stage:${userId}:` } },
          select: { eventKey: true },
        }),
        this.prisma.stageDialogueSession.findMany({
          where: { userId: uid, status: 'active' },
          select: { id: true, storyId: true, turnCount: true },
        }),
        // 兼容 Android 旧版关卡页（按场景可刷题数决定是否显示「去练习」）
        this.prisma.sentence.groupBy({
          by: ['categoryId'],
          where: { status: 'ready', retiredAt: null, imageFileId: { gt: 0n } },
          _count: { _all: true },
        }),
      ]);

    const categoryById = new Map(
      categories.filter((row) => !isFestivalName(row.name)).map((row) => [String(row.id), row]),
    );
    const progressByStory = new Map(storyProgress.map((row) => [String(row.storyId), row]));
    const legacyByCategory = new Map(legacyProgress.map((row) => [String(row.categoryId), row.correctCount]));
    const claimedSet = new Set(claims.map((row) => row.eventKey));
    const activeByStory = new Map(activeSessions.map((row) => [String(row.storyId), row]));
    const bankByCategory = new Map(bankCounts.map((row) => [String(row.categoryId), row._count._all]));

    // 封面 URL（剧本 coverFileId → file 表）
    const coverByScript = new Map<string, string | null>();
    for (const script of scriptRows) {
      coverByScript.set(String(script.id), await this.coverUrlOf(script.coverFileId));
    }
    // 场景自己的封面（sentence_category.cover_file_id，AI 生成；节日分类不进地图，无冲突）
    const sceneCoverUrls = new Map<string, string | null>();
    for (const category of categories) {
      if (category.coverFileId > 0n) {
        sceneCoverUrls.set(String(category.id), await this.coverUrlOf(category.coverFileId));
      }
    }

    const storiesByScript = new Map<string, typeof storyRows>();
    for (const story of storyRows) {
      const key = String(story.scriptId);
      const list = storiesByScript.get(key) ?? [];
      list.push(story);
      storiesByScript.set(key, list);
    }

    let clearedStages = 0;
    let activeStages = 0;
    let claimable = 0;
    let recommendedId: number | null = null;

    const scripts: Array<StageScriptView & { stages: StageView[] }> = [];
    const chapters: StageChapterView[] = [];

    for (const script of scriptRows) {
      const category = categoryById.get(String(script.categoryId));
      // 分类被删/禁用/节日分类时跳过整个剧本，而不是造一个点不进去的空剧本
      if (!category) continue;
      const stories = storiesByScript.get(String(script.id)) ?? [];
      const stages: StageView[] = [];
      // 剧本内顺序解锁：上一关未通关，下一关锁住；每个剧本第一关默认解锁
      let previousCleared = true;

      for (const story of stories) {
        const storyId = Number(story.id);
        const progress = progressByStory.get(String(story.id));
        const active = activeByStory.get(String(story.id));
        const cleared = Boolean(progress?.dialogueClearedAt);
        const unlocked = previousCleared;
        const claimed = claimedSet.has(claimKey(userId, storyId));
        const turns = progress?.dialogueTurns ?? 0;
        const progressPct = cleared ? 100 : Math.min(90, Math.round(((active?.turnCount ?? 0) / story.minTurns) * 100));

        if (cleared) {
          clearedStages += 1;
        } else if (unlocked) {
          activeStages += 1;
          if (recommendedId === null) recommendedId = storyId;
        }
        if (cleared && !claimed) claimable += 1;

        stages.push({
          id: storyId,
          scriptId: Number(script.id),
          categoryId: Number(category.id),
          name: category.name,
          nameEn: category.nameEn,
          icon: category.icon,
          title: story.title,
          intro: story.intro,
          outro: story.outro,
          goal: story.goal,
          minTurns: story.minTurns,
          maxTurns: story.maxTurns,
          roles: this.rolesOf(story.roles),
          rewardXp: story.rewardXp,
          cleared,
          unlocked,
          claimed,
          progress: progressPct,
          turns,
          legacyCorrectCount: legacyByCategory.get(String(category.id)) ?? 0,
          // ↓ 兼容 Android 旧版关卡页（新口径把「句」换成「轮」）
          target: story.minTurns,
          correctCount: active?.turnCount ?? turns,
          answerCount: active?.turnCount ?? 0,
          bankCount: bankByCategory.get(String(category.id)) ?? 0,
          activeSessionId: active ? Number(active.id) : null,
        });
        previousCleared = cleared;
      }

      if (stages.length === 0) continue;
      const clearedCount = stages.filter((item) => item.cleared).length;
      const scriptView: StageScriptView & { stages: StageView[] } = {
        id: Number(script.id),
        categoryId: Number(category.id),
        name: script.name,
        blurb: script.blurb,
        coverUrl: coverByScript.get(String(script.id)) ?? null,
        stageCount: stages.length,
        clearedCount,
        completed: clearedCount === stages.length,
        stages,
      };
      scripts.push(scriptView);
      // 兼容旧客户端：一个剧本 = 一个 chapter
      chapters.push({
        key: `script-${script.id}`,
        name: script.name,
        subtitle: script.blurb,
        coverUrl: scriptView.coverUrl,
        stages,
        clearedCount,
        total: stages.length,
      });
    }

    // 场景汇总（按分类顺序输出，只保留有剧本的场景）
    const scenes: StageSceneView[] = [];
    for (const category of categories) {
      if (isFestivalName(category.name)) continue;
      const sceneScripts = scripts.filter((item) => item.categoryId === Number(category.id));
      if (sceneScripts.length === 0) continue;
      const stageCount = sceneScripts.reduce((sum, item) => sum + item.stageCount, 0);
      scenes.push({
        id: Number(category.id),
        name: category.name,
        nameEn: category.nameEn,
        icon: category.icon,
        scriptCount: sceneScripts.length,
        stageCount,
        clearedCount: sceneScripts.reduce((sum, item) => sum + item.clearedCount, 0),
        // 场景优先用自己的 AI 封面；没有才用第一个剧本的封面兜底
        coverUrl:
          sceneCoverUrls.get(String(category.id)) ?? sceneScripts.find((item) => item.coverUrl)?.coverUrl ?? null,
      });
    }

    return {
      scenes,
      scripts,
      chapters,
      totals: {
        clearedStages,
        totalStages: chapters.reduce((sum, item) => sum + item.total, 0),
        activeStages,
        claimable,
        recommendedId,
      },
    };
  }

  /** 闯关地图：场景 + 剧本（兼容 chapters）+ 我的对话进度。 */
  async getStages(userId: number): Promise<StageOverview> {
    const map = await this.buildMap(userId);
    return { scenes: map.scenes, chapters: map.chapters, ...map.totals };
  }

  /** 场景详情：该场景下的剧本列表。 */
  async getScene(userId: number, categoryId: number): Promise<StageSceneDetail> {
    const map = await this.buildMap(userId);
    const scene = map.scenes.find((item) => item.id === categoryId);
    if (!scene) throw AppException.notFound('场景不存在');
    return {
      scene,
      scripts: map.scripts.filter((item) => item.categoryId === categoryId).map(({ stages: _stages, ...view }) => view),
    };
  }

  /** 剧本详情：该剧本下的关卡列表（含解锁/进度）。 */
  async getScript(userId: number, scriptId: number): Promise<StageScriptDetail> {
    const map = await this.buildMap(userId);
    const script = map.scripts.find((item) => item.id === scriptId);
    if (!script) throw AppException.notFound('剧本不存在');
    const scene = map.scenes.find((item) => item.id === script.categoryId);
    return {
      script: (({ stages: _stages, ...view }) => view)(script),
      scene: {
        id: script.categoryId,
        name: scene?.name ?? '',
        nameEn: scene?.nameEn ?? null,
        icon: scene?.icon ?? null,
      },
      stages: script.stages,
      clearedCount: script.clearedCount,
      total: script.stageCount,
    };
  }

  /* ------------------------------ 剧本封面（AI 生图） ------------------------------ */

  /** 由文件 id 解析封面访问 URL（0/缺失返回 null）。 */
  private async coverUrlOf(fileId: bigint): Promise<string | null> {
    if (fileId <= 0n) return null;
    const file = await this.fileService.findById(Number(fileId));
    return file?.fileUrl ?? null;
  }

  /** 剧本封面生图提示词：场景 + 剧本名 + 统一风格后缀（硬性 no text）。 */
  private scriptCoverPrompt(sceneName: string, scriptName: string): string {
    return `A storybook illustration for an English-learning scenario story titled "${scriptName}", set in the everyday-life scene "${sceneName}", ${STAGE_COVER_STYLE_SUFFIX}`;
  }

  /**
   * 生成（或重新生成）某剧本封面：AI 生图 → 归一化尺寸转 webp → file 表落盘 → 回写 stage_script.cover_file_id。
   * @param regenerate 为 true 时即使已有封面也强制重生成
   */
  async generateScriptCover(scriptId: number, regenerate = false): Promise<{ scriptId: number; coverUrl: string }> {
    const script = await this.prisma.stageScript.findUnique({ where: { id: BigInt(scriptId) } });
    if (!script) throw AppException.notFound('剧本不存在');
    if (script.coverFileId > 0n && !regenerate) {
      const url = await this.coverUrlOf(script.coverFileId);
      if (url) return { scriptId, coverUrl: url };
      // file 记录已被删但封面引用还在：落下去重生成
      this.logger.warn(`[Stage] 剧本 ${scriptId} 的封面文件缺失，重新生成`);
    }
    const category = await this.prisma.sentenceCategory.findUnique({
      where: { id: script.categoryId },
      select: { name: true },
    });
    const prompt = this.scriptCoverPrompt(category?.name ?? 'daily life', script.name);
    const image = await withRetry(
      () =>
        this.imageGen.generate(prompt, {
          size: config.stage.coverSize,
          ratio: config.stage.coverRatio,
        }),
      { maxAttempts: 4, baseDelayMs: 5000, maxDelayMs: 30000 },
    );
    const webp = await normalizeGeneratedImage(image.buffer, {
      maxWidth: config.stage.coverMaxWidth,
      ratio: config.stage.coverRatio,
      quality: config.stage.coverQuality,
    });
    const saved = await this.fileService.save(`stage-script-cover-${scriptId}.webp`, 'image/webp', webp, null);
    const row = await this.prisma.stageScript.update({
      where: { id: script.id },
      data: { coverFileId: BigInt(saved.file.id) },
    });
    const coverUrl = (await this.coverUrlOf(row.coverFileId)) ?? saved.file.fileUrl;
    this.logger.log(`[Stage] 剧本 #${scriptId}「${script.name}」封面生成完成：${coverUrl}`);
    return { scriptId, coverUrl };
  }

  /**
   * 批量生成剧本封面（定时任务 / 后台按钮共用）：
   * - `force=false`：只补「还没有封面」的启用剧本，已有封面不覆盖（一键补全）；
   * - `force=true`：全部启用剧本强制重生成（批量重新生图，会覆盖已有图）。
   * 单个失败不影响其他剧本，结果里分 generated / skipped / failed 三档。
   */
  async batchGenerateScriptCovers(
    force: boolean,
  ): Promise<{ generated: number[]; skipped: number[]; failed: number[] }> {
    const scripts = await this.prisma.stageScript.findMany({
      where: { status: 1 },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      select: { id: true, coverFileId: true },
    });
    const generated: number[] = [];
    const skipped: number[] = [];
    const failed: number[] = [];
    for (const script of scripts) {
      if (!force && script.coverFileId > 0n) {
        skipped.push(Number(script.id));
        continue;
      }
      try {
        await this.generateScriptCover(Number(script.id), force);
        generated.push(Number(script.id));
      } catch (error) {
        failed.push(Number(script.id));
        this.logger.error(`[Stage] 剧本 #${script.id} 封面生成失败：${(error as Error).message}`);
      }
    }
    this.logger.log(
      `[Stage] 剧本封面批量生成完成（force=${force}）：新增 ${generated.length} 张，跳过 ${skipped.length} 张，失败 ${failed.length} 张`,
    );
    return { generated, skipped, failed };
  }

  /** 补齐缺失的剧本封面（定时任务用）：只生成「还没有封面」的启用剧本。 */
  async generateMissingScriptCovers(): Promise<{ generated: number[]; skipped: number[]; failed: number[] }> {
    return this.batchGenerateScriptCovers(false);
  }

  /** 批量重新生成全部启用剧本的封面（覆盖已有图，走足 AI 配额，谨慎使用）。 */
  async regenerateAllScriptCovers(): Promise<{ generated: number[]; skipped: number[]; failed: number[] }> {
    return this.batchGenerateScriptCovers(true);
  }

  /* ------------------------------ 剧本 / 关卡（stage_script / stage_story，后台可 CRUD） ------------------------------ */

  /**
   * 服务启动时用代码种子幂等回填：每个分类建一个「默认剧本」（已有同名则复用），
   * 剧本下已有任一关卡就跳过（不覆盖运营改动，也避免运营改名后被重复补种）。
   */
  async onModuleInit(): Promise<void> {
    const categories = await this.prisma.sentenceCategory.findMany({ select: { id: true, name: true } });
    const categoryByName = new Map(categories.map((row) => [row.name, row.id]));
    let createdScripts = 0;
    let createdStories = 0;

    for (const seed of STAGE_STORIES) {
      const categoryId = categoryByName.get(seed.category);
      if (!categoryId) continue;
      const scriptName = `${seed.category} · 默认剧本`;
      let script = await this.prisma.stageScript.findFirst({
        where: { categoryId, name: scriptName },
        select: { id: true },
      });
      if (!script) {
        script = await this.prisma.stageScript.create({
          data: { categoryId, name: scriptName, blurb: '从代码种子自动生成的默认剧本', sort: 0, status: 1 },
          select: { id: true },
        });
        createdScripts += 1;
      }
      // 该分类的默认剧本下已有任一关卡（运营已维护过）就不再补种——改名/改序都不受影响
      const exists = await this.prisma.stageStory.findFirst({ where: { scriptId: script.id }, select: { id: true } });
      if (exists) continue;
      await this.prisma.stageStory.create({
        data: {
          scriptId: script.id,
          title: seed.title,
          intro: seed.intro,
          outro: seed.outro,
          userRole: seed.userRole,
          setting: seed.setting,
          goal: seed.goal,
          minTurns: seed.minTurns,
          maxTurns: seed.maxTurns,
          target: seed.target,
          rewardXp: seed.rewardXp,
          roles: seed.roles as never,
          opening: seed.opening as never,
          starterHints: seed.starterHints as never,
          sort: 1,
        },
      });
      createdStories += 1;
    }
    if (createdScripts > 0 || createdStories > 0) {
      this.logger.log(`[Stage] 种子回填：新增剧本 ${createdScripts} 个、关卡 ${createdStories} 关`);
    }
  }

  /** 读取剧本（可按状态过滤），按 场景顺序 → 剧本 sort → id 排序。 */
  private async listScripts(status?: number): Promise<Array<StageScriptRow>> {
    const rows = await this.prisma.stageScript.findMany({ where: status === undefined ? {} : { status } });
    const categories = await this.prisma.sentenceCategory.findMany({
      select: { id: true, sort: true },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    const categoryOrder = new Map(categories.map((row, index) => [String(row.id), index]));
    return rows.sort(
      (a, b) =>
        (categoryOrder.get(String(a.categoryId)) ?? 99) - (categoryOrder.get(String(b.categoryId)) ?? 99) ||
        a.sort - b.sort ||
        Number(a.id - b.id),
    );
  }

  /** 读取某剧本（或全部）的关卡，按 sort → id 排序。 */
  private async listStories(scriptId?: number, status?: number): Promise<Array<StageStoryRow>> {
    const rows = await this.prisma.stageStory.findMany({
      where: {
        ...(scriptId !== undefined ? { scriptId: BigInt(scriptId) } : {}),
        ...(status !== undefined ? { status } : {}),
      },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    return rows;
  }

  /** stage_story 行 → 对话链路用的剧情结构（Json 字段做兜底解析，坏数据不炸整页）。 */
  private toStory(row: StageStoryRow): StageStory {
    return {
      // 剧情结构里 chapter/category 已无业务含义（层级改由 script 承载），保留字段以兼容对话 prompt
      chapter: '',
      category: '',
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
    };
  }

  /** 角色列表（只下发展示字段）。 */
  private rolesOf(raw: unknown): StageRoleView[] {
    if (!Array.isArray(raw)) return [];
    return (raw as unknown as StageRole[]).map((role) => ({ nameEn: role.nameEn, name: role.name, emoji: role.emoji }));
  }

  /** 按 storyId 取启用关卡（对话链路入口），顺带把所属剧本/场景带出来。 */
  private async storyOfId(storyId: number): Promise<{ story: StageStory; script: StageScriptRow } | undefined> {
    const row = await this.prisma.stageStory.findUnique({ where: { id: BigInt(storyId) } });
    if (!row || row.status !== 1) return undefined;
    const script = await this.prisma.stageScript.findUnique({ where: { id: row.scriptId } });
    if (!script || script.status !== 1) return undefined;
    return { story: this.toStory(row), script };
  }

  /** 校验并归一化关卡提交数据（新增/编辑共用）。返回可直接写库的 data。 */
  private async validateStoryInput(input: CreateStageStoryInput): Promise<Record<string, unknown>> {
    const script = await this.prisma.stageScript.findUnique({ where: { id: BigInt(input.scriptId) } });
    if (!script) throw AppException.badRequest(`剧本不存在：${input.scriptId}`);
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
      scriptId: BigInt(input.scriptId),
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

  /* ------------------------------ 后台：剧本 CRUD ------------------------------ */

  /** 后台-剧本列表（含停用，附场景名/封面/关卡数与参与统计）。 */
  async adminScripts(): Promise<StageScriptAdminItem[]> {
    const [scripts, categories, storyRows, sessionCounts] = await Promise.all([
      this.listScripts(),
      this.prisma.sentenceCategory.findMany({ select: { id: true, name: true } }),
      this.prisma.stageStory.findMany({ select: { id: true, scriptId: true, status: true } }),
      this.prisma.stageDialogueSession.groupBy({ by: ['storyId'], _count: { _all: true } }),
    ]);
    const categoryNameOf = new Map(categories.map((row) => [String(row.id), row.name]));
    const sessionOf = new Map(sessionCounts.map((row) => [String(row.storyId), row._count._all]));
    const storiesOfScript = new Map<string, Array<{ id: bigint; status: number }>>();
    for (const story of storyRows) {
      const key = String(story.scriptId);
      const list = storiesOfScript.get(key) ?? [];
      list.push(story);
      storiesOfScript.set(key, list);
    }
    const items: StageScriptAdminItem[] = [];
    for (const script of scripts) {
      const stories = storiesOfScript.get(String(script.id)) ?? [];
      items.push({
        id: Number(script.id),
        categoryId: Number(script.categoryId),
        categoryName: categoryNameOf.get(String(script.categoryId)) ?? '（分类已删除）',
        name: script.name,
        blurb: script.blurb,
        coverUrl: await this.coverUrlOf(script.coverFileId),
        sort: script.sort,
        status: script.status,
        stageCount: stories.length,
        enabledStageCount: stories.filter((row) => row.status === 1).length,
        sessionCount: stories.reduce((sum, row) => sum + (sessionOf.get(String(row.id)) ?? 0), 0),
        createdAt: script.createdAt.toISOString(),
      });
    }
    return items;
  }

  /** 后台-新增剧本：场景必须存在且启用，落到该场景 sort 末尾。 */
  async createScript(input: CreateStageScriptInput): Promise<{ id: number }> {
    const category = await this.prisma.sentenceCategory.findUnique({
      where: { id: BigInt(input.categoryId) },
      select: { id: true, status: true },
    });
    if (!category) throw AppException.badRequest(`场景分类不存在：${input.categoryId}`);
    if (category.status !== 1) throw AppException.badRequest('场景分类已停用');
    const name = input.name.trim();
    if (!name) throw AppException.badRequest('剧本名不能为空');
    const duplicate = await this.prisma.stageScript.findFirst({
      where: { categoryId: BigInt(input.categoryId), name },
      select: { id: true },
    });
    if (duplicate) throw AppException.conflict(`该场景下已有同名剧本「${name}」`);
    const last = await this.prisma.stageScript.aggregate({
      where: { categoryId: BigInt(input.categoryId) },
      _max: { sort: true },
    });
    const row = await this.prisma.stageScript.create({
      data: {
        categoryId: BigInt(input.categoryId),
        name,
        blurb: input.blurb?.trim() ?? '',
        sort: input.sort ?? (last._max.sort ?? 0) + 1,
        status: input.status ?? 1,
      },
    });
    this.logger.log(`[Stage] 新增剧本 #${row.id}「${row.name}」（场景 ${input.categoryId}）`);
    return { id: Number(row.id) };
  }

  /** 后台-编辑剧本：改名/简介/排序/启停；换场景会改变归属，允许但需校验。 */
  async updateScript(id: number, input: UpdateStageScriptInput): Promise<void> {
    const row = await this.prisma.stageScript.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw AppException.notFound('剧本不存在');
    if (input.categoryId !== undefined && Number(row.categoryId) !== input.categoryId) {
      const category = await this.prisma.sentenceCategory.findUnique({
        where: { id: BigInt(input.categoryId) },
        select: { id: true, status: true },
      });
      if (!category) throw AppException.badRequest(`场景分类不存在：${input.categoryId}`);
      if (category.status !== 1) throw AppException.badRequest('场景分类已停用');
    }
    const name = input.name?.trim();
    if (name !== undefined && name.length === 0) throw AppException.badRequest('剧本名不能为空');
    const categoryId = input.categoryId !== undefined ? BigInt(input.categoryId) : row.categoryId;
    if (name !== undefined && name !== row.name) {
      const duplicate = await this.prisma.stageScript.findFirst({
        where: { categoryId, name, NOT: { id: row.id } },
        select: { id: true },
      });
      if (duplicate) throw AppException.conflict(`该场景下已有同名剧本「${name}」`);
    }
    await this.prisma.stageScript.update({
      where: { id: row.id },
      data: {
        ...(input.categoryId !== undefined ? { categoryId } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(input.blurb !== undefined ? { blurb: input.blurb.trim() } : {}),
        ...(input.sort !== undefined ? { sort: input.sort } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
    this.logger.log(`[Stage] 编辑剧本 #${row.id}「${row.name}」`);
  }

  /** 后台-启停剧本：停用后客户端整条剧本线不可见，历史进度保留。 */
  async setScriptStatus(id: number, status: 0 | 1): Promise<void> {
    const row = await this.prisma.stageScript.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw AppException.notFound('剧本不存在');
    await this.prisma.stageScript.update({ where: { id: row.id }, data: { status } });
    this.logger.log(`[Stage] 剧本 #${row.id}「${row.name}」${status === 1 ? '启用' : '停用'}`);
  }

  /** 后台-删除剧本：连同其下关卡一起删（进度/会话按 storyId 记，保留不伤历史）。 */
  async deleteScript(id: number): Promise<{ deletedStories: number }> {
    const row = await this.prisma.stageScript.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw AppException.notFound('剧本不存在');
    const deleted = await this.prisma.stageStory.deleteMany({ where: { scriptId: row.id } });
    await this.prisma.stageScript.delete({ where: { id: row.id } });
    this.logger.log(`[Stage] 删除剧本 #${row.id}「${row.name}」及其 ${deleted.count} 个关卡`);
    return { deletedStories: deleted.count };
  }

  /* ------------------------------ 后台：关卡 CRUD ------------------------------ */

  /** 后台-关卡列表（含停用的，附剧本/场景名与统计）。 */
  async adminStories(): Promise<StageStoryAdminItem[]> {
    const [rows, scripts, categories, sessionCounts, participantRaw, clearedCounts] = await Promise.all([
      this.prisma.stageStory.findMany(),
      this.prisma.stageScript.findMany({ select: { id: true, name: true, categoryId: true } }),
      this.prisma.sentenceCategory.findMany({ select: { id: true, name: true } }),
      this.prisma.stageDialogueSession.groupBy({ by: ['storyId'], _count: { _all: true } }),
      this.prisma.stageDialogueSession.groupBy({ by: ['userId', 'storyId'], _count: { _all: true } }),
      this.prisma.studyStageProgress.groupBy({
        by: ['storyId'],
        where: { dialogueClearedAt: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const scriptOf = new Map(scripts.map((row) => [String(row.id), row]));
    const categoryNameOf = new Map(categories.map((row) => [String(row.id), row.name]));
    const sessionOf = new Map(sessionCounts.map((row) => [String(row.storyId), row._count._all]));
    const clearedOf = new Map(clearedCounts.map((row) => [String(row.storyId), row._count._all]));
    const participantOf = new Map<string, number>();
    for (const row of participantRaw) {
      const key = String(row.storyId);
      participantOf.set(key, (participantOf.get(key) ?? 0) + 1);
    }
    const scriptOrder = new Map(scripts.map((row, index) => [String(row.id), index]));
    return rows
      .map((row) => {
        const script = scriptOf.get(String(row.scriptId));
        return {
          id: Number(row.id),
          scriptId: Number(row.scriptId),
          scriptName: script?.name ?? '（剧本已删除）',
          categoryId: script ? Number(script.categoryId) : null,
          categoryName: script ? (categoryNameOf.get(String(script.categoryId)) ?? '（分类已删除）') : '（剧本已删除）',
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
          sessionCount: sessionOf.get(String(row.id)) ?? 0,
          participantCount: participantOf.get(String(row.id)) ?? 0,
          clearedCount: clearedOf.get(String(row.id)) ?? 0,
          createdAt: row.createdAt.toISOString(),
        };
      })
      .sort(
        (a, b) =>
          (scriptOrder.get(String(a.scriptId)) ?? 99) - (scriptOrder.get(String(b.scriptId)) ?? 99) ||
          a.sort - b.sort ||
          a.id - b.id,
      );
  }

  /** 后台-新增关卡：落到该剧本 sort 末尾。 */
  async createStory(input: CreateStageStoryInput): Promise<{ id: number }> {
    const data = await this.validateStoryInput(input);
    const last = await this.prisma.stageStory.aggregate({
      where: { scriptId: BigInt(input.scriptId) },
      _max: { sort: true },
    });
    const row = await this.prisma.stageStory.create({
      data: { ...data, sort: (last._max.sort ?? 0) + 1, status: 1 } as never,
    });
    this.logger.log(`[Stage] 新增关卡 #${row.id}「${row.title}」（剧本 ${input.scriptId}）`);
    return { id: Number(row.id) };
  }

  /** 后台-编辑关卡：未提交字段回落到旧值，再整体校验；允许换剧本。 */
  async updateStory(id: number, input: UpdateStageStoryInput): Promise<void> {
    const row = await this.prisma.stageStory.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw AppException.notFound('关卡不存在');
    const merged = {
      scriptId: input.scriptId ?? Number(row.scriptId),
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
    const data = await this.validateStoryInput(merged);
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

  /** 后台-删除关卡：物理删除（进度/会话按 storyId 记，保留不伤历史）。 */
  async deleteStory(id: number): Promise<{ sessionCount: number }> {
    const row = await this.prisma.stageStory.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw AppException.notFound('关卡不存在');
    const sessionCount = await this.prisma.stageDialogueSession.count({ where: { storyId: row.id } });
    await this.prisma.stageStory.delete({ where: { id: row.id } });
    this.logger.log(`[Stage] 删除关卡 #${row.id}「${row.title}」（关联会话 ${sessionCount} 条保留）`);
    return { sessionCount };
  }

  /** 后台-剧本内排序：ids 必须全部属于该剧本，按数组顺序重写 sort。 */
  async reorderStories(scriptId: number, ids: number[]): Promise<void> {
    const script = await this.prisma.stageScript.findUnique({ where: { id: BigInt(scriptId) }, select: { id: true } });
    if (!script) throw AppException.badRequest(`剧本不存在：${scriptId}`);
    const rows = await this.prisma.stageStory.findMany({
      where: { id: { in: ids.map((id) => BigInt(id)) } },
      select: { id: true, scriptId: true },
    });
    if (rows.length !== ids.length || rows.some((row) => row.scriptId !== script.id)) {
      throw AppException.badRequest('ids 必须全部属于该剧本');
    }
    await this.prisma.$transaction(
      ids.map((id, index) => this.prisma.stageStory.update({ where: { id: BigInt(id) }, data: { sort: index + 1 } })),
    );
  }

  /**
   * 后台-AI 生成关卡草稿：校验剧本后调文本模型出一整套剧情，**不落库**——
   * 返回草稿由运营在编辑弹窗里审核/微调，确认后再走 createStory 入库。
   */
  async generateStoryDraft(scriptId: number): Promise<StageStoryDraft & { scriptId: number }> {
    const script = await this.prisma.stageScript.findUnique({ where: { id: BigInt(scriptId) } });
    if (!script) throw AppException.badRequest(`剧本不存在：${scriptId}`);
    const category = await this.prisma.sentenceCategory.findUnique({
      where: { id: script.categoryId },
      select: { name: true, status: true },
    });
    if (!category) throw AppException.badRequest('剧本所属场景分类不存在');
    if (category.status !== 1) throw AppException.badRequest('剧本所属场景分类已停用');
    const existing = await this.prisma.stageStory.findMany({
      where: { scriptId: script.id },
      select: { title: true },
    });
    const draft = await this.ai.generateStageStory(
      `场景「${category.name}」下的剧本「${script.name}」`,
      category.name,
      existing.map((row) => row.title),
    );
    this.logger.log(`[Stage] AI 生成关卡草稿「${draft.title}」（剧本 ${scriptId}），待审核`);
    return { ...draft, scriptId };
  }

  /* ------------------------------ 场景长对话 ------------------------------ */

  /**
   * 进入关卡：有进行中的会话就续聊，否则新建并把开场白写进消息表。
   * @param storyId 关卡 id（stage_story.id）
   * @param restart 为 true 时把旧会话标记 abandoned 后重新开一局
   */
  async startDialogue(userId: number, storyId: number, restart = false): Promise<StageDialogueView> {
    const found = await this.storyOfId(storyId);
    if (!found) throw AppException.notFound('关卡不存在');
    const { story, script } = found;
    await this.assertUnlocked(userId, storyId);

    const uid = BigInt(userId);
    const sid = BigInt(storyId);
    const active = await this.prisma.stageDialogueSession.findFirst({
      where: { userId: uid, storyId: sid, status: 'active' },
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
          storyId: sid,
          // categoryId 仅作统计维度（按场景汇总会话数），玩法进度按 storyId 记
          categoryId: script.categoryId,
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
    this.logger.log(`情景对话开始 user=${userId} story=${storyId} session=${session.id}`);
    return this.dialogueView(session, story);
  }

  /** 只读取进行中的会话（没有返回 null，用于刷新页面时判断）。 */
  async getDialogue(userId: number, storyId: number): Promise<StageDialogueView | null> {
    const found = await this.storyOfId(storyId);
    if (!found) throw AppException.notFound('关卡不存在');
    const active = await this.prisma.stageDialogueSession.findFirst({
      where: { userId: BigInt(userId), storyId: BigInt(storyId), status: 'active' },
      orderBy: { id: 'desc' },
    });
    return active ? this.dialogueView(active, found.story) : null;
  }

  /**
   * 用户说一句 → 模型以 1~3 个角色回应 → 判定是否结束。
   *
   * 顺序很关键：**先拿到模型输出，再一次性落库**（用户消息 + NPC 台词），
   * AI 挂了就不写任何东西，用户可原样重发，不会留下半截对话。
   */
  async sendMessage(userId: number, storyId: number, raw: string, showTranslation = true): Promise<StageTurnResult> {
    const found = await this.storyOfId(storyId);
    if (!found) throw AppException.notFound('关卡不存在');
    const story = found.story;
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
    const sid = BigInt(storyId);
    const storyCategoryId = found.script.categoryId;
    const session = await this.prisma.stageDialogueSession.findFirst({
      where: { userId: uid, storyId: sid, status: 'active' },
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
          where: { userId_storyId: { userId: uid, storyId: sid } },
          create: {
            userId: uid,
            storyId: sid,
            categoryId: storyCategoryId,
            dialogueClearedAt: new Date(),
            dialogueTurns: turnCount,
          },
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
  async endDialogue(userId: number, storyId: number): Promise<StageDialogueView> {
    const found = await this.storyOfId(storyId);
    if (!found) throw AppException.notFound('关卡不存在');
    const story = found.story;
    const session = await this.prisma.stageDialogueSession.findFirst({
      where: { userId: BigInt(userId), storyId: BigInt(storyId), status: 'active' },
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
        where: { userId_storyId: { userId: BigInt(userId), storyId: BigInt(storyId) } },
        create: {
          userId: BigInt(userId),
          storyId: BigInt(storyId),
          categoryId: found.script.categoryId,
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

  /** 校验关卡是否已解锁（剧本内顺序解锁）。 */
  private async assertUnlocked(userId: number, storyId: number): Promise<void> {
    const overview = await this.getStages(userId);
    const stage = overview.chapters.flatMap((item) => item.stages).find((item) => item.id === storyId);
    if (!stage) throw AppException.notFound('关卡不存在');
    if (!stage.unlocked) throw AppException.badRequest('先完成上一关的场景对话吧');
  }

  /* ------------------------------ 旧版答题统计 ------------------------------ */

  /**
   * 记录一次作答（旧版口径，仅保留历史统计）。
   * 不再写 dialogueClearedAt，不影响解锁与通关；任何异常都不应影响答题结果。
   */
  async recordAnswer(userId: number, categoryId: number, categoryName: string, isCorrect: boolean): Promise<void> {
    // 只记录「有剧本归属」的场景（答题链路对每题都会调过来，未归属直接跳过）
    const script = await this.prisma.stageScript.findFirst({
      where: { categoryId: BigInt(categoryId), status: 1 },
      select: { id: true },
    });
    if (!script) return;
    const uid = BigInt(userId);
    const cid = BigInt(categoryId);
    // 旧版答题统计按分类记一行（storyId 为空），与关卡对话进度分开
    const existing = await this.prisma.studyStageProgress.findFirst({
      where: { userId: uid, categoryId: cid, storyId: null },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.studyStageProgress.update({
        where: { id: existing.id },
        data: {
          answerCount: { increment: 1 },
          ...(isCorrect ? { correctCount: { increment: 1 } } : {}),
        },
      });
      return;
    }
    await this.prisma.studyStageProgress.create({
      data: { userId: uid, categoryId: cid, correctCount: isCorrect ? 1 : 0, answerCount: 1 },
    });
  }

  /** 领取通关奖励（幂等；只认对话通关）。无翻译通关额外加成。 */
  async claim(userId: number, storyId: number): Promise<ClaimResult> {
    const found = await this.storyOfId(storyId);
    if (!found) throw AppException.notFound('关卡不存在');
    const story = found.story;

    const uid = BigInt(userId);
    const sid = BigInt(storyId);
    const [progress, user, existing, clearing] = await Promise.all([
      this.prisma.studyStageProgress.findUnique({
        where: { userId_storyId: { userId: uid, storyId: sid } },
        select: { dialogueClearedAt: true },
      }),
      this.prisma.clientUser.findUnique({ where: { id: uid }, select: { xp: true } }),
      this.prisma.clientXpLog.findUnique({ where: { eventKey: claimKey(userId, storyId) }, select: { id: true } }),
      // 找出通关的那一局（最近一次 cleared 的会话），用它的 translationUsed 判定是否无翻译通关
      this.prisma.stageDialogueSession.findFirst({
        where: { userId: uid, storyId: sid, cleared: true },
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

    const baseAwarded = await this.gamify.awardXp(userId, 'stage_clear', claimKey(userId, storyId), story.rewardXp);
    const bonusAwarded =
      bonus > 0 ? await this.gamify.awardXp(userId, 'stage_no_translation', bonusKey(userId, storyId), bonus) : false;
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
  async setTranslation(userId: number, storyId: number, show: boolean): Promise<{ showTranslation: boolean }> {
    const session = await this.prisma.stageDialogueSession.findFirst({
      where: { userId: BigInt(userId), storyId: BigInt(storyId), status: 'active' },
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
    const categoryById = new Map(categories.map((row) => [String(row.id), row]));

    // 一次性聚合各关卡的会话/进度统计，避免每关一条查询
    const [sessionAll, sessionActive, sessionCleared, sessionNoTrans, clearedProgress, participantRaw, claimKeys] =
      await Promise.all([
        this.prisma.stageDialogueSession.groupBy({ by: ['storyId'], _count: { _all: true } }),
        this.prisma.stageDialogueSession.groupBy({
          by: ['storyId'],
          where: { status: 'active' },
          _count: { _all: true },
        }),
        this.prisma.stageDialogueSession.groupBy({
          by: ['storyId'],
          where: { cleared: true },
          _count: { _all: true },
          _avg: { turnCount: true },
        }),
        this.prisma.stageDialogueSession.groupBy({
          by: ['storyId'],
          where: { cleared: true, translationUsed: false },
          _count: { _all: true },
        }),
        this.prisma.studyStageProgress.groupBy({
          by: ['storyId'],
          where: { dialogueClearedAt: { not: null } },
          _count: { _all: true },
        }),
        // 参与人数 = 去重用户数，Prisma 的 count(distinct) 按关卡逐条太碎，用一条原生聚合
        this.prisma.$queryRaw<Array<{ sid: bigint; cnt: bigint | number }>>`
          SELECT story_id AS sid, COUNT(DISTINCT user_id) AS cnt
          FROM stage_dialogue_session
          GROUP BY story_id`,
        // 领奖数：eventKey = `stage:{userId}:{storyId}`；startsWith 'stage:' 天然排除 stage-bonus:
        this.prisma.clientXpLog.findMany({ where: { eventKey: { startsWith: 'stage:' } }, select: { eventKey: true } }),
      ]);

    const countOf = (rows: Array<{ storyId: bigint | null; _count: { _all: number } }>, sid: bigint): number =>
      rows.find((row) => row.storyId === sid)?._count._all ?? 0;
    const avgOf = (
      rows: Array<{ storyId: bigint | null; _avg: { turnCount: number | null } }>,
      sid: bigint,
    ): number | null => {
      const hit = rows.find((row) => row.storyId === sid);
      return hit?._avg.turnCount ?? null;
    };
    const participantOf = new Map<string, number>(participantRaw.map((row) => [String(row.sid), Number(row.cnt)]));
    const claimedOf = new Map<string, number>();
    for (const row of claimKeys) {
      // 解析 `stage:{userId}:{storyId}` 的末段 storyId
      const parts = row.eventKey.split(':');
      const sid = parts[2];
      if (sid) claimedOf.set(sid, (claimedOf.get(sid) ?? 0) + 1);
    }

    const [scripts, stories] = await Promise.all([this.listScripts(1), this.listStories(undefined, 1)]);
    const chapters: StageAdminChapter[] = [];
    for (const script of scripts) {
      const category = categoryById.get(String(script.categoryId));
      if (!category) continue;
      const stages: StageAdminOverviewItem[] = [];
      for (const story of stories.filter((item) => item.scriptId === script.id)) {
        const sid = story.id;
        const cleared = countOf(clearedProgress as never, sid);
        const claimed = claimedOf.get(String(sid)) ?? 0;
        stages.push({
          id: Number(sid),
          scriptId: Number(script.id),
          scriptName: script.name,
          categoryName: category.name,
          title: story.title,
          goal: story.goal,
          minTurns: story.minTurns,
          maxTurns: story.maxTurns,
          rewardXp: story.rewardXp,
          sessionCount: countOf(sessionAll as never, sid),
          activeSessionCount: countOf(sessionActive as never, sid),
          participantCount: participantOf.get(String(sid)) ?? 0,
          clearedCount: cleared,
          clearedSessionCount: countOf(sessionCleared as never, sid),
          avgClearedTurns: avgOf(sessionCleared as never, sid),
          noTranslationClearedCount: countOf(sessionNoTrans as never, sid),
          claimableCount: Math.max(0, cleared - claimed),
        });
      }
      if (stages.length > 0) {
        chapters.push({
          key: `script-${script.id}`,
          name: script.name,
          subtitle: script.blurb,
          coverUrl: await this.coverUrlOf(script.coverFileId),
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
          storyId: true,
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
    // 关卡标题从 stage_story 表取（关卡被删时回落分类名）
    const storyRows = await this.prisma.stageStory.findMany({
      where: { id: { in: rows.map((row) => row.storyId) } },
      select: { id: true, title: true },
    });
    const storyTitleOf = new Map(storyRows.map((row) => [String(row.id), row.title]));

    const list: StageSessionAdminItem[] = rows.map((row) => {
      const categoryName = categoryNames.get(String(row.categoryId)) ?? '';
      return {
        id: Number(row.id),
        userId: Number(row.userId),
        nickname: nicknameOf.get(String(row.userId)) ?? `用户${Number(row.userId)}`,
        categoryId: Number(row.categoryId),
        storyId: Number(row.storyId),
        stageTitle: storyTitleOf.get(String(row.storyId)) ?? categoryName,
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
        storyId: true,
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
    const [messages, user, category, story] = await Promise.all([
      this.prisma.stageDialogueMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { id: 'asc' },
        select: { id: true, role: true, speaker: true, contentEn: true, contentZh: true, createdAt: true },
      }),
      this.prisma.clientUser.findUnique({ where: { id: session.userId }, select: { nickname: true } }),
      this.prisma.sentenceCategory.findUnique({ where: { id: session.categoryId }, select: { name: true } }),
      this.prisma.stageStory.findUnique({
        where: { id: session.storyId },
        select: { title: true, goal: true },
      }),
    ]);
    return {
      id: Number(session.id),
      userId: Number(session.userId),
      nickname: user?.nickname ?? `用户${Number(session.userId)}`,
      categoryId: Number(session.categoryId),
      storyId: Number(session.storyId),
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
  scriptId: number;
  scriptName: string;
  categoryName: string;
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

/** 后台-关卡总览分组（一个剧本一组，兼容旧字段名 chapter）。 */
export interface StageAdminChapter {
  key: string;
  name: string;
  subtitle: string;
  /** AI 封面图 URL；未生成时为 null（后台可据此显示「待生成」） */
  coverUrl: string | null;
  stages: StageAdminOverviewItem[];
}

/** 后台-剧本管理条目。 */
export interface StageScriptAdminItem {
  id: number;
  categoryId: number;
  categoryName: string;
  name: string;
  blurb: string;
  coverUrl: string | null;
  sort: number;
  /** 1 启用 / 0 停用 */
  status: number;
  /** 剧本下关卡总数（含停用） */
  stageCount: number;
  enabledStageCount: number;
  sessionCount: number;
  createdAt: string;
}

/** 新增/编辑剧本的提交数据。 */
export interface CreateStageScriptInput {
  categoryId: number;
  name: string;
  blurb?: string;
  sort?: number;
  status?: 0 | 1;
}

/** 编辑剧本：全字段可选。 */
export type UpdateStageScriptInput = Partial<CreateStageScriptInput>;

/** 新增/编辑关卡的提交数据（DTO 与 service 共用的形状）。 */
export interface CreateStageStoryInput {
  /** 所属剧本 id（stage_script.id） */
  scriptId: number;
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

/** 编辑关卡：全字段可选（允许换剧本）。 */
export type UpdateStageStoryInput = Partial<CreateStageStoryInput>;

/** 后台-关卡管理条目。 */
export interface StageStoryAdminItem {
  id: number;
  scriptId: number;
  scriptName: string;
  /** 剧本所属分类 id（剧本被删时为 null） */
  categoryId: number | null;
  categoryName: string;
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

/** stage_script 行（内部组装用）。 */
interface StageScriptRow {
  id: bigint;
  categoryId: bigint;
  name: string;
  blurb: string;
  coverFileId: bigint;
  sort: number;
  status: number;
  createdAt: Date;
  updatedAt: Date;
}

/** stage_story 行（内部组装用）。 */
interface StageStoryRow {
  id: bigint;
  scriptId: bigint;
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
  sort: number;
  status: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 后台-会话列表条目。 */
export interface StageSessionAdminItem {
  id: number;
  userId: number;
  nickname: string;
  categoryId: number;
  /** 关卡 id（stage_story.id） */
  storyId: number;
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
