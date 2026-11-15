/**
 * 后端接口类型（对齐 api/src/modules/client/* 的返回契约）。
 *
 * 刻意手写而不是从后端 import：小程序工程独立构建，不能依赖 NestJS 的 ESM 产物；
 * 契约由 api 的 docs=代码门禁（OpenAPI）保证，字段变更时这里同步跟进。
 */

/** 后端统一响应体。 */
export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

/** 客户端用户资料。 */
export interface ClientUserProfile {
  id: number;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  birthday: string | null;
  /** male / female / secret */
  gender: string;
  signature: string | null;
  emailReminder: number;
  createdAt: string;
  bgCardId: number;
  bgImageUrl: string | null;
  bgCardTitle: string | null;
}

/** 登录返回（微信 / 邮箱同一结构）。 */
export interface ClientAuthResult {
  accessToken: string;
  refreshToken: string;
  user: ClientUserProfile;
}

/** 下一张卡（不含答案）。 */
export interface NextQuestion {
  sentenceId: number;
  translationZh: string;
  imageUrl: string | null;
  categoryName: string | null;
  festivalName: string | null;
  difficulty: number;
  todayDone: number;
  todayGoal: number;
  /** new 新题 / review 复习题 */
  source: 'new' | 'review';
  /** 拼词模式候选词块（打乱）；输入模式为 null */
  words: string[] | null;
  /** 逐词中文释义（词 → 含义）；无数据为 null */
  wordMeanings: Record<string, string> | null;
  /** 盲听模式朗读用的英文原句（只朗读、不渲染） */
  ttsText: string;
}

/** 答题结果（翻转面）。 */
export interface AnswerResult {
  sentenceId: number;
  isCorrect: boolean;
  sentenceEn: string;
  validAnswers: string[];
  translationZh: string;
  ipa: string | null;
  explanation: string | null;
  imageUrl: string | null;
  favorited: boolean;
  todayDone: number;
  todayGoal: number;
  /** 本次获得经验（幂等重复提交为 0） */
  xpEarned?: number;
  /** 恰好完成每日目标的额外奖励 */
  goalBonus?: number;
  /** 本次新解锁的成就 */
  newAchievements?: Array<{ code: string; name: string }>;
}

/** 今日打卡进度。 */
export interface TodayCheckin {
  date: string;
  doneCount: number;
  goalCount: number;
  streak: number;
  completed: boolean;
}

/** 打卡返回的海报数据（仅取小程序用得到的字段）。 */
export interface CheckinPoster {
  date: string;
  doneCount: number;
  goalCount: number;
  streak: number;
  totalDays: number;
  nickname: string;
}

/** 等级。 */
export interface GamifyLevel {
  code: string;
  name: string;
  min: number;
  next: number | null;
  nextName?: string | null;
  toNext: number;
  /** 0~1 */
  progress: number;
}

/** 成就（含解锁状态）。 */
export interface GamifyAchievement {
  code: string;
  name: string;
  description: string;
  /** lucide 图标名（不含 i-lucide- 前缀） */
  icon: string;
  category: string;
  rewardXp: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

/** 成长概览。 */
export interface GamifyOverview {
  xp: number;
  level: GamifyLevel;
  achievements: GamifyAchievement[];
  unlockedAchievements: number;
  totalAchievements: number;
  sceneMap: Array<{ id: number; name: string; unlocked: boolean; practicedCount: number }>;
  unlockedScenes: number;
  totalScenes: number;
}

/** 榜单类型（7 个榜：3 周期 × 2 指标 + 累计打卡）。 */
export type LeaderboardType =
  | 'today_answered'
  | 'today_correct'
  | 'week_answered'
  | 'week_correct'
  | 'month_answered'
  | 'month_correct'
  | 'checkin_total';

/** 榜单一行。 */
export interface LeaderboardRow {
  rank: number;
  userId: number;
  nickname: string;
  avatarUrl: string | null;
  count: number;
}

/** 榜单响应。 */
export interface LeaderboardResult {
  type: LeaderboardType;
  /** 展示单位：题 / 天 */
  unit: string;
  date: string;
  top: LeaderboardRow[];
  /** 我的名次；未上榜为 null */
  me: { rank: number; count: number } | null;
}
