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
  createdAt: string;
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
  difficulty: number;
  todayDone: number;
  todayGoal: number;
  /** new 新题 / review 复习题 */
  source: 'new' | 'review';
}

/** 提交答案结果（含正确答案）。 */
export interface AnswerResult {
  sentenceId: number;
  isCorrect: boolean;
  sentenceEn: string;
  translationZh: string;
  ipa: string | null;
  imageUrl: string | null;
  favorited: boolean;
  todayDone: number;
  todayGoal: number;
}

/** 收藏夹 / 复习池条目。 */
export interface SentenceLibraryItem {
  sentenceId: number;
  sentenceEn: string;
  translationZh: string;
  ipa: string | null;
  imageUrl: string | null;
  categoryName: string | null;
  difficulty: number;
  createdAt: string;
  reviewLevel?: number;
  nextReviewAt: string | null;
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

/** 打卡结果（含海报高亮句）。 */
export interface CheckinResult extends TodayCheckin {
  highlights: Array<{ sentenceEn: string; translationZh: string }>;
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
