/**
 * 本地存储（令牌 / 资料缓存 / 偏好）。
 *
 * 键名统一 `ss_` 前缀：与 Web 端的 localStorage 键同名但不同容器，互不影响；
 * 小程序侧不存在跨账号串号风险，登出时会整体清理会话相关键。
 */
import type { ClientUserProfile } from '../services/types';

/** 作答模式（与后端 AnswerSentenceDto.mode 对齐）。 */
export type AnswerMode = 'input' | 'assemble';

const TOKEN_KEY = 'ss_token';
const REFRESH_KEY = 'ss_refresh_token';
const USER_KEY = 'ss_user';
const LOGGED_OUT_KEY = 'ss_logged_out';
const DIFFICULTY_KEY = 'ss_difficulty';
const MODE_KEY = 'ss_mode';

/** 读取 accessToken。 */
export function getAccessToken(): string {
  return wx.getStorageSync<string>(TOKEN_KEY) || '';
}

/** 读取 refreshToken。 */
export function getRefreshToken(): string {
  return wx.getStorageSync<string>(REFRESH_KEY) || '';
}

/** 写入令牌对。 */
export function saveTokens(accessToken: string, refreshToken: string): void {
  wx.setStorageSync(TOKEN_KEY, accessToken);
  wx.setStorageSync(REFRESH_KEY, refreshToken);
}

/** 读取缓存的用户资料（离线首屏用）。 */
export function getCachedUser(): ClientUserProfile | null {
  const raw = wx.getStorageSync<string>(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ClientUserProfile;
  } catch {
    return null;
  }
}

/** 缓存用户资料。 */
export function saveCachedUser(user: ClientUserProfile): void {
  wx.setStorageSync(USER_KEY, JSON.stringify(user));
}

/** 清空会话（令牌 + 资料），保留偏好设置。 */
export function clearSession(): void {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(REFRESH_KEY);
  wx.removeStorageSync(USER_KEY);
}

/** 是否已主动登出（决定启动时要不要静默微信登录）。 */
export function isLoggedOut(): boolean {
  return wx.getStorageSync<boolean>(LOGGED_OUT_KEY) === true;
}

/** 标记/取消「已主动登出」。 */
export function markLoggedOut(value: boolean): void {
  if (value) {
    wx.setStorageSync(LOGGED_OUT_KEY, true);
  } else {
    wx.removeStorageSync(LOGGED_OUT_KEY);
  }
}

/** 难度偏好（1 基础 / 2 进阶 / 3 挑战）。 */
export function getDifficulty(): number {
  const value = Number(wx.getStorageSync<string>(DIFFICULTY_KEY));
  return value >= 1 && value <= 3 ? value : 2;
}

/** 保存难度偏好。 */
export function setDifficulty(value: number): void {
  wx.setStorageSync(DIFFICULTY_KEY, String(value));
}

/** 作答模式偏好（默认输入/默写）。 */
export function getAnswerMode(): AnswerMode {
  return wx.getStorageSync<string>(MODE_KEY) === 'assemble' ? 'assemble' : 'input';
}

/** 保存作答模式偏好。 */
export function setAnswerMode(mode: AnswerMode): void {
  wx.setStorageSync(MODE_KEY, mode);
}
