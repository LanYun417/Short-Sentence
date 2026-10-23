/**
 * 微游戏化服务（客户端）。
 * 模块职责：XP 发放（幂等）/ CEFR 等级 / 成就解锁（幂等）/ 成长概览（含场景探索地图）。
 *
 * 三条红线（见 gamify.prisma）：
 * 1. **服务端权威**：XP 只由后端按真实事件发放，客户端只上报「发生了什么」，不传经验值；
 * 2. **幂等**：client_xp_log.event_key / user_achievement(userId+code) 唯一，重复请求不重复发奖；
 * 3. **只加不减**：无扣减 / 衰减 / 断签清空。
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';

/** XP 发放规则（服务端权威，客户端不参与）。 */
export const XP_RULES = {
  /** 首次答对（该题此前无作答记录） */
  answer_correct_first: 10,
  /** 复习答对 */
  answer_correct_review: 5,
  /** 答错（仍给少量正反馈，不惩罚） */
  answer_wrong: 2,
  /** 收藏一句 */
  favorite: 3,
  /** 完成每日目标 */
  daily_goal: 20,
} as const;

/** CEFR 等级阈值（XP → 等级，只增不减）。 */
export const LEVELS = [
  { code: 'A1', name: '入门', min: 0 },
  { code: 'A2', name: '基础', min: 200 },
  { code: 'B1', name: '进阶', min: 600 },
  { code: 'B2', name: '高阶', min: 1500 },
  { code: 'C1', name: '精通', min: 3000 },
  { code: 'C2', name: '母语级', min: 6000 },
] as const;

/** 等级信息。 */
export interface LevelInfo {
  code: string;
  name: string;
  /** 当前等级起始 XP */
  min: number;
  /** 下一等级起始 XP（满级为 null） */
  next: number | null;
  /** 距下一等级还需 XP（满级为 0） */
  toNext: number;
  /** 当前等级进度（0~100，满级为 100） */
  progress: number;
}

/** 成就条目（含解锁状态）。 */
export interface AchievementView {
  code: string;
  name: string;
  description: string;
  /** lucide 图标名（前端拼 i-lucide-*） */
  icon: string;
  /** 分组：persist 坚持 / behavior 行为 / luck 运气 */
  category: string;
  rewardXp: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

/** 场景探索地图条目。 */
export interface SceneMapItem {
  id: number;
  name: string;
  nameEn: string | null;
  icon: string | null;
  /** 是否已解锁（练过该场景至少 1 句） */
  unlocked: boolean;
  /** 该场景已练句子数（按 sentenceId 去重） */
  practicedCount: number;
}

/** 成长概览。 */
export interface GamifyOverview {
  xp: number;
  level: LevelInfo;
  achievements: AchievementView[];
  unlockedAchievements: number;
  totalAchievements: number;
  sceneMap: SceneMapItem[];
  unlockedScenes: number;
  totalScenes: number;
}

/** 成就判定上下文（一次查询、多处复用）。 */
interface AchievementContext {
  answerCount: number;
  correctCount: number;
  favoriteCount: number;
  streak: number;
  unlockedCategories: number;
  totalCategories: number;
  xp: number;
}

/**
 * 成就判定规则（按 code 硬编码：成就定义是随发布演进的种子数据，
 * 判定逻辑属于业务代码，二者通过 code 关联）。
 */
const CONDITIONS: Record<string, (ctx: AchievementContext) => boolean> = {
  first_step: (ctx) => ctx.answerCount >= 1,
  streak_3: (ctx) => ctx.streak >= 3,
  streak_7: (ctx) => ctx.streak >= 7,
  streak_30: (ctx) => ctx.streak >= 30,
  correct_50: (ctx) => ctx.correctCount >= 50,
  correct_200: (ctx) => ctx.correctCount >= 200,
  favorite_20: (ctx) => ctx.favoriteCount >= 20,
  explorer_3: (ctx) => ctx.unlockedCategories >= 3,
  explorer_all: (ctx) => ctx.totalCategories > 0 && ctx.unlockedCategories >= ctx.totalCategories,
  level_b1: (ctx) => ctx.xp >= 600,
};

/** 唯一键冲突（Prisma P2002）判定。 */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

@Injectable()
export class GamifyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 发放 XP（幂等：event_key 唯一，重复请求直接跳过）。
   * @param eventType 事件类型（见 XP_RULES 的 key 或 achievement）
   * @param eventKey 幂等键（如 `answer:{recordId}`）
   * @param amount 本次经验值（恒为正）
   * @returns 是否实际发放（false = 已发过）
   */
  async awardXp(userId: number, eventType: string, eventKey: string, amount: number): Promise<boolean> {
    if (amount <= 0) {
      return false;
    }
    try {
      await this.prisma.clientXpLog.create({
        data: { eventKey, userId: BigInt(userId), eventType, amount },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return false;
      }
      throw error;
    }
    await this.prisma.clientUser.update({
      where: { id: BigInt(userId) },
      data: { xp: { increment: amount } },
    });
    return true;
  }

  /** XP → CEFR 等级信息。 */
  levelOf(xp: number): LevelInfo {
    let index = 0;
    for (let i = LEVELS.length - 1; i >= 0; i -= 1) {
      if (xp >= LEVELS[i].min) {
        index = i;
        break;
      }
    }
    const current = LEVELS[index];
    const next = LEVELS[index + 1] ?? null;
    if (!next) {
      return { code: current.code, name: current.name, min: current.min, next: null, toNext: 0, progress: 100 };
    }
    const span = next.min - current.min;
    const done = xp - current.min;
    const progress = span > 0 ? Math.min(100, Math.round((done / span) * 100)) : 100;
    return {
      code: current.code,
      name: current.name,
      min: current.min,
      next: next.min,
      toNext: next.min - xp,
      progress,
    };
  }

  /** 检查并解锁成就（幂等）；返回本次新解锁的 code 列表。 */
  async checkAchievements(userId: number): Promise<string[]> {
    const uid = BigInt(userId);
    const [achievements, unlocked] = await Promise.all([
      this.prisma.achievement.findMany({ orderBy: { sort: 'asc' } }),
      this.prisma.userAchievement.findMany({ where: { userId: uid }, select: { achievementCode: true } }),
    ]);
    if (achievements.length === 0) {
      return [];
    }
    const unlockedSet = new Set(unlocked.map((row) => row.achievementCode));
    const ctx = await this.contextOf(userId);
    const newly: string[] = [];
    for (const achievement of achievements) {
      if (unlockedSet.has(achievement.code)) {
        continue;
      }
      const condition = CONDITIONS[achievement.code];
      if (!condition || !condition(ctx)) {
        continue;
      }
      try {
        await this.prisma.userAchievement.create({
          data: { userId: uid, achievementCode: achievement.code },
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          continue;
        }
        throw error;
      }
      newly.push(achievement.code);
      if (achievement.rewardXp > 0) {
        await this.awardXp(userId, 'achievement', `achievement:${userId}:${achievement.code}`, achievement.rewardXp);
      }
    }
    return newly;
  }

  /** 成长概览（XP / 等级 / 成就 / 场景地图）。 */
  async overview(userId: number): Promise<GamifyOverview> {
    const uid = BigInt(userId);
    const [user, achievements, unlocked, categories, practiced] = await Promise.all([
      this.prisma.clientUser.findUnique({ where: { id: uid }, select: { xp: true } }),
      this.prisma.achievement.findMany({ orderBy: { sort: 'asc' } }),
      this.prisma.userAchievement.findMany({ where: { userId: uid } }),
      this.prisma.sentenceCategory.findMany({
        where: { status: 1 },
        orderBy: { sort: 'asc' },
        select: { id: true, name: true, nameEn: true, icon: true },
      }),
      this.prisma.sentenceRecord.findMany({
        where: { userId: uid },
        select: { sentenceId: true, sentence: { select: { categoryId: true } } },
        distinct: ['sentenceId'],
      }),
    ]);

    const xp = user?.xp ?? 0;
    const unlockedMap = new Map(unlocked.map((row) => [row.achievementCode, row.unlockedAt]));

    // 每个场景已练句子数（按 sentenceId 去重后统计）
    const practicedByCategory = new Map<string, number>();
    for (const row of practiced) {
      if (!row.sentence) {
        continue;
      }
      const key = String(row.sentence.categoryId);
      practicedByCategory.set(key, (practicedByCategory.get(key) ?? 0) + 1);
    }

    const sceneMap: SceneMapItem[] = categories.map((cat) => {
      const practicedCount = practicedByCategory.get(String(cat.id)) ?? 0;
      return {
        id: Number(cat.id),
        name: cat.name,
        nameEn: cat.nameEn,
        icon: cat.icon,
        unlocked: practicedCount > 0,
        practicedCount,
      };
    });

    return {
      xp,
      level: this.levelOf(xp),
      achievements: achievements.map((item) => ({
        code: item.code,
        name: item.name,
        description: item.description,
        icon: item.icon,
        category: item.category,
        rewardXp: item.rewardXp,
        unlocked: unlockedMap.has(item.code),
        unlockedAt: unlockedMap.get(item.code)?.toISOString() ?? null,
      })),
      unlockedAchievements: unlocked.length,
      totalAchievements: achievements.length,
      sceneMap,
      unlockedScenes: sceneMap.filter((item) => item.unlocked).length,
      totalScenes: sceneMap.length,
    };
  }

  /** 组装成就判定上下文。 */
  private async contextOf(userId: number): Promise<AchievementContext> {
    const uid = BigInt(userId);
    const [answerCount, correctCount, favoriteCount, latestCheckin, user, totalCategories, practiced] =
      await Promise.all([
        this.prisma.sentenceRecord.count({ where: { userId: uid } }),
        this.prisma.sentenceRecord.count({ where: { userId: uid, isCorrect: 1 } }),
        this.prisma.sentenceFavorite.count({ where: { userId: uid } }),
        this.prisma.userCheckin.findFirst({
          where: { userId: uid },
          orderBy: { checkinDate: 'desc' },
          select: { streak: true },
        }),
        this.prisma.clientUser.findUnique({ where: { id: uid }, select: { xp: true } }),
        this.prisma.sentenceCategory.count({ where: { status: 1 } }),
        this.prisma.sentenceRecord.findMany({
          where: { userId: uid },
          select: { sentenceId: true, sentence: { select: { categoryId: true } } },
          distinct: ['sentenceId'],
        }),
      ]);

    const categoryIds = new Set<string>();
    for (const row of practiced) {
      if (row.sentence) {
        categoryIds.add(String(row.sentence.categoryId));
      }
    }

    return {
      answerCount,
      correctCount,
      favoriteCount,
      streak: latestCheckin?.streak ?? 0,
      unlockedCategories: categoryIds.size,
      totalCategories,
      xp: user?.xp ?? 0,
    };
  }
}
