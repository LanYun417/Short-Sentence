/**
 * 鉴权状态（Pinia + 手动持久化到 localStorage）。
 * 刻意不用 pinia-plugin-persistedstate：客户端依赖从简，持久化只有 token/user 两个 key。
 */
import { defineStore } from 'pinia';
import type { ClientUserProfile } from '~/types';
import {
  apiFetch,
  clearCachedUser,
  clearToken,
  getCachedUser,
  getToken,
  setCachedUser,
  setToken,
} from '~/composables/useApi';

export const useAuthStore = defineStore('auth', () => {
  /** 当前用户（未登录为 null） */
  const user = ref<ClientUserProfile | null>(getCachedUser<ClientUserProfile>());
  /** 是否已登录 */
  const loggedIn = computed(() => Boolean(getToken()));

  /** 登录（成功后缓存令牌与资料）。 */
  async function login(email: string, password: string): Promise<void> {
    const data = await apiFetch<{ accessToken: string; refreshToken: string; user: ClientUserProfile }>(
      '/client/auth/login',
      { method: 'POST', body: { email, password } },
    );
    setToken(data.accessToken, data.refreshToken);
    setCachedUser(data.user);
    user.value = data.user;
  }

  /** 注册（成功后直接登录）。 */
  async function register(email: string, password: string, nickname?: string): Promise<void> {
    const data = await apiFetch<{ accessToken: string; refreshToken: string; user: ClientUserProfile }>(
      '/client/auth/register',
      { method: 'POST', body: { email, password, nickname } },
    );
    setToken(data.accessToken, data.refreshToken);
    setCachedUser(data.user);
    user.value = data.user;
  }

  /** 拉取最新资料（启动/个人中心用）。 */
  async function fetchMe(): Promise<void> {
    if (!getToken()) {
      return;
    }
    const profile = await apiFetch<ClientUserProfile>('/client/auth/me');
    setCachedUser(profile);
    user.value = profile;
  }

  /** 更新资料（合并本地状态）。 */
  async function updateProfile(payload: Record<string, unknown>): Promise<ClientUserProfile> {
    const profile = await apiFetch<ClientUserProfile>('/client/auth/me', { method: 'PUT', body: payload });
    setCachedUser(profile);
    user.value = profile;
    return profile;
  }

  /** 修改密码（成功后强制重新登录）。 */
  async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await apiFetch<null>('/client/auth/password', { method: 'PUT', body: { oldPassword, newPassword } });
    logout();
  }

  /** 登出（服务端黑名单 + 本地清态）。 */
  async function logout(): Promise<void> {
    if (getToken()) {
      // 静默调用：失败也清本地态
      await apiFetch<null>('/client/auth/logout', { method: 'POST', silent: true });
    }
    clearToken();
    clearCachedUser();
    user.value = null;
  }

  return { user, loggedIn, login, register, fetchMe, updateProfile, changePassword, logout };
});
