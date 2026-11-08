/**
 * 情景闯关服务（关卡 = 场景分类）。
 *
 * 设计要点：
 * - **进度单独落库**（`study_stage_progress`）：答题记录只保留 30 天，若派生计算
 *   会出现「一个月后关卡重新上锁、进度倒退」的荒谬体验。
 * - **解锁规则**：每章第一关默认解锁，章内顺序解锁。四章是平行入口，
 *   不逼用户按唯一顺序从头刷。
 * - **奖励幂等**：复用 GamifyService 的 XP 幂等键（`stage:{userId}:{categoryId}`），
 *   不另建领取记录表。
 */
import { Injectable } from '@nestjs/common';
import { isFestivalName } from '../../../common/calendar/festivals.js';
import { AppException } from '../../../common/exception/app.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { GamifyService } from '../gamify/gamify.service.js';
import { STAGE_CHAPTERS, STAGE_STORIES, STAGE_TOTAL, type StageStory, stageStoryOf } from './stage-stories.js';

/** 单关视图。 */
export interface StageView {
  /** 关卡 id = 场景分类 id（前端用它跳转按场景刷题） */
  id: number;
  /** 场景名（如「餐饮美食」） */
  name: string;
  nameEn: string | null;
  icon: string | null;
  /** 剧情化关卡标题 */
  title: string;
  intro: string;
  /** 通关剧情（未通关时前端可提示「通关解锁」但不展示正文） */
  outro: string;
  /** 通关所需累计答对数 */
  target: number;
  rewardXp: number;
  /** 该场景累计答对数（展示时按 target 封顶） */
  correctCount: number;
  /** 该场景累计作答数 */
  answerCount: number;
  /** 进度百分比 0~100 */
  progress: number;
  /** 是否已通关 */
  cleared: boolean;
  /** 是否已解锁（章内前一关已通关） */
  unlocked: boolean;
  /** 奖励是否已领取 */
  claimed: boolean;
  /** 该场景当前可刷题数（0 = 题库准备中，前端不必引导） */
  bankCount: number;
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
  /** 已通关关卡数 */
  clearedStages: number;
  totalStages: number;
  /** 已解锁但未通关的关卡数（首页引导「继续闯关」） */
  activeStages: number;
  /** 可领取奖励的关卡数 */
  claimable: number;
  /** 当前推荐关卡（第一关未通关的已解锁关卡） */
  recommendedId: number | null;
}

/** 通关奖励的 XP 幂等键。 */
function claimKey(userId: number, categoryId: number): string {
  return `stage:${userId}:${categoryId}`;
}

@Injectable()
export class StageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamify: GamifyService,
  ) {}

  /** 闯关地图：章节 + 关卡 + 我的进度。 */
  async getStages(userId: number): Promise<StageOverview> {
    const uid = BigInt(userId);
    const [categories, progresses, bankCounts, claims] = await Promise.all([
      this.prisma.sentenceCategory.findMany({
        where: { status: 1 },
        orderBy: [{ sort: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true, nameEn: true, icon: true },
      }),
      this.prisma.studyStageProgress.findMany({
        where: { userId: uid },
        select: { categoryId: true, correctCount: true, answerCount: true, clearedAt: true },
      }),
      this.prisma.sentence.groupBy({
        by: ['categoryId'],
        // 与抽题口径一致：无配图的题不下发，也不该算作「可刷」
        where: { status: 'ready', retiredAt: null, imageFileId: { gt: 0n } },
        _count: { _all: true },
      }),
      this.prisma.clientXpLog.findMany({
        where: { userId: uid, eventKey: { startsWith: `stage:${userId}:` } },
        select: { eventKey: true },
      }),
    ]);

    const categoryByName = new Map(categories.filter((row) => !isFestivalName(row.name)).map((row) => [row.name, row]));
    const progressByCategory = new Map(progresses.map((row) => [String(row.categoryId), row]));
    const bankByCategory = new Map(bankCounts.map((row) => [String(row.categoryId), row._count._all]));
    const claimedSet = new Set(claims.map((row) => row.eventKey));

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
        const correctCount = progress?.correctCount ?? 0;
        const cleared = Boolean(progress?.clearedAt) || correctCount >= story.target;
        const unlocked = previousCleared;
        const claimed = claimedSet.has(claimKey(userId, id));

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
          target: story.target,
          rewardXp: story.rewardXp,
          correctCount: Math.min(correctCount, story.target),
          answerCount: progress?.answerCount ?? 0,
          progress: Math.min(100, Math.round((correctCount / story.target) * 100)),
          cleared,
          unlocked,
          claimed,
          bankCount: bankByCategory.get(String(category.id)) ?? 0,
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
      // 与成就同口径：以配置的关卡数为分母，不让「运营加了分类」把进度条压下去
      totalStages: Math.min(
        STAGE_TOTAL,
        chapters.reduce((sum, item) => sum + item.total, 0),
      ),
      activeStages,
      claimable,
      recommendedId,
    };
  }

  /**
   * 记录一次作答对关卡进度的推进（只答对才 +1）。
   *
   * 调用方是答题主链路，**任何异常都不应影响答题结果**——由调用方 try/catch。
   */
  async recordAnswer(userId: number, categoryId: number, categoryName: string, isCorrect: boolean): Promise<void> {
    const story = stageStoryOf(categoryName);
    // 运营新加的分类还没配剧情：不记进度，避免出现「点不进去的关卡」
    if (!story) return;

    const uid = BigInt(userId);
    const cid = BigInt(categoryId);
    const row = await this.prisma.studyStageProgress.upsert({
      where: { userId_categoryId: { userId: uid, categoryId: cid } },
      create: {
        userId: uid,
        categoryId: cid,
        correctCount: isCorrect ? 1 : 0,
        answerCount: 1,
      },
      update: {
        answerCount: { increment: 1 },
        ...(isCorrect ? { correctCount: { increment: 1 } } : {}),
      },
      select: { correctCount: true, clearedAt: true },
    });

    // 刚越过通关线：只写一次 clearedAt，之后答对不再改写
    if (!row.clearedAt && row.correctCount >= story.target) {
      await this.prisma.studyStageProgress.update({
        where: { userId_categoryId: { userId: uid, categoryId: cid } },
        data: { clearedAt: new Date() },
      });
    }
  }

  /** 领取通关奖励（幂等：重复领取不重复发放）。 */
  async claim(userId: number, categoryId: number): Promise<ClaimResult> {
    const story = await this.storyOfCategory(categoryId);
    if (!story) throw AppException.notFound('关卡不存在');

    const uid = BigInt(userId);
    const cid = BigInt(categoryId);
    const [progress, user, existing] = await Promise.all([
      this.prisma.studyStageProgress.findUnique({
        where: { userId_categoryId: { userId: uid, categoryId: cid } },
        select: { correctCount: true, clearedAt: true },
      }),
      this.prisma.clientUser.findUnique({ where: { id: uid }, select: { xp: true } }),
      this.prisma.clientXpLog.findUnique({ where: { eventKey: claimKey(userId, categoryId) }, select: { id: true } }),
    ]);

    if (!progress || (!progress.clearedAt && progress.correctCount < story.target)) {
      throw AppException.badRequest(`尚未通关，在该场景累计答对 ${story.target} 句即可领取`);
    }
    if (existing) {
      // 已领过：rewardXp 报 0（接口语义是「本次实发」），前端据 alreadyClaimed 展示「已领取」
      return { awarded: false, alreadyClaimed: true, rewardXp: 0, xp: user?.xp ?? 0 };
    }

    const awarded = await this.gamify.awardXp(userId, 'stage_clear', claimKey(userId, categoryId), story.rewardXp);
    const latest = awarded
      ? await this.prisma.clientUser.findUnique({ where: { id: uid }, select: { xp: true } })
      : user;
    return {
      awarded,
      alreadyClaimed: false,
      rewardXp: awarded ? story.rewardXp : 0,
      xp: latest?.xp ?? 0,
    };
  }

  /** 已通关关卡数（成就判定用；只数配置了剧情的场景）。 */
  async clearedCount(userId: number): Promise<number> {
    return this.prisma.studyStageProgress.count({
      where: { userId: BigInt(userId), clearedAt: { not: null } },
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
  /** 本次实发经验（已领过或撞上限为 0） */
  rewardXp: number;
  /** 领取后的总经验 */
  xp: number;
}
