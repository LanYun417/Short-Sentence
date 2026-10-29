/**
 * 鉴权状态（Pinia + localStorage/Cookie 双写）。
 * 刻意不用 pinia-plugin-persistedstate：客户端依赖从简，持久化只有 token/user 两个 key。
 *
 * 两个关键约定：
 * 1. token 用**响应式 ref** 持有，且初始值取自 Cookie（SSR 可读）。
 *    早期实现是 `computed(() => getToken())`，localStorage 非响应式、computed 无依赖会被永久缓存，
 *    登录/登出后 UI 不更新；且 SSR 下服务端读不到 localStorage，刷新必掉登录。
 * 2. user 初始为 null，**不在 setup 里读 localStorage**：避免服务端（null）与客户端（有缓存）
 *    首屏不一致导致水合报错。挂载后由 `hydrate()` 恢复缓存资料。
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
  /** 令牌 Cookie（SSR 时服务端可读；同时是客户端登录态的唯一事实源） */
  const tokenCookie = useCookie<string | null>('ss_token', {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });
  /** accessToken（响应式，供 UI 判定） */
  const token = ref<string | null>(tokenCookie.value ?? null);
  /** 当前用户（未登录为 null；挂载后由 hydrate 恢复） */
  const user = ref<ClientUserProfile | null>(null);
  /** 是否已登录 */
  const loggedIn = computed(() => Boolean(token.value));

  /** 写入令牌：Cookie（SSR 守卫）+ localStorage（API Bearer）。 */
  function applyToken(accessToken: string, refreshToken: string): void {
    tokenCookie.value = accessToken;
    token.value = accessToken;
    setToken(accessToken, refreshToken);
  }

  /** 客户端挂载后恢复：旧会话迁移 + 本地缓存资料。不参与 SSR，避免水合不一致。 */
  function hydrate(): void {
    if (!import.meta.client) {
      return;
    }
    // 兼容本次改动前的旧会话：只有 localStorage、没有 Cookie，补写一次
    if (!token.value) {
      const legacy = getToken();
      if (legacy) {
        tokenCookie.value = legacy;
        token.value = legacy;
      }
    }
    if (!user.value) {
      user.value = getCachedUser<ClientUserProfile>();
    }
  }

  /** 登录（账号 + 密码即可，不再需要验证码）。 */
  async function login(email: string, password: string): Promise<void> {
    const data = await apiFetch<{ accessToken: string; refreshToken: string; user: ClientUserProfile }>(
      '/client/auth/login',
      { method: 'POST', body: { email, password } },
    );
    applyToken(data.accessToken, data.refreshToken);
    setCachedUser(data.user);
    user.value = data.user;
  }

  /** 注册（成功后直接登录；必须先通过邮箱验证码）。 */
  async function register(email: string, password: string, nickname?: string, emailCode?: string): Promise<void> {
    const data = await apiFetch<{ accessToken: string; refreshToken: string; user: ClientUserProfile }>(
      '/client/auth/register',
      { method: 'POST', body: { email, password, nickname, emailCode } },
    );
    applyToken(data.accessToken, data.refreshToken);
    setCachedUser(data.user);
    user.value = data.user;
  }

  /** 拉取最新资料（启动/个人中心用）。 */
  async function fetchMe(): Promise<void> {
    if (!token.value) {
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

  /** 用服务端返回的资料整体覆盖本地态（头像上传等场景：接口直接返回最新资料）。 */
  function setProfile(profile: ClientUserProfile): void {
    setCachedUser(profile);
    user.value = profile;
  }

  /** 修改密码（需邮箱验证码；成功后强制重新登录）。 */
  async function changePassword(oldPassword: string, newPassword: string, emailCode: string): Promise<void> {
    await apiFetch<null>('/client/auth/password', {
      method: 'PUT',
      body: { oldPassword, newPassword, emailCode },
    });
    await logout();
  }

  /** 登出（服务端黑名单 + 本地清态 + 清 Cookie）。 */
  async function logout(): Promise<void> {
    if (token.value) {
      // 静默调用：失败也清本地态
      await apiFetch<null>('/client/auth/logout', { method: 'POST', silent: true });
    }
    tokenCookie.value = null;
    token.value = null;
    clearToken();
    clearCachedUser();
    user.value = null;
  }

  // 注意：不把 token 暴露为 store state，避免 accessToken 被序列化进 SSR 的 __NUXT__ payload（HTML 源码可见）。
  return {
    user,
    loggedIn,
    hydrate,
    login,
    register,
    fetchMe,
    updateProfile,
    setProfile,
    changePassword,
    logout,
  };
});
