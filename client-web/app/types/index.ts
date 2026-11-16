/** 「短句」客户端接口类型（与 api/ 响应体对应）。 */

/** 统一响应体信封。 */
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
  /** 每日学习提醒邮件：1 订阅 / 0 不订阅 */
  emailReminder: number;
  createdAt: string;
  /** 个人主页背景句签 id（0 = 未设置，用默认品牌渐变） */
  bgCardId: number;
  /** 背景句签配图 URL（未设置 / 配图缺失时为 null，回退渐变） */
  bgImageUrl: string | null;
  /** 背景句签标题（未设置为 null） */
  bgCardTitle: string | null;
}

/** 登录/注册返回。 */
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
  /** 节日题库：所属节日名（普通题为 null） */
  festivalName: string | null;
  difficulty: number;
  todayDone: number;
  todayGoal: number;
  /** new 新题 / review 复习题 */
  source: 'new' | 'review';
  /** 拼词模式的候选词块（打乱）；输入模式为 null */
  words: string[] | null;
  /** 选词模式的逐词中文释义（词 → 含义）；旧题 / 无数据为 null（不显示悬浮提示） */
  wordMeanings: Record<string, string> | null;
  /** 盲听模式专用：TTS 朗读用的英文原句。只朗读、不渲染（题面严禁泄露答案） */
  ttsText: string;
}

/** 节日题库（用户端「专门刷题」入口）。 */
export interface FestivalBank {
  /** 节日名（如「春节」） */
  name: string;
  /** 当前题库的题目数 */
  count: number;
  /** 该期节日的公历日期（YYYY-MM-DD） */
  date: string | null;
  /** 封面图 URL：取该节日题库一张已生成配图的题当封面；没有时为 null */
  coverUrl: string | null;
}

/** 场景题库（题库页「按场景刷」入口；不含节日分类——那是 FestivalBank 的事）。 */
export interface CategoryBank {
  id: number;
  name: string;
  nameEn: string | null;
  icon: string | null;
  /** 就绪且未退场的题目数 */
  count: number;
}

/** 提交答案结果（含正确答案）。 */
/** 每日 Boss（/client/questions/boss）：当天固定一道挑战题。 */
export interface BossToday {
  /** 东八区日期（YYYY-MM-DD） */
  date: string;
  /** 今天是否已通关 */
  cleared: boolean;
  /** 通关额外经验 */
  bonusXp: number;
  /** 题目（不含英文原句，防偷看）；池子为空为 null */
  question: {
    sentenceId: number;
    translationZh: string;
    ipa: string | null;
    imageUrl: string | null;
    difficulty: number;
    categoryName: string | null;
  } | null;
}

/** Boss 作答结果：普通作答结果 + 通关信息。 */
export interface BossAnswerResult extends AnswerResult {
  bossCleared: boolean;
  bossBonus: number;
}

export interface AnswerResult {
  sentenceId: number;
  isCorrect: boolean;
  sentenceEn: string;
  /** 其他可接受的等价表达（输入模式下写出任一条即算对；不含 sentenceEn 本身） */
  validAnswers: string[];
  translationZh: string;
  ipa: string | null;
  /**
   * 题目自带解析（语法 / 时态 / 词形，生题时生成）。
   * 有值就直接展示，**不必再调 AI 实时生成**；空值（老题尚未回填）才回退到流式解析。
   */
  explanation: string | null;
  imageUrl: string | null;
  favorited: boolean;
  todayDone: number;
  todayGoal: number;
  /** 本次作答获得的经验（重复提交命中幂等时为 0）——App 端用来做「+N XP」即时反馈 */
  xpEarned?: number;
  /** 本次作答恰好完成每日目标的额外奖励经验（未触发为 0） */
  goalBonus?: number;
  /** 本次新解锁的成就 */
  newAchievements?: Array<{ code: string; name: string }>;
}

/** 收藏夹 / 复习池条目。 */
export interface SentenceLibraryItem {
  sentenceId: number;
  sentenceEn: string;
  translationZh: string;
  ipa: string | null;
  /** 题目解析（点开句子复习时展示；老题为空） */
  explanation: string | null;
  imageUrl: string | null;
  categoryName: string | null;
  difficulty: number;
  createdAt: string;
  reviewLevel?: number;
  nextReviewAt: string | null;
  /** 历史记录专用：本次作答是否正确 */
  isCorrect?: boolean;
  /** 历史记录专用：用户本次实际作答（答错时回显） */
  userAnswer?: string | null;
}

/** App 最新版本（下载入口用）。 */
export interface LatestAppVersion {
  id: number;
  version: string;
  versionCode: number;
  /** 安装包字节数 */
  fileSize: number;
  changelog: string;
  /** 是否强制更新（客户端可据此提示必须升级） */
  forceUpdate: boolean;
  publishedAt: string;
}

/** 分页响应。 */
export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 今日打卡。 */
export interface TodayCheckin {
  date: string;
  doneCount: number;
  goalCount: number;
  streak: number;
  completed: boolean;
}

/** 每日句签（AI 生成的精美闪卡，完成每日目标后获得）。 */
export interface SentenceCard {
  id: number;
  bizDate: string;
  title: string;
  titleZh: string;
  sentenceEn: string;
  translationZh: string;
  /** 寄语（这张卡独有的一句；老卡片可能为空，展示侧有兜底） */
  blessing: string;
  imageUrl: string | null;
  /** 获得时间（ISO；未领取为 null） */
  obtainedAt: string | null;
}

/** 未拥有的句签（总数 + 最近一批；列表按容量截断）。 */
export interface MissingSentenceCards {
  /** 未拥有总数（可能大于 list.length） */
  total: number;
  /** 最近的未拥有句签（按业务日期倒序） */
  list: SentenceCard[];
}

/** 微游戏化：CEFR 等级信息。 */
export interface GamifyLevel {
  code: string;
  name: string;
  min: number;
  next: number | null;
  /** 下一等级名称（满级为 null；旧接口可能缺失） */
  nextName?: string | null;
  toNext: number;
  progress: number;
}

/** 微游戏化：成就（含解锁状态）。 */
export interface GamifyAchievement {
  code: string;
  name: string;
  description: string;
  /** lucide 图标名（不含 i-lucide- 前缀） */
  icon: string;
  /** AI 卡通大图 URL（详情大图优先显示；空值回落 lucide icon） */
  artUrl: string | null;
  category: string;
  rewardXp: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

/** 微游戏化：场景探索地图条目。 */
export interface GamifyScene {
  id: number;
  name: string;
  nameEn: string | null;
  icon: string | null;
  unlocked: boolean;
  practicedCount: number;
}

/** 微游戏化：成长概览。 */
export interface GamifyOverview {
  xp: number;
  level: GamifyLevel;
  achievements: GamifyAchievement[];
  unlockedAchievements: number;
  totalAchievements: number;
  sceneMap: GamifyScene[];
  unlockedScenes: number;
  totalScenes: number;
}

/** 场景分类。 */
export interface SentenceCategory {
  id: number;
  name: string;
  nameEn: string | null;
  icon: string | null;
}

/** 词根构件（前缀 / 词根 / 后缀）。 */
export interface WordRootPart {
  /** prefix 前缀 / root 词根 / suffix 后缀 */
  type: string;
  /** 文本（如 un-） */
  text: string;
  /** 含义 */
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
  /** ai 实时解析 / daily 每日批量 */
  source: string;
  searchCount: number;
}

/** AI 场景造句结果（结构化，与后端提示词约定一致）。 */
export interface AiExpandResult {
  /** 地道英文句子 */
  sentence: string;
  /** IPA 音标（含首尾斜杠） */
  phonetic: string | null;
  /** 一句中文：适用场景或语气 */
  note: string | null;
}

/** AI 词根拆解结果（与词根词典同构，可直接回传收录）。 */
export interface AiWordRootResult {
  phonetic: string | null;
  meaning: string | null;
  parts: WordRootPart[];
  explanation: string;
  related: string[];
}

/** 收录词条结果（词库已有时 created=false 且不覆盖）。 */
export interface WordRootCollectResult {
  item: WordRootItem;
  created: boolean;
}

/** 客户端用户每日 AI 额度。 */
export interface AiQuotaUsage {
  /** 今日已用次数 */
  used: number;
  /** 每日上限 */
  limit: number;
  /** 剩余次数 */
  remaining: number;
  /** 额度重置时间（次日 0 点，ISO） */
  resetAt: string;
}

/* ------------------------------ 客户端公告 ------------------------------ */

/** 公告条目（用户端视角，isRead 由当前用户决定）。 */
export interface ClientNoticeItem {
  id: number;
  title: string;
  content: string;
  /** 1 系统通知 / 2 公告 / 3 活动 */
  noticeType: number;
  /** 点击跳转的客户端路由（空 = 不跳转） */
  link: string | null;
  /** 0 未读 / 1 已读 */
  isRead: number;
  /** 置顶：1 置顶 / 0 普通 */
  pinned: number;
  publishedAt: string | null;
  createdAt: string;
}

/* ------------------------------ 我的反馈 ------------------------------ */

/** 反馈条目（用户端视角：含处理状态与运营回复）。 */
export interface MyFeedbackItem {
  id: number;
  /** feature 功能建议 / bug 使用异常 / content 内容问题 / ux 体验建议 / other 其他 */
  type: string;
  content: string;
  /** 反馈图片 URL 列表（最多 5 张；空数组 = 无图） */
  images: string[];
  /** pending 待处理 / resolved 已处理 / dismissed 已驳回 */
  status: 'pending' | 'resolved' | 'dismissed';
  /** 运营回复（空 = 尚未回复） */
  reply: string | null;
  handledAt: string | null;
  createdAt: string;
}

/* ------------------------------ 排行榜 ------------------------------ */

/**
 * 排行榜类型：今日 / 近 7 天 / 近 30 天的答题数、答对数，以及累计打卡天数。
 * 周/月榜是「最近 N 个自然日」的滚动窗口（与答题记录 30 天保留期对齐）。
 */
export type LeaderboardType =
  | 'today_answered'
  | 'today_correct'
  | 'week_answered'
  | 'week_correct'
  | 'month_answered'
  | 'month_correct'
  | 'checkin_total';

/** 排行榜一行 */
export interface LeaderboardRow {
  rank: number;
  userId: number;
  nickname: string;
  avatarUrl: string | null;
  count: number;
}

/** 排行榜响应 */
export interface LeaderboardResult {
  type: LeaderboardType;
  /** 榜单展示单位：题 / 天 */
  unit: string;
  /** 榜单所属自然日 YYYY-MM-DD */
  date: string;
  top: LeaderboardRow[];
  /** 当前用户名次；未上榜为 null */
  me: { rank: number; count: number } | null;
}

/* ------------------------------ 情景闯关 ------------------------------ */

/** 一个关卡（挂在剧本下；id = stage_story.id）。 */
/** 场景里的一个 AI 角色。 */
export interface StageRole {
  nameEn: string;
  name: string;
  emoji: string;
}

export interface StageView {
  /** 关卡 id（stage_story.id） */
  id: number;
  /** 所属剧本 id */
  scriptId: number;
  /** 所属场景分类 id */
  categoryId: number;
  /** 场景分类名 */
  name: string;
  nameEn: string | null;
  icon: string | null;
  /** 剧情化关卡标题 */
  title: string;
  intro: string;
  outro: string;
  /** 本关对话目标 */
  goal: string;
  /** 通关所需最少用户轮数 */
  minTurns: number;
  /** 硬上限轮数 */
  maxTurns: number;
  /** 出场角色（1~3 人） */
  roles: StageRole[];
  rewardXp: number;
  /** 进度百分比（通关 100，进行中按轮数估算） */
  progress: number;
  /** 最近一次通关对话轮数 */
  turns: number;
  /** 旧版答对句数（仅历史展示） */
  legacyCorrectCount: number;
  cleared: boolean;
  unlocked: boolean;
  claimed: boolean;
  /** 进行中的会话 id */
  activeSessionId: number | null;
}

/** 一个剧本（挂在场景下，包含若干关卡）。 */
export interface StageScript {
  /** 剧本 id（stage_script.id） */
  id: number;
  /** 所属场景分类 id */
  categoryId: number;
  name: string;
  blurb: string;
  /** AI 生成的封面图 URL；未生成时为 null（前端回落渐变+图标） */
  coverUrl: string | null;
  /** 剧本下可见关卡数 */
  stageCount: number;
  /** 我已通关的关卡数 */
  clearedCount: number;
  /** 是否全部通关 */
  completed: boolean;
}

/** 一个场景（顶层：场景分类 + 其下剧本/关卡汇总）。 */
export interface StageScene {
  id: number;
  name: string;
  nameEn: string | null;
  icon: string | null;
  scriptCount: number;
  stageCount: number;
  clearedCount: number;
  /** 场景卡封面 = 第一个有封面的剧本封面（都没有则 null） */
  coverUrl: string | null;
}

/** 一章（兼容旧字段；重构后 = 一个剧本，key 形如 `script-{id}`）。 */
export interface StageChapter {
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
  /** 顶层场景（地图首页用） */
  scenes: StageScene[];
  /** 剧本平铺（兼容旧客户端） */
  chapters: StageChapter[];
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
  scene: Pick<StageScene, 'id' | 'name' | 'nameEn' | 'icon'>;
  stages: StageView[];
  clearedCount: number;
  total: number;
}

/** 领取通关奖励结果。 */
export interface StageClaimResult {
  awarded: boolean;
  alreadyClaimed: boolean;
  rewardXp: number;
  /** 无翻译通关的额外加成经验（全程关闭翻译才计） */
  bonusXp: number;
  xp: number;
}

/** 一句场景对话。 */
export interface StageDialogueMessage {
  id: number;
  role: 'npc' | 'user';
  /** 说话角色 nameEn（用户为 null） */
  speaker: string | null;
  contentEn: string;
  contentZh: string | null;
  createdAt: string;
}

/** 对话结束后的中文复盘。 */
export interface StageFeedback {
  summary: string;
  highlights: string[];
  improvements: string[];
}

/** 一条候选英文短句（悬停时按翻译开关显示中文）。 */
export interface StageDialogueHint {
  /** 英文短句（点一下填入输入框） */
  en: string;
  /** 中文翻译（用户关闭翻译时为空或不显示） */
  zh: string;
}

/** 进入关卡时返回的会话（含开场白与历史消息）。 */
export interface StageDialogue {
  sessionId: number;
  status: string;
  turnCount: number;
  goalReached: boolean;
  cleared: boolean;
  /** 当前是否显示中文翻译 */
  showTranslation: boolean;
  /** 当前候选英文短句（动态更新） */
  hints: StageDialogueHint[];
  title: string;
  intro: string;
  goal: string;
  minTurns: number;
  maxTurns: number;
  roles: StageRole[];
  messages: StageDialogueMessage[];
  summary: string | null;
  feedback: StageFeedback | null;
}

/** 一轮对话结果。 */
export interface StageTurnResult {
  replies: Array<{ speaker: string; contentEn: string; contentZh: string }>;
  turnCount: number;
  goalReached: boolean;
  ended: boolean;
  cleared: boolean;
  /** 本轮模型给出的候选英文短句（含中文，动态更新） */
  hints: StageDialogueHint[];
  summary: string | null;
  feedback: StageFeedback | null;
}

/* ------------------------------ 句子接龙 ------------------------------ */

/** 接龙主题。 */
export interface ChainTopic {
  id: number;
  title: string;
  /** 起始句（英文引子） */
  starterEn: string;
  /** 中文提示 */
  promptZh: string;
  /** 来源：seed 手工种子 / ai 每周 AI 生成（前端标「本周新」） */
  source?: string;
  entryCount: number;
  myEntryCount: number;
}

/** 一条接龙（作者以匿名化名出现）。 */
export interface ChainEntry {
  id: number;
  alias: string;
  contentEn: string;
  contentZh: string | null;
  likeCount: number;
  liked: boolean;
  mine: boolean;
  createdAt: string;
  /** 审核状态（仅提交响应返回：visible 已展示 / pending 待人工 / rejected 未通过） */
  status?: 'visible' | 'pending' | 'rejected';
  /** 审核备注（仅提交响应返回） */
  moderationNote?: string | null;
}

/** 主题详情。 */
export interface ChainTopicDetail {
  topic: ChainTopic;
  entries: ChainEntry[];
  /** 今天还能提交几条 */
  remainingToday: number;
  dailyLimit: number;
}

/* ------------------------------ 音标学习 ------------------------------ */

/** 音标类型（分组与排序由后端下发）。 */
export type IpaPhonemeType = 'vowel' | 'diphthong' | 'consonant_voiceless' | 'consonant_voiced';

/** 一组音标（单元音 / 双元音 / 清辅音 / 浊辅音）。 */
export interface IpaPhonemeGroup {
  type: IpaPhonemeType;
  title: string;
  hint: string;
  items: IpaPhoneme[];
}

/** 一个音标。 */
export interface IpaPhoneme {
  /** 音标符号（不含斜线） */
  symbol: string;
  type: IpaPhonemeType;
  /** 示例词 */
  exampleWords: string[];
  /** 中文发音要点 */
  tips: string;
  sort: number;
}

/** 我的音标进度。 */
export interface IpaProgressItem {
  symbol: string;
  learned: boolean;
}

/** 标记「学会了」的响应。 */
export interface IpaLearnedResult {
  symbol: string;
  firstTime: boolean;
  xpAwarded: boolean;
  learnedCount: number;
}
