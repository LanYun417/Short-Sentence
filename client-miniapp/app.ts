import { sessionReady } from './utils/auth';

App<IAppOption>({
  globalData: {
    user: null,
  },
  onLaunch() {
    // 静默建立会话：本地已有令牌直接复用；否则用 wx.login 自动登录（失败不阻断启动）
    void sessionReady();
  },
});
