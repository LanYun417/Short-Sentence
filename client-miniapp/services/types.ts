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

/* ------------------------------ 情景闯关 ------------------------------ */

/** 场景里的一个 AI 角色。 */
export interface StageRole {
  nameEn: string;
  name: string;
  emoji: string;
}

/** 一个关卡（id = stage_story.id，对话/领奖接口都用它）。 */
export interface StageView {
  id: number;
  scriptId: number;
  categoryId: number;
  name: string;
  nameEn: string | null;
  title: string;
  intro: string;
  outro: string;
  /** 本关对话目标 */
  goal: string;
  /** 通关所需最少用户轮数 */
  minTurns: number;
  /** 硬上限轮数 */
  maxTurns: number;
  roles: StageRole[];
  rewardXp: number;
  /** 进度百分比（通关 100，进行中按轮数估算） */
  progress: number;
  /** 最近一次通关对话轮数 */
  turns: number;
  cleared: boolean;
  unlocked: boolean;
  claimed: boolean;
  /** 进行中的会话 id */
  activeSessionId: number | null;
}

/** 一个剧本（挂在场景下，包含若干关卡）。 */
export interface StageScript {
  id: number;
  categoryId: number;
  name: string;
  blurb: string;
  coverUrl: string | null;
  stageCount: number;
  clearedCount: number;
  completed: boolean;
}

/** 一个场景（顶层）。 */
export interface StageScene {
  id: number;
  name: string;
  nameEn: string | null;
  scriptCount: number;
  stageCount: number;
  clearedCount: number;
  coverUrl: string | null;
}

/** 闯关总览。 */
export interface StageOverview {
  scenes: StageScene[];
  clearedStages: number;
  totalStages: number;
  activeStages: number;
  claimable: number;
  /** 推荐关卡 id（第一个已解锁未通关的关卡） */
  recommendedId: number | null;
}

/** 场景详情（场景 → 剧本列表）。 */
export interface StageSceneDetail {
  scene: StageScene;
  scripts: StageScript[];
}

/** 剧本详情（剧本 → 关卡列表）。 */
export interface StageScriptDetail {
  script: StageScript;
  scene: { id: number; name: string; nameEn: string | null };
  stages: StageView[];
  clearedCount: number;
  total: number;
}

/** 领取通关奖励结果。 */
export interface StageClaimResult {
  awarded: boolean;
  alreadyClaimed: boolean;
  rewardXp: number;
  /** 全程未用翻译的额外加成 */
  bonusXp: number;
  xp: number;
}

/** 一条对话消息。 */
export interface StageDialogueMessage {
  id: number;
  role: 'npc' | 'user';
  speaker: string | null;
  contentEn: string;
  contentZh: string | null;
  createdAt: string;
}

/** 一条候选英文短句。 */
export interface StageDialogueHint {
  en: string;
  zh: string;
}

/** 一轮里某个角色的回应。 */
export interface StageDialogueReply {
  speaker: string;
  contentEn: string;
  contentZh: string;
}

/** 通关复盘。 */
export interface StageDialogueSummary {
  summary: string;
  highlights: string[];
  improvements: string[];
}

/** 对话会话视图（进入关卡时返回）。 */
export interface StageDialogueView {
  sessionId: number;
  status: string;
  turnCount: number;
  goalReached: boolean;
  cleared: boolean;
  showTranslation: boolean;
  hints: StageDialogueHint[];
  title: string;
  intro: string;
  goal: string;
  minTurns: number;
  maxTurns: number;
  roles: StageRole[];
  messages: StageDialogueMessage[];
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
  hints: StageDialogueHint[];
  summary: string | null;
  feedback: StageDialogueSummary | null;
}
