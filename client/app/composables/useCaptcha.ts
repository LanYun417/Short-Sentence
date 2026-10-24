/**
 * 登录 / 注册图形验证码。
 *
 * 约定：服务端 `GET /client/auth/captcha` 返回 `{ enabled, captchaId, image }`。
 * - `enabled=false`（服务端关闭验证码）时整个输入框不渲染，登录/注册不带验证码字段；
 * - 验证码**单次有效**：登录或注册失败后服务端已作废它，所以失败时必须 refresh；
 * - 点击图片本身刷新（用户看不清时的第一反应就是点图）。
 */
import { apiFetch } from './useApi';

/** 验证码数据（image 是 data:image/png;base64）。 */
export interface CaptchaState {
  enabled: boolean;
  captchaId: string | null;
  image: string | null;
}

export function useCaptcha() {
  const captcha = ref<CaptchaState | null>(null);
  /** 用户输入的验证码字符。 */
  const code = ref('');
  const loading = ref(false);

  /** 拉取新验证码（同时清空已输入内容）。 */
  async function refresh(): Promise<void> {
    loading.value = true;
    try {
      captcha.value = await apiFetch<CaptchaState>('/client/auth/captcha');
      code.value = '';
    } catch {
      // 拉不到就不阻塞登录（服务端可能关闭了验证码或网络异常），由服务端最终裁决
      captcha.value = null;
    } finally {
      loading.value = false;
    }
  }

  /** 提交时附带的验证码字段（未开启时两个都是 undefined）。 */
  function payload(): { captchaId?: string; captchaCode?: string } {
    if (!captcha.value?.enabled || !captcha.value.captchaId) {
      return {};
    }
    return { captchaId: captcha.value.captchaId, captchaCode: code.value.trim() };
  }

  return { captcha, code, loading, refresh, payload };
}
