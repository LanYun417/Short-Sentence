/**
 * 会话管理：微信一键登录 / 邮箱密码登录 / 登出 / 启动期静默登录。
 *
 * 令牌体系与 Web、Android 完全一致（后端自建 JWT 双 token），
 * 因此 `/api/client/*` 的其余接口在小程序里可以零改造复用。
 */
import type { ClientAuthResult, ClientUserProfile } from '../services/types';
import { LOGIN_PAGE } from './nav';
import { request } from './request';
import { clearSession, getAccessToken, isLoggedOut, markLoggedOut, saveCachedUser, saveTokens } from './storage';

/** 是否已登录（本地有令牌即视为登录态，服务端失效由 401 兜底）。 */
export function isLoggedIn(): boolean {
  return Boolean(getAccessToken());
}

/** 把登录结果落盘并同步到全局。 */
function persistSession(result: ClientAuthResult): void {
  saveTokens(result.accessToken, result.refreshToken);
  saveCachedUser(result.user);
  markLoggedOut(false);
  try {
    getApp<IAppOption>().globalData.user = result.user;
  } catch {
    // App 尚未注册（极早期调用）：忽略，页面各自从缓存读
  }
}

/**
 * wx.login 取 code（Promise 化）。
 *
 * 除了登录，注销账号时也用它做**二次身份校验**：服务端拿 code 反查 openid，
 * 与本账号绑定的 openid 比对，证明操作人确实是这个微信号本人。
 */
export function getWxLoginCode(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    wx.login({
      success: (res) => {
        if (res.code) {
          resolve(res.code);
        } else {
          reject(new Error('微信登录失败：未获取到临时凭证'));
        }
      },
      fail: () => reject(new Error('微信登录失败，请重试')),
    });
  });
}

/** 微信一键登录（新用户由服务端按 openid 自动建号）。 */
export async function loginWithWechat(): Promise<ClientAuthResult> {
  const code = await getWxLoginCode();
  const result = await request<ClientAuthResult>('/client/auth/wechat', {
    method: 'POST',
    data: { code },
    auth: false,
  });
  persistSession(result);
  return result;
}

/** 邮箱密码登录（给在 Web 端注册过的老用户用）。 */
export async function loginWithPassword(email: string, password: string): Promise<ClientAuthResult> {
  const result = await request<ClientAuthResult>('/client/auth/login', {
    method: 'POST',
    data: { email: email.trim().toLowerCase(), password },
    auth: false,
  });
  persistSession(result);
  return result;
}

/** 刷新本人资料并写回缓存。 */
export async function fetchProfile(): Promise<ClientUserProfile> {
  const user = await request<ClientUserProfile>('/client/auth/me');
  saveCachedUser(user);
  try {
    getApp<IAppOption>().globalData.user = user;
  } catch {
    // 同上：忽略
  }
  return user;
}

/** 登出（服务端令旧令牌失效；本地无论如何都要清干净）。 */
export async function logout(): Promise<void> {
  try {
    await request<null>('/client/auth/logout', { method: 'POST' });
  } catch {
    // 服务端不可达也必须让本地登出成功
  }
  clearSession();
  markLoggedOut(true);
  try {
    getApp<IAppOption>().globalData.user = null;
  } catch {
    // 同上：忽略
  }
  wx.reLaunch({ url: LOGIN_PAGE });
}

/**
 * 启动期静默登录：首次进入且没有令牌时，直接用 wx.login 建立会话，
 * 让用户不必先看登录页。主动登出过则不再自动登录。
 */
export async function bootstrapSession(): Promise<void> {
  if (isLoggedIn() || isLoggedOut()) {
    return;
  }
  try {
    await loginWithWechat();
  } catch {
    // 微信登录不可用（后端未配置 AppSecret / 网络异常）：留给登录页兜底
  }
}

/** 启动流程的单飞 Promise（`app.onLaunch` 只触发一次）。 */
let booting: Promise<void> | null = null;

/**
 * 等待启动期会话就绪。
 *
 * 页面 `onShow` 可能早于静默登录完成而误判「未登录」，
 * 因此所有需要登录态的页面都必须先 await 这里，再判断 isLoggedIn()。
 */
export function sessionReady(): Promise<void> {
  if (!booting) {
    booting = bootstrapSession();
  }
  return booting;
}
