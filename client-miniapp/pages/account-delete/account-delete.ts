/**
 * 注销账号。
 *
 * 三个约束来自「注销不可逆」这件事本身：
 * 1. **必须二次身份校验**——邮箱账号收邮箱验证码，微信账号用 wx.login 反查 openid；
 *    只凭一个可能被捡到的 accessToken 不足以注销。
 * 2. **原因可选**——选不选都能注销（不能拿问卷卡住用户），但选了会匿名留存，
 *    用来回答「用户为什么走」。
 * 3. **提交前再确认一次**——不是防用户，是防手滑。
 */
import type { DeleteAccountPayload, DeletionReason } from '../../services/profile';
import { deleteAccount, sendDeletionCode } from '../../services/profile';
import { fetchProfile, getWxLoginCode, isLoggedIn, sessionReady } from '../../utils/auth';
import { showError, toast, toastSuccess } from '../../utils/feedback';
import { goLogin } from '../../utils/nav';
import { clearSession } from '../../utils/storage';

/** 注销原因选项（与后端 DELETION_REASON_TYPES 对齐）。 */
const REASONS: Array<{ value: DeletionReason; label: string }> = [
  { value: 'no_time', label: '没时间练' },
  { value: 'too_hard', label: '内容太难' },
  { value: 'content', label: '内容不满意' },
  { value: 'bugs', label: '使用有问题' },
  { value: 'privacy', label: '隐私顾虑' },
  { value: 'other', label: '其他原因' },
];

/** 微信建号用的占位邮箱后缀（这类账号没有可收信的真实邮箱）。 */
const WECHAT_EMAIL_SUFFIX = '@wx.local';
/** 验证码重发间隔（与后端 60 秒节流一致） */
const RESEND_SECONDS = 60;

/** 邮箱脱敏：只留前两位 + 域名。 */
function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) {
    return email;
  }
  const name = email.slice(0, at);
  const keep = name.slice(0, Math.min(2, name.length));
  return `${keep}${'*'.repeat(Math.max(1, name.length - keep.length))}${email.slice(at)}`;
}

interface DeleteData {
  reasons: typeof REASONS;
  /** 选中的原因（空字符串 = 未选择） */
  reason: string;
  detail: string;
  /** 微信账号：无邮箱可收码，改用 wx.login 校验 */
  isWechatAccount: boolean;
  /** 脱敏后的本人邮箱（微信账号为空） */
  emailMasked: string;
  emailCode: string;
  /** 重发倒计时（秒） */
  cooldown: number;
  sending: boolean;
  submitting: boolean;
}

interface DeleteCustom {
  /** 倒计时定时器（0 = 未启动） */
  timer: number;
  /** 读本人资料，判断该走哪条校验通道 */
  load(): Promise<void>;
  onPickReason(event: WechatMiniprogram.TouchEvent): void;
  onDetail(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onCode(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onSendCode(): Promise<void>;
  startCooldown(): void;
  onSubmit(): void;
  doDelete(): Promise<void>;
}

Page<DeleteData, DeleteCustom>({
  data: {
    reasons: REASONS,
    reason: '',
    detail: '',
    isWechatAccount: false,
    emailMasked: '',
    emailCode: '',
    cooldown: 0,
    sending: false,
    submitting: false,
  },

  timer: 0,

  async onLoad() {
    await sessionReady();
    if (!isLoggedIn()) {
      goLogin();
      return;
    }
    await this.load();
  },

  onUnload() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = 0;
    }
  },

  /** 读本人资料，判断该走哪条校验通道。 */
  async load() {
    try {
      const user = await fetchProfile();
      const isWechat = user.email.endsWith(WECHAT_EMAIL_SUFFIX);
      this.setData({
        isWechatAccount: isWechat,
        emailMasked: isWechat ? '' : maskEmail(user.email),
      });
    } catch (error) {
      showError(error, '读取账号信息失败');
    }
  },

  /** 选/取消选原因（可反选，允许「不想说」）。 */
  onPickReason(event: WechatMiniprogram.TouchEvent) {
    const value = String(event.currentTarget.dataset.value ?? '');
    this.setData({ reason: this.data.reason === value ? '' : value });
  },

  onDetail(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ detail: event.detail.value });
  },

  onCode(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ emailCode: event.detail.value });
  },

  /** 发注销验证码（服务端只发给本人邮箱）。 */
  async onSendCode() {
    if (this.data.sending || this.data.cooldown > 0) {
      return;
    }
    this.setData({ sending: true });
    try {
      await sendDeletionCode();
      toastSuccess('验证码已发送，请查收邮箱');
      this.startCooldown();
    } catch (error) {
      showError(error, '发送失败，请稍后重试');
    } finally {
      this.setData({ sending: false });
    }
  },

  /** 60 秒重发倒计时。 */
  startCooldown() {
    this.setData({ cooldown: RESEND_SECONDS });
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = setInterval(() => {
      const next = this.data.cooldown - 1;
      if (next <= 0) {
        clearInterval(this.timer);
        this.timer = 0;
        this.setData({ cooldown: 0 });
        return;
      }
      this.setData({ cooldown: next });
    }, 1000);
  },

  /** 提交前校验 + 确认。 */
  onSubmit() {
    if (this.data.submitting) {
      return;
    }
    if (!this.data.isWechatAccount && !this.data.emailCode.trim()) {
      toast('请先获取并填写邮箱验证码');
      return;
    }
    wx.showModal({
      title: '确认注销？',
      content: '注销后账号无法找回：学习记录、成就、收藏与打卡都会被清除。',
      confirmText: '确认注销',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          void this.doDelete();
        }
      },
    });
  },

  /** 执行注销。 */
  async doDelete() {
    this.setData({ submitting: true });
    wx.showLoading({ title: '处理中…', mask: true });
    try {
      const payload: DeleteAccountPayload = {};
      if (this.data.reason) {
        payload.reasonType = this.data.reason as DeletionReason;
      }
      const detail = this.data.detail.trim();
      if (detail) {
        payload.reasonDetail = detail;
      }
      // 微信账号现场取一次性 code；反查 openid 由服务端完成
      if (this.data.isWechatAccount) {
        payload.wechatCode = await getWxLoginCode();
      } else {
        payload.emailCode = this.data.emailCode.trim();
      }

      await deleteAccount(payload);
      wx.hideLoading();
      clearSession();
      toastSuccess('账号已注销');
      wx.reLaunch({ url: '/pages/login/login' });
    } catch (error) {
      wx.hideLoading();
      this.setData({ submitting: false });
      showError(error, '注销失败，请稍后重试');
    }
  },
});
