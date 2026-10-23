/**
 * 刷题会话（单卡状态机 + 后端交互）。
 *
 * 状态流转：loadNext → answering → submit → flipped → next → loadNext …
 * 翻转后的结果只保留到下一次 loadNext；达标后的今日进度由页面层消费 result.todayDone。
 */
import type { Ref } from 'vue';
import type { AnswerResult, NextQuestion } from '~/types';
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

export function useQuestionSession() {
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

  /** 拉取下一张卡（清空上一轮结果）。 */
  async function loadNext(): Promise<void> {
    loading.value = true;
    errorMessage.value = '';
    try {
      question.value = await apiFetch<NextQuestion>('/client/questions/next', {
        query: { difficulty: difficulty.value, mode: mode.value },
      });
      result.value = null;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '题目加载失败';
    } finally {
      loading.value = false;
    }
  }

  /** 切换难度：记住选择并立刻按新难度抽一张（中途切换也生效）。 */
  async function setDifficulty(value: number): Promise<void> {
    const next = Math.min(3, Math.max(1, value));
    difficulty.value = next;
    persistDifficulty(difficultyCookie, next);
    await loadNext();
  }

  /**
   * 切换作答模式：记住选择并立刻重抽一题。
   * 必须重抽——词块是服务端在抽题时下发的，沿用旧题会导致切到拼词模式后无词可点。
   */
  async function setMode(value: AnswerMode): Promise<void> {
    if (mode.value === value) {
      return;
    }
    mode.value = value;
    persistMode(modeCookie, value);
    await loadNext();
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
    loadNext,
    setDifficulty,
    setMode,
    prefill,
    submit,
    toggleFavorite,
  };
}

/** 是否已登录（游客拦截用，避免 SSR 访问 localStorage）。 */
export function isLoggedIn(): boolean {
  return Boolean(getToken());
}
