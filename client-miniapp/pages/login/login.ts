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
  /** 是否已勾选同意用户协议与隐私政策（微信登录=新用户注册，必须勾选） */
  agreed: boolean;
}

interface LoginCustom {
  gotoHome(): void;
  onSwitchMode(): void;
  onEmailInput(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onPasswordInput(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onToggleAgreed(): void;
  onWechatLogin(): Promise<void>;
  onEmailLogin(): Promise<void>;
}

Page<LoginData, LoginCustom>({
  data: {
    mode: 'wechat',
    email: '',
    password: '',
    loading: false,
    agreed: false,
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

  /** 切换协议勾选。 */
  onToggleAgreed() {
    this.setData({ agreed: !this.data.agreed });
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
});
