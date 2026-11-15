/**
 * 登录页：微信一键登录（主路径）+ 邮箱密码登录（Web 老用户兜底）。
 *
 * 会话与 Web / Android 完全共用（后端自建 JWT），登录成功后所有 `/api/client/*` 通用。
 */
import { isLoggedIn, loginWithPassword, loginWithWechat, sessionReady } from '../../utils/auth';
import { showError, toast } from '../../utils/feedback';

interface LoginData {
  mode: 'wechat' | 'email';
  email: string;
  password: string;
  loading: boolean;
}

interface LoginCustom {
  gotoHome(): void;
  onSwitchMode(): void;
  onEmailInput(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onPasswordInput(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onWechatLogin(): Promise<void>;
  onEmailLogin(): Promise<void>;
  onOpenTerms(): void;
  onOpenPrivacy(): void;
}

Page<LoginData, LoginCustom>({
  data: {
    mode: 'wechat',
    email: '',
    password: '',
    loading: false,
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

  /** 微信一键登录。 */
  async onWechatLogin() {
    if (this.data.loading) {
      return;
    }
    this.setData({ loading: true });
    try {
      await loginWithWechat();
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
});
