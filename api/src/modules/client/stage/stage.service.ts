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
import { isFestivalName } from '../../../common/calendar/festivals.js';
import {
  AgnesSentenceProvider,
  type StageDialogueHint,
  type StageDialogueReply,
  type StageDialogueSummary,
} from '../../../common/ai/agnes-sentence.provider.js';
import { AppException } from '../../../common/exception/app.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { GamifyService } from '../gamify/gamify.service.js';
import {
  STAGE_CHAPTERS,
  STAGE_STORIES,
  STAGE_TOTAL,
  stageRoleOf,
  stageStoryOf,
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
  ) {}

  /** 闯关地图：章节 + 关卡 + 我的对话进度。 */
  async getStages(userId: number): Promise<StageOverview> {
    const uid = BigInt(userId);
    const [categories, progresses, claims, activeSessions, bankCounts] = await Promise.all([
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
      const stories = STAGE_STORIES.filter((item) => item.chapter === chapter.key);
      const stages: StageView[] = [];
      // 章内顺序解锁：上一关未通关，下一关锁住
      let previousCleared = true;

      for (const story of stories) {
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
          stages,
          clearedCount: stages.filter((item) => item.cleared).length,
          total: stages.length,
        });
      }
    }

    return {
      chapters,
      clearedStages,
      totalStages: Math.min(
        STAGE_TOTAL,
        chapters.reduce((sum, item) => sum + item.total, 0),
      ),
      activeStages,
      claimable,
      recommendedId,
    };
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
    const story = stageStoryOf(categoryName);
    if (!story) return;
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

  /** 按分类 id 反查剧情（分类名 → 剧情）。 */
  private async storyOfCategory(categoryId: number): Promise<StageStory | undefined> {
    const category = await this.prisma.sentenceCategory.findUnique({
      where: { id: BigInt(categoryId) },
      select: { name: true },
    });
    return category ? stageStoryOf(category.name) : undefined;
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
