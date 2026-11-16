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

/** 记忆巩固统计（与 Web 记忆卡 / App 同一契约：/client/questions/memory-stats）。 */
export interface MemoryStats {
  /** 有答对记录的不同题数（≈已复习题数） */
  reviewed: number;
  /** 累计答对达到毕业阈值的题数 */
  graduated: number;
  /** 今天到期需复习的题数 */
  dueToday: number;
  /** 未来 7 天内到期 */
  dueIn7: number;
  /** 未来 30 天内到期 */
  dueIn30: number;
  /** 未来 30 天每天到期题数（索引 0 = 今天） */
  distribution: number[];
  /** 理论遗忘曲线 R(day)=exp(-day/S)，day 0..30 */
  retentionCurve: Array<{ day: number; retention: number }>;
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
  /** 0~100 的百分比（与后端一致，展示时不要再乘 100） */
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

/* ------------------------------ 通用分页 ------------------------------ */

/** 统一分页响应。 */
export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/* ------------------------------ 题库 ------------------------------ */

/** 场景题库（按场景刷）。 */
export interface CategoryBank {
  id: number;
  name: string;
  nameEn: string | null;
  icon: string | null;
  /** 就绪且未退场的题目数 */
  count: number;
}

/** 节日题库。 */
export interface FestivalBank {
  name: string;
  count: number;
  /** 该期节日的公历日期 YYYY-MM-DD */
  date: string | null;
  coverUrl: string | null;
}

/* ------------------------------ 语句库 ------------------------------ */

/** 收藏夹 / 复习池 / 历史 条目。 */
export interface SentenceLibraryItem {
  sentenceId: number;
  sentenceEn: string;
  translationZh: string;
  ipa: string | null;
  explanation: string | null;
  imageUrl: string | null;
  categoryName: string | null;
  difficulty: number;
  createdAt: string;
  reviewLevel?: number;
  nextReviewAt: string | null;
  /** 历史专用：本次是否答对 */
  isCorrect?: boolean;
  /** 历史专用：用户本次实际作答 */
  userAnswer?: string | null;
}

/* ------------------------------ 每日 Boss ------------------------------ */

/** 每日 Boss（当天固定一道挑战题）。 */
export interface BossToday {
  date: string;
  cleared: boolean;
  bonusXp: number;
  question: {
    sentenceId: number;
    translationZh: string;
    ipa: string | null;
    imageUrl: string | null;
    difficulty: number;
    categoryName: string | null;
  } | null;
}

/** Boss 作答结果（普通结果 + 通关信息）。 */
export interface BossAnswerResult extends AnswerResult {
  bossCleared: boolean;
  bossBonus: number;
}

/* ------------------------------ 句签 ------------------------------ */

/** 每日句签（完成目标后领取）。 */
export interface SentenceCard {
  id: number;
  bizDate: string;
  title: string;
  titleZh: string;
  sentenceEn: string;
  translationZh: string;
  blessing: string;
  imageUrl: string | null;
  obtainedAt: string | null;
}

/** 未拥有的句签（总数 + 最近一批）。 */
export interface MissingSentenceCards {
  total: number;
  list: SentenceCard[];
}

/* ------------------------------ 接龙 ------------------------------ */

/** 接龙主题。 */
export interface ChainTopic {
  id: number;
  title: string;
  starterEn: string;
  promptZh: string;
  source?: string;
  entryCount: number;
  myEntryCount: number;
}

/** 一条接龙（作者匿名化名）。 */
export interface ChainEntry {
  id: number;
  alias: string;
  contentEn: string;
  contentZh: string | null;
  likeCount: number;
  liked: boolean;
  mine: boolean;
  createdAt: string;
  status?: 'visible' | 'pending' | 'rejected';
  moderationNote?: string | null;
}

/** 主题详情。 */
export interface ChainTopicDetail {
  topic: ChainTopic;
  entries: ChainEntry[];
  remainingToday: number;
  dailyLimit: number;
}

/* ------------------------------ 公告 ------------------------------ */

/** 公告（用户端视角）。 */
export interface ClientNoticeItem {
  id: number;
  title: string;
  content: string;
  /** 1 系统通知 / 2 公告 / 3 活动 */
  noticeType: number;
  link: string | null;
  /** 0 未读 / 1 已读 */
  isRead: number;
  pinned: number;
  publishedAt: string | null;
  createdAt: string;
}

/* ------------------------------ 反馈 ------------------------------ */

/** 我的反馈（含处理状态与运营回复）。 */
export interface MyFeedbackItem {
  id: number;
  type: string;
  content: string;
  images: string[];
  status: 'pending' | 'resolved' | 'dismissed';
  reply: string | null;
  handledAt: string | null;
  createdAt: string;
}

/* ------------------------------ 投稿 ------------------------------ */

/** 投稿精选（审核通过）。 */
export interface SubmissionFeatured {
  id: number;
  sentenceEn: string;
  translationZh: string;
  note: string | null;
  author: string;
  approvedAt: string | null;
}

/** 我的投稿。 */
export interface SubmissionMine {
  id: number;
  sentenceEn: string;
  translationZh: string;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

/* ------------------------------ 音标 ------------------------------ */

/** 音标类型。 */
export type IpaPhonemeType = 'vowel' | 'diphthong' | 'consonant_voiceless' | 'consonant_voiced';

/** 一个音标。 */
export interface IpaPhoneme {
  symbol: string;
  type: IpaPhonemeType;
  exampleWords: string[];
  tips: string;
  sort: number;
}

/** 一组音标。 */
export interface IpaPhonemeGroup {
  type: IpaPhonemeType;
  title: string;
  hint: string;
  items: IpaPhoneme[];
}

/** 音标进度条目。 */
export interface IpaProgressItem {
  symbol: string;
  learned: boolean;
}

/** 标记学会的响应。 */
export interface IpaLearnedResult {
  symbol: string;
  firstTime: boolean;
  xpAwarded: boolean;
  learnedCount: number;
}

/* ------------------------------ 词根 ------------------------------ */

/** 词根构件。 */
export interface WordRootPart {
  type: string;
  text: string;
  meaning: string;
}

/** 词根词条。 */
export interface WordRootItem {
  word: string;
  phonetic: string | null;
  meaning: string | null;
  parts: WordRootPart[];
  explanation: string;
  related: string[];
  source: string;
  searchCount: number;
}

/* ------------------------------ 小分队 ------------------------------ */

/** 队员。 */
export interface TeamMemberView {
  userId: number;
  nickname: string;
  avatarFileId: number;
  xp: number;
  checkedIn: boolean;
  isMe: boolean;
}

/** 我的小队。 */
export interface TeamView {
  id: number;
  name: string;
  code: string;
  source: string;
  isOwner: boolean;
  streak: number;
  memberCount: number;
  maxMembers: number;
  doneCount: number;
  todayFull: boolean;
  myCheckedIn: boolean;
  hint: string;
  hintTone: 'info' | 'urge' | 'success';
  members: TeamMemberView[];
}

/** 群聊消息。 */
export interface TeamMessage {
  id: number;
  userId: number;
  nickname: string;
  avatarFileId: number;
  isMe: boolean;
  content: string;
  status: string;
  canRecall: boolean;
  quote: { id: number; nickname: string; content: string; status: string } | null;
  createdAt: string;
}

/* ------------------------------ AI 私教 ------------------------------ */

/** 单个场景的掌握度。 */
export interface CoachCategory {
  categoryId: number;
  name: string;
  total: number;
  correct: number;
  accuracy: number;
}

/** 反复答错的题（只给中文题干）。 */
export interface CoachToughSentence {
  sentenceId: number;
  translationZh: string;
  wrongCount: number;
}

/** 薄弱点画像 + 今日复习计划（纯计算，始终可用）。 */
export interface CoachProfile {
  totalAnswers: number;
  correctAnswers: number;
  accuracy: number;
  todayAnswers: number;
  dueToday: number;
  streak: number;
  weakCategories: CoachCategory[];
  toughSentences: CoachToughSentence[];
  plan: string[];
  focus: string;
  aiAvailable: boolean;
}

/** 私教点评（source=rule 表示降级文案）。 */
export interface CoachAdvice {
  text: string;
  source: 'ai' | 'rule';
}

/* ------------------------------ 周报 ------------------------------ */

/** 周学习报告。 */
export interface WeeklyReport {
  answered: number;
  correct: number;
  accuracy: number;
  activeDays: number;
  xpGained: number;
  newAchievements: number;
  streak: number;
  daily: Array<{ date: string; weekday: string; answered: number; correct: number }>;
  topCategory: { name: string; count: number } | null;
  prevAnswered: number;
  deltaAnswered: number;
}

/* ------------------------------ 记忆健康 ------------------------------ */

/** 记忆巩固统计（对应 /client/questions/memory-stats）。 */
export interface MemoryStats {
  /** 累计复习过的题目数 */
  reviewed: number;
  /** 已达到毕业标准的题目数 */
  graduated: number;
  /** 今日待复习 */
  dueToday: number;
  /** 7 天内待复习 */
  dueIn7: number;
  /** 30 天内待复习 */
  dueIn30: number;
  /** 未来 30 天每天的待复习题数 */
  distribution: number[];
  /** 理论遗忘曲线（day 0..30，retention 0..1，仅作示意） */
  retentionCurve: Array<{ day: number; retention: number }>;
}
