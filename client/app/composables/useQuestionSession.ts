/**
 * 刷题会话（单卡状态机 + 后端交互）。
 *
 * 状态流转：loadNext → answering → submit → flipped → next → loadNext …
 * 翻转后的结果只保留到下一次 loadNext；达标后的今日进度由页面层消费 result.todayDone。
 */
import type { Ref } from 'vue';
import type { AnswerResult, FestivalBank, NextQuestion } from '~/types';
import { apiFetch, getToken } from '~/composables/useApi';

/** 本地持久化的难度偏好 key。 */
const DIFFICULTY_KEY = 'ss_difficulty';
/** 本地持久化的作答模式 key。 */
const MODE_KEY = 'ss_mode';
/** 难度档位（与后端 Sentence.difficulty 对齐）。 */
export const DIFFICULTIES = [
  { value: 1, label: '基础', icon: 'i-lucide-sprout' },
  { value: 2, label: '进阶', icon: 'i-lucide-trending-up' },
  { value: 3, label: '挑战', icon: 'i-lucide-flame' },
] as const;

/**
 * 难度取值（1 | 2 | 3）。
 * 从 DIFFICULTIES 派生而不是各处手写，避免「加了档位但某个筛选器还是老联合类型」。
 * USelect 的 v-model 会按 items 的字面量收窄，用 number 会被判宽。
 */
export type DifficultyLevel = (typeof DIFFICULTIES)[number]['value'];

/**
 * 作答模式（与后端 AnswerSentenceDto.mode 对齐）。
 * - input    ：自己敲出整句，经验全额
 * - assemble ：点选打乱词块拼句，上手更轻，经验按约六成发放
 */
export type AnswerMode = 'input' | 'assemble';

/** 模式选项（顺序即分段控件的排列，默认档在首位）。 */
export const ANSWER_MODES = [
  { value: 'input', label: '输入', icon: 'i-lucide-keyboard' },
  { value: 'assemble', label: '拼词', icon: 'i-lucide-blocks' },
] as const;

/** 读取难度偏好（Cookie 优先——SSR 也可读；其次 localStorage；缺省 2 进阶）。 */
function readDifficulty(cookieValue: number | null): number {
  const fromCookie = Number(cookieValue);
  if (fromCookie >= 1 && fromCookie <= 3) {
    return fromCookie;
  }
  if (typeof localStorage === 'undefined') {
    return 2;
  }
  const value = Number(localStorage.getItem(DIFFICULTY_KEY));
  return value >= 1 && value <= 3 ? value : 2;
}

/** 记住难度偏好：Cookie（SSR 抽题用）+ localStorage（客户端兜底）。 */
function persistDifficulty(cookieValue: Ref<number | null>, value: number): void {
  cookieValue.value = value;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(DIFFICULTY_KEY, String(value));
  }
}

/** 读取作答模式偏好（Cookie 优先——SSR 抽题要靠它决定是否下发词块）。 */
function readMode(cookieValue: string | null): AnswerMode {
  if (cookieValue === 'input' || cookieValue === 'assemble') {
    return cookieValue;
  }
  if (typeof localStorage === 'undefined') {
    return 'input';
  }
  return localStorage.getItem(MODE_KEY) === 'assemble' ? 'assemble' : 'input';
}

/** 记住作答模式：Cookie（SSR 抽题用）+ localStorage（客户端兜底）。 */
function persistMode(cookieValue: Ref<string | null>, value: AnswerMode): void {
  cookieValue.value = value;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(MODE_KEY, value);
  }
}

/**
 * @param initialFestival 初始选中的节日题库（null = 日常混抽）。
 *
 * 从题库页带 `?festival=元旦` 直达时传入：让 SSR 与首屏状态一致——
 * 否则服务端已按该节日抽好题，页面却还显示「日常混抽」的状态，
 * 客户端还会因为状态对不上而白抽一次题（闪一下）。
 */
export function useQuestionSession(initialFestival: string | null = null) {
  // useCookie 必须在 setup/nuxt 上下文里创建（模块顶层没有实例会抛错）
  const difficultyCookie = useCookie<number | null>('ss_difficulty', {
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
  });
  const modeCookie = useCookie<string | null>('ss_mode', {
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
  });

  /** 当前题目 */
  const question = ref<NextQuestion | null>(null);
  /** 提交后的结果（翻转态） */
  const result = ref<AnswerResult | null>(null);
  /** 加载下一张中 */
  const loading = ref(false);
  /** 提交判定中 */
  const submitting = ref(false);
  /** 页面级错误（题目拉取失败等） */
  const errorMessage = ref('');
  /** 目标难度（本地持久化，随 next 请求下发；只影响新题，复习题仍按排期走） */
  const difficulty = ref<number>(readDifficulty(difficultyCookie.value));
  /** 作答模式（本地持久化；随 next 决定是否取词块，随 answer 上报用于经验计算） */
  const mode = ref<AnswerMode>(readMode(modeCookie.value));
  /** 当前选择的节日题库（null = 全部/日常混抽） */
  const festival = ref<string | null>(initialFestival);
  /** 可选的节日题库（只含有就绪题目的节日） */
  const festivals = ref<FestivalBank[]>([]);

  /** 拉取下一张卡（清空上一轮结果）。 */
  async function loadNext(): Promise<void> {
    loading.value = true;
    errorMessage.value = '';
    try {
      question.value = await apiFetch<NextQuestion>('/client/questions/next', {
        // festival 为 undefined 时 ofetch 会自动省略该参数（走日常混抽）
        query: { difficulty: difficulty.value, festival: festival.value ?? undefined },
      });
      result.value = null;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '题目加载失败';
    } finally {
      loading.value = false;
    }
  }

  /** 拉取可选节日题库（失败静默：不影响日常刷题）。 */
  async function loadFestivals(): Promise<void> {
    festivals.value = await apiFetch<FestivalBank[]>('/client/questions/festivals').catch(() => []);
  }

  /** 切换节日题库（null = 全部）：立刻按新范围抽一张。 */
  async function setFestival(name: string | null): Promise<void> {
    if (festival.value === name) {
      return;
    }
    festival.value = name;
    await loadNext();
  }

  /** 切换难度：记住选择并立刻按新难度抽一张（中途切换也生效）。 */
  async function setDifficulty(value: number): Promise<void> {
    const next = Math.min(3, Math.max(1, value));
    difficulty.value = next;
    persistDifficulty(difficultyCookie, next);
    await loadNext();
  }

  /**
   * 切换作答模式：只记住偏好，**不重抽题**。
   * 词块由服务端随题**恒定下发**，因此切换后沿用当前题即可（与 App 端一致）。
   */
  function setMode(value: AnswerMode): void {
    if (mode.value === value) {
      return;
    }
    mode.value = value;
    persistMode(modeCookie, value);
  }

  /**
   * 用 SSR 预取的题目初始化（服务端已抽好卡，客户端直接展示，不再发一次请求）。
   * 仅在当前无题时生效，避免覆盖提交中途的状态。
   */
  function prefill(initial: NextQuestion): void {
    if (!question.value) {
      question.value = initial;
    }
  }

  /** 提交答案（成功后进入翻转态）。 */
  async function submit(answer: string): Promise<void> {
    if (!question.value || submitting.value) {
      return;
    }
    submitting.value = true;
    try {
      result.value = await apiFetch<AnswerResult>(`/client/questions/${question.value.sentenceId}/answer`, {
        method: 'POST',
        body: { userAnswer: answer, elapsedMs: 0, mode: mode.value },
      });
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '提交失败';
    } finally {
      submitting.value = false;
    }
  }

  /** 收藏 / 取消收藏（后端 toggle 语义，返回最终状态）。 */
  async function toggleFavorite(): Promise<void> {
    if (!result.value) {
      return;
    }
    const sentenceId = result.value.sentenceId;
    try {
      const data = await apiFetch<{ favorited: boolean }>(`/client/questions/${sentenceId}/favorite`, {
        method: 'POST',
      });
      if (result.value?.sentenceId === sentenceId) {
        result.value.favorited = data.favorited;
      }
    } catch {
      // 收藏失败静默：不打断刷题节奏
    }
  }

  return {
    question,
    result,
    loading,
    submitting,
    errorMessage,
    difficulty,
    mode,
    festival,
    festivals,
    loadNext,
    loadFestivals,
    setDifficulty,
    setMode,
    setFestival,
    prefill,
    submit,
    toggleFavorite,
  };
}

/** 是否已登录（游客拦截用，避免 SSR 访问 localStorage）。 */
export function isLoggedIn(): boolean {
  return Boolean(getToken());
}
