/**
 * 刷题会话（单卡状态机 + 后端交互）。
 *
 * 状态流转：loadNext → answering → submit → flipped → next → loadNext …
 * 翻转后的结果只保留到下一次 loadNext；打卡达标的海报数据由页面层消费 result.todayDone。
 */
import type { AnswerResult, NextQuestion } from '~/types';
import { apiFetch, getToken } from '~/composables/useApi';

export function useQuestionSession() {
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

  /** 拉取下一张卡（清空上一轮结果）。 */
  async function loadNext(): Promise<void> {
    loading.value = true;
    errorMessage.value = '';
    try {
      question.value = await apiFetch<NextQuestion>('/client/questions/next');
      result.value = null;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '题目加载失败';
    } finally {
      loading.value = false;
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
        body: { userAnswer: answer, elapsedMs: 0 },
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
    loadNext,
    submit,
    toggleFavorite,
  };
}

/** 是否已登录（游客拦截用，避免 SSR 访问 localStorage）。 */
export function isLoggedIn(): boolean {
  return Boolean(getToken());
}
