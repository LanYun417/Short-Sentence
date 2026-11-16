/**
 * 登录页：微信一键登录（主路径）+ 邮箱密码登录（Web 老用户兜底）。
 *
 * 会话与 Web / Android 完全共用（后端自建 JWT），登录成功后所有 `/api/client/*` 通用。
 */
import {
  isLoggedIn,
  loginWithCode,
  loginWithPassword,
  loginWithWechat,
  sendEmailCode,
  sessionReady,
} from '../../utils/auth';
import { showError, toast } from '../../utils/feedback';

interface LoginData {
  /** wechat 微信一键登录 / email 邮箱密码登录 / code 邮箱验证码登录 */
  mode: 'wechat' | 'email' | 'code';
  email: string;
  password: string;
  /** 邮箱验证码（验证码登录用） */
  emailCode: string;
  loading: boolean;
  /** 是否已勾选同意用户协议与隐私政策（微信登录=新用户注册，必须勾选） */
  agreed: boolean;
  /** 验证码发送中 / 重发倒计时（秒，0 = 可发送） */
  codeSending: boolean;
  codeCountdown: number;
}

interface LoginCustom {
  gotoHome(): void;
  onSwitchMode(): void;
  onEmailInput(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onPasswordInput(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onCodeInput(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onToggleAgreed(): void;
  onToggleLoginMode(): void;
  onSendCode(): Promise<void>;
  onWechatLogin(): Promise<void>;
  onEmailLogin(): Promise<void>;
  onOpenTerms(): void;
  onOpenPrivacy(): void;
  onCodeLogin(): Promise<void>;
}

/** 验证码重发倒计时定时器（跟随页面 onUnload 清理，模块级单例）。 */
let codeTimer: number | null = null;

Page<LoginData, LoginCustom>({
  data: {
    mode: 'wechat',
    email: '',
    password: '',
    emailCode: '',
    loading: false,
    agreed: false,
    codeSending: false,
    codeCountdown: 0,
  },

  async onShow() {
    // 等启动期静默登录落地，已登录（含静默登录成功）直接进首页
    await sessionReady();
    if (isLoggedIn()) {
      this.gotoHome();
    }
  },

  /** 回到首页（tab 页用 reLaunch 清栈）。 */
  gotoHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  },

  /** 微信登录 / 邮箱登录切换。 */
  onSwitchMode() {
    this.setData({ mode: this.data.mode === 'wechat' ? 'email' : 'wechat' });
  },

  /** 邮箱输入。 */
  onEmailInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ email: event.detail.value });
  },

  /** 密码输入。 */
  onPasswordInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ password: event.detail.value });
  },

  /** 验证码输入。 */
  onCodeInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ emailCode: event.detail.value });
  },

  /** 切换协议勾选。 */
  onToggleAgreed() {
    this.setData({ agreed: !this.data.agreed });
  },

  /** 邮箱登录方式切换：密码 ↔ 验证码。 */
  onToggleLoginMode() {
    const next = this.data.mode === 'code' ? 'email' : 'code';
    this.setData({
      mode: next,
      password: next === 'code' ? '' : this.data.password,
      emailCode: next === 'email' ? '' : this.data.emailCode,
    });
  },

  /** 发送登录验证码（purpose=login；60 秒倒计时）。 */
  async onSendCode() {
    const email = this.data.email.trim();
    if (!email || !email.includes('@')) {
      toast('请先填写正确的邮箱');
      return;
    }
    this.setData({ codeSending: true });
    try {
      await sendEmailCode(email, 'login');
      toast('验证码已发送，请查收邮箱（含垃圾箱）');
      this.setData({ codeCountdown: 60 });
      codeTimer = setInterval(() => {
        const left = this.data.codeCountdown - 1;
        if (left <= 0) {
          this.setData({ codeCountdown: 0 });
          if (codeTimer) {
            clearInterval(codeTimer);
            codeTimer = null;
          }
        } else {
          this.setData({ codeCountdown: left });
        }
      }, 1000) as unknown as number;
    } catch (error) {
      showError(error, '验证码发送失败，请稍后重试');
    } finally {
      this.setData({ codeSending: false });
    }
  },

  /** 微信一键登录（新用户自动建号 = 注册，必须先勾选协议）。 */
  async onWechatLogin() {
    if (this.data.loading) {
      return;
    }
    if (!this.data.agreed) {
      toast('请先阅读并同意用户协议与隐私政策');
      return;
    }
    this.setData({ loading: true });
    try {
      await loginWithWechat(true);
      this.gotoHome();
    } catch (error) {
      showError(error, '微信登录失败，请重试');
    } finally {
      this.setData({ loading: false });
    }
  },

  /** 邮箱密码登录。 */
  async onEmailLogin() {
    if (this.data.loading) {
      return;
    }
    const email = this.data.email.trim();
    const password = this.data.password;
    if (!email || !password) {
      toast('请输入邮箱和密码');
      return;
    }
    this.setData({ loading: true });
    try {
      await loginWithPassword(email, password);
      this.gotoHome();
    } catch (error) {
      showError(error, '登录失败，请检查邮箱和密码');
    } finally {
      this.setData({ loading: false });
    }
  },

  /** 打开用户协议 / 隐私政策（与「我的」页同一组页面）。 */
  onOpenTerms() {
    wx.navigateTo({ url: '/pages/terms/terms' });
  },

  onOpenPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  /** 邮箱验证码登录。 */
  async onCodeLogin() {
    if (this.data.loading) {
      return;
    }
    const email = this.data.email.trim();
    const code = this.data.emailCode.trim();
    if (!email || !/^\d{6}$/.test(code)) {
      toast('请输入邮箱和 6 位验证码');
      return;
    }
    this.setData({ loading: true });
    try {
      await loginWithCode(email, code);
      this.gotoHome();
    } catch (error) {
      showError(error, '登录失败，请检查验证码或稍后重试');
    } finally {
      this.setData({ loading: false });
    }
  },

  onUnload() {
    // 倒计时定时器必须跟着页面销毁，否则切走还在跑
    if (codeTimer) {
      clearInterval(codeTimer);
      codeTimer = null;
    }
  },
});
