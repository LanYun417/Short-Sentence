/**
 * 邮箱验证码（发送 + 60 秒倒计时）。
 *
 * 三处复用：注册（purpose=register）、修改密码（purpose=reset），
 * 登录不再需要验证码。倒计时与「发送中」都放在这里，
 * 避免每个页面各写一套 setInterval（还会各自忘记清理）。
 */
import { apiFetch } from '~/composables/useApi';

/** 验证码用途（与后端 `SendEmailCodeDto.purpose` 一致） */
export type EmailCodePurpose = 'register' | 'login' | 'reset';

/** 倒计时秒数（与后端 60 秒节流对齐） */
const COUNTDOWN_SECONDS = 60;

export function useEmailCode(purpose: EmailCodePurpose) {
  /** 验证码输入值 */
  const code = ref('');
  const sending = ref(false);
  /** 剩余秒数（0 = 可再次发送） */
  const countdown = ref(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  function stopTimer(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function startCountdown(): void {
    stopTimer();
    countdown.value = COUNTDOWN_SECONDS;
    timer = setInterval(() => {
      countdown.value -= 1;
      if (countdown.value <= 0) {
        stopTimer();
      }
    }, 1000);
  }

  /**
   * 发送验证码到指定邮箱。
   * @returns 失败原因（空串 = 发送成功）
   */
  async function send(email: string): Promise<string> {
    const target = email.trim();
    if (!target) {
      return '请先填写邮箱';
    }
    if (sending.value || countdown.value > 0) {
      return '';
    }
    sending.value = true;
    try {
      await apiFetch<null>('/client/auth/email-code', {
        method: 'POST',
        body: { email: target, purpose },
      });
      startCountdown();
      return '';
    } catch (error) {
      return error instanceof Error ? error.message : '验证码发送失败';
    } finally {
      sending.value = false;
    }
  }

  /** 组件卸载时清掉定时器（否则页面切走后仍在跑，控制台报 scope 泄漏） */
  onBeforeUnmount(stopTimer);

  /** 按钮文案 */
  const sendText = computed(() => {
    if (sending.value) {
      return '发送中…';
    }
    return countdown.value > 0 ? `${countdown.value}s 后重发` : '发送验证码';
  });

  const canSend = computed(() => !sending.value && countdown.value === 0);

  return { code, sending, countdown, send, sendText, canSend };
}
