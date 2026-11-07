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
import { config } from '../../../common/config/config.js';
import { PrismaService } from '../../../prisma/prisma.service.js';

/** 东八区偏移（Asia/Shanghai 无夏令时，固定 +8 即可；与 AiQuotaService 同口径）。 */
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 服务器本地日（东八区）零点；XP 日上限与「今日」成就共用，避免两处口径漂移。 */
function shanghaiDayStart(): Date {
  const shanghaiNow = new Date(Date.now() + SHANGHAI_OFFSET_MS);
  return new Date(
    Date.UTC(shanghaiNow.getUTCFullYear(), shanghaiNow.getUTCMonth(), shanghaiNow.getUTCDate()) - SHANGHAI_OFFSET_MS,
  );
}

/** XP 发放规则（服务端权威，客户端不参与）。 */
export const XP_RULES = {
  /** 首次答对（该题此前无作答记录） */
  answer_correct_first: 10,
  /** 复习答对 */
  answer_correct_review: 5,
  /** 答错（仍给少量正反馈，不惩罚） */
  answer_wrong: 2,
  /**
   * 拼词模式：首次答对。
   * 拼词时正确单词就在选项里，只考语序与搭配，识别难度明显低于默写，
   * 因此经验按默写约六成发放（不在界面上提示，避免用户为了刷经验纠结模式）。
   */
  answer_correct_first_assemble: 6,
  /** 拼词模式：复习答对 */
  answer_correct_review_assemble: 3,
  /** 拼词模式：答错（正反馈相应减少，仍不惩罚） */
  answer_wrong_assemble: 1,
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
  /** 下一等级名称（满级为 null）；展示用，避免客户端再维护一份 code→name 映射 */
  nextName: string | null;
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
  /** 今日作答数（排行榜「答题榜」同口径：东八区自然日的 sentence_record 行数）。 */
  todayAnswerCount: number;
  /** 今日答对数（排行榜「答对榜」同口径）。 */
  todayCorrectCount: number;
  /** 累计打卡天数（排行榜「打卡榜」同口径：user_checkin 行数，不受答题记录保留期清理）。 */
  checkinTotal: number;
  /**
   * 本次检查所知的最好名次（1 = 榜首）。
   * 名次只有查询排行榜时才算得出来，答题/打卡路径不额外全表聚合，故默认 Infinity；
   * 由 LeaderboardController 在用户进入榜单前 100 时把 rank 传进来。
   */
  bestRank: number;
}

/** 按等级 code 取 XP 阈值（与 LEVELS 同源，改等级表时成就判定不会悄悄跟丢）。 */
function levelMin(code: string): number {
  // 取不到就给 Infinity：宁可这枚勋章永不误发，也不要因为改了等级表就白送
  return LEVELS.find((item) => item.code === code)?.min ?? Number.POSITIVE_INFINITY;
}

/**
 * 成就判定规则（按 code 硬编码：成就定义是随发布演进的种子数据，
 * 判定逻辑属于业务代码，二者通过 code 关联）。
 *
 * 新增成就时**两处都要改**：`prisma/seed.service.ts` 的 ACHIEVEMENT_SEEDS 加定义，
 * 这里加判定。少一处不会报错——种子加了但没有判定，该勋章永远不解锁（静默失效）。
 * 图标名同理要同步客户端（Web 的 ICON_MAP / App 的 icon_map.dart）。
 */
export const ACHIEVEMENT_CONDITIONS: Record<string, (ctx: AchievementContext) => boolean> = {
  first_step: (ctx) => ctx.answerCount >= 1,
  streak_3: (ctx) => ctx.streak >= 3,
  streak_7: (ctx) => ctx.streak >= 7,
  streak_14: (ctx) => ctx.streak >= 14,
  streak_30: (ctx) => ctx.streak >= 30,
  streak_100: (ctx) => ctx.streak >= 100,
  correct_50: (ctx) => ctx.correctCount >= 50,
  correct_200: (ctx) => ctx.correctCount >= 200,
  correct_500: (ctx) => ctx.correctCount >= 500,
  answer_100: (ctx) => ctx.answerCount >= 100,
  answer_500: (ctx) => ctx.answerCount >= 500,
  favorite_20: (ctx) => ctx.favoriteCount >= 20,
  favorite_50: (ctx) => ctx.favoriteCount >= 50,
  explorer_3: (ctx) => ctx.unlockedCategories >= 3,
  // 「一半场景」用乘法比较，避免引入浮点（分类数会随运营加场景变化）
  explorer_half: (ctx) => ctx.totalCategories > 0 && ctx.unlockedCategories * 2 >= ctx.totalCategories,
  explorer_all: (ctx) => ctx.totalCategories > 0 && ctx.unlockedCategories >= ctx.totalCategories,
  level_b1: (ctx) => ctx.xp >= levelMin('B1'),
  level_b2: (ctx) => ctx.xp >= levelMin('B2'),
  // ---- 排行榜配套成就（维度与 /client/leaderboard 的榜单一一对应） ----
  today_answer_20: (ctx) => ctx.todayAnswerCount >= 20,
  today_answer_50: (ctx) => ctx.todayAnswerCount >= 50,
  today_correct_15: (ctx) => ctx.todayCorrectCount >= 15,
  today_correct_30: (ctx) => ctx.todayCorrectCount >= 30,
  checkin_total_30: (ctx) => ctx.checkinTotal >= 30,
  checkin_total_100: (ctx) => ctx.checkinTotal >= 100,
  // 名次型：只在「查榜单」时被 bestRank 点亮；答题路径不额外做全表聚合
  // 首次上榜（前 100）→ 十强 → 三甲 → 榜首，逐级递进
  rank_top100: (ctx) => ctx.bestRank <= 100,
  rank_top10: (ctx) => ctx.bestRank <= 10,
  rank_top3: (ctx) => ctx.bestRank <= 3,
  rank_first: (ctx) => ctx.bestRank === 1,
};

/** 名次型成就 code 全集：用于「已经集齐就不必再跑全量成就检查」的短路判断。 */
export const RANK_ACHIEVEMENT_CODES = ['rank_top100', 'rank_top10', 'rank_top3', 'rank_first'] as const;

/** 唯一键冲突（Prisma P2002）判定。 */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

@Injectable()
export class GamifyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 发放 XP（幂等：event_key 唯一，重复请求直接跳过；另受每日上限约束）。
   * @param eventType 事件类型（见 XP_RULES 的 key 或 achievement）
   * @param eventKey 幂等键（如 `answer:{recordId}`）
   * @param amount 本次经验值（恒为正）
   * @returns 是否实际发放（false = 已发过 / 已达每日上限）
   */
  async awardXp(userId: number, eventType: string, eventKey: string, amount: number): Promise<boolean> {
    if (amount <= 0) {
      return false;
    }
    // 每日上限：经验幂等键里带的是「作答记录 id」，而记录每次都新生成，
    // 所以单靠幂等挡不住「反复提交同一题」这类刷量——总量封顶才是有效闸门。
    if (await this.exceedsDailyCap(userId, amount)) {
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

  /**
   * 今日已发经验 + 本次是否越过上限。
   *
   * 自然日按 **Asia/Shanghai** 算（与 AiQuotaService 同口径，固定 +8，无夏令时）：
   * 不按请求头里的时区，否则改设备时区就能把「今天」挪来挪去、把上限重置掉。
   * @param userId 客户端用户 id
   * @param amount 本次待发经验
   */
  private async exceedsDailyCap(userId: number, amount: number): Promise<boolean> {
    const cap = config.gamify.dailyXpCap;
    if (cap <= 0) {
      return false;
    }
    const today = await this.prisma.clientXpLog.aggregate({
      where: { userId: BigInt(userId), createdAt: { gte: shanghaiDayStart() } },
      _sum: { amount: true },
    });
    return (today._sum.amount ?? 0) + amount > cap;
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
      return {
        code: current.code,
        name: current.name,
        min: current.min,
        next: null,
        nextName: null,
        toNext: 0,
        progress: 100,
      };
    }
    const span = next.min - current.min;
    const done = xp - current.min;
    const progress = span > 0 ? Math.min(100, Math.round((done / span) * 100)) : 100;
    return {
      code: current.code,
      name: current.name,
      min: current.min,
      next: next.min,
      nextName: next.name,
      toNext: next.min - xp,
      progress,
    };
  }

  /**
   * 检查并解锁成就（幂等）；返回本次新解锁的成就（code + 名称，便于客户端直接展示）。
   * @param rankHint 可选：调用方已知用户在某个排行榜上的名次（1 = 榜首）。
   *   只有排行榜接口会传，答题/打卡路径不额外做全表聚合（bestRank 默认 Infinity）。
   */
  async checkAchievements(userId: number, rankHint?: number): Promise<Array<{ code: string; name: string }>> {
    const uid = BigInt(userId);
    const [achievements, unlocked] = await Promise.all([
      this.prisma.achievement.findMany({ orderBy: { sort: 'asc' } }),
      this.prisma.userAchievement.findMany({ where: { userId: uid }, select: { achievementCode: true } }),
    ]);
    if (achievements.length === 0) {
      return [];
    }
    const unlockedSet = new Set(unlocked.map((row) => row.achievementCode));
    const ctx = await this.contextOf(userId, rankHint);
    const newly: Array<{ code: string; name: string }> = [];
    for (const achievement of achievements) {
      if (unlockedSet.has(achievement.code)) {
        continue;
      }
      const condition = ACHIEVEMENT_CONDITIONS[achievement.code];
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
      newly.push({ code: achievement.code, name: achievement.name });
      if (achievement.rewardXp > 0) {
        await this.awardXp(userId, 'achievement', `achievement:${userId}:${achievement.code}`, achievement.rewardXp);
      }
    }
    return newly;
  }

  /**
   * 榜单旁路：用户进入任一榜前 100 时检查名次型成就（首次上榜 / 十强 / 三甲 / 榜首）。
   *
   * checkAchievements 会做十余条聚合查询，不适合每次看榜都跑一遍；这里先用一次带索引的
   * findMany 判断是否已集齐名次勋章，集齐即短路，未集齐才走完整检查。
   */
  async checkRankAchievements(userId: number, rank: number): Promise<Array<{ code: string; name: string }>> {
    if (!Number.isFinite(rank) || rank < 1 || rank > 100) return [];
    const owned = await this.prisma.userAchievement.findMany({
      where: { userId: BigInt(userId), achievementCode: { in: [...RANK_ACHIEVEMENT_CODES] } },
      select: { achievementCode: true },
    });
    if (owned.length >= RANK_ACHIEVEMENT_CODES.length) return [];
    return this.checkAchievements(userId, rank);
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
  private async contextOf(userId: number, rankHint?: number): Promise<AchievementContext> {
    const uid = BigInt(userId);
    const dayStart = shanghaiDayStart();
    const [
      answerCount,
      correctCount,
      favoriteCount,
      latestCheckin,
      user,
      totalCategories,
      practiced,
      todayAnswerCount,
      todayCorrectCount,
      checkinTotal,
    ] = await Promise.all([
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
      // 今日维度（与排行榜同口径：东八区自然日）
      this.prisma.sentenceRecord.count({ where: { userId: uid, createdAt: { gte: dayStart } } }),
      this.prisma.sentenceRecord.count({ where: { userId: uid, isCorrect: 1, createdAt: { gte: dayStart } } }),
      // 打卡榜维度：user_checkin 一天一行且不随答题记录清理，累计口径可靠
      this.prisma.userCheckin.count({ where: { userId: uid } }),
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
      todayAnswerCount,
      todayCorrectCount,
      checkinTotal,
      bestRank: rankHint && rankHint > 0 ? rankHint : Number.POSITIVE_INFINITY,
    };
  }
}
