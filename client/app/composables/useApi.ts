/**
 * HTTP 封装（$fetch + 令牌注入 + 401 无感刷新）。
 *
 * 约定：
 * - 基地址取 runtimeConfig.public.apiBaseUrl（默认 /api，开发期 nitro 代理到 :3000）；
 * - 业务错误（响应体 code !== 200）统一抛 ApiError，含服务端 message；
 * - 401 先尝试刷新一次并重放原请求；刷新失败清态并跳登录（带 redirect）。
 */
import type { ApiEnvelope } from '~/types';

/** 业务错误（携带服务端 code/message）。 */
export class ApiError extends Error {
  code: number;

  constructor(message: string, code: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

/** 令牌存储 key（与后台 admin 的 ly_admin_* 刻意区分，双端共存同一浏览器也不串号）。 */
const TOKEN_KEY = 'ss_token';
const REFRESH_TOKEN_KEY = 'ss_refresh_token';
const USER_KEY = 'ss_user';

/** 读取/写入 accessToken。 */
export function getToken(): string | null {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
}

export function setToken(token: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** 读取/写入缓存的用户资料。 */
export function getCachedUser<T>(): T | null {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(USER_KEY) : null;
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setCachedUser<T>(user: T): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearCachedUser(): void {
  localStorage.removeItem(USER_KEY);
}

/** 是否正在刷新（单飞：并发 401 只刷一次）。 */
let refreshing: Promise<string | null> | null = null;

/** 刷新 accessToken；失败返回 null。 */
async function refreshToken(): Promise<string | null> {
  const refresh = typeof localStorage !== 'undefined' ? localStorage.getItem(REFRESH_TOKEN_KEY) : null;
  if (!refresh) {
    return null;
  }
  try {
    const config = useRuntimeConfig();
    const response = await $fetch<ApiEnvelope<{ accessToken: string; refreshToken: string }>>(
      `${config.public.apiBaseUrl}/client/auth/refresh`,
      { method: 'POST', body: { refreshToken: refresh } },
    );
    if (response.code === 200 && response.data?.accessToken) {
      setToken(response.data.accessToken, response.data.refreshToken);
      return response.data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

/** 无感刷新（单飞）。 */
function refreshOnce(): Promise<string | null> {
  if (!refreshing) {
    refreshing = refreshToken().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/** 鉴权失败统一处理：清态 + 跳登录。 */
function handleAuthFailure(): void {
  clearToken();
  clearCachedUser();
  if (!window.location.pathname.startsWith('/login')) {
    navigateTo(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }
}

/** 请求选项。 */
export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, unknown>;
  /** 静默：业务错误也不抛（返回 null），由调用方自行处理 */
  silent?: boolean;
}

/**
 * 通用请求（拦截器已解包，直接返回 data）。
 * @param path 接口路径（不含基地址，如 `/client/questions/next`）
 * @param options 请求选项
 */
export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const config = useRuntimeConfig();
  const method = options.method ?? 'GET';

  const buildHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    // 告知后端用户时区偏移（CSV/时间格式化用；东八区为 -480）
    headers['X-Timezone-Offset'] = String(new Date().getTimezoneOffset());
    return headers;
  };

  const send = async (): Promise<ApiEnvelope<T>> =>
    $fetch<ApiEnvelope<T>>(`${config.public.apiBaseUrl}${path}`, {
      method,
      body: options.body as Record<string, unknown> | undefined,
      query: options.query,
      headers: buildHeaders(),
    });

  try {
    const response = await send();
    if (response.code === 200) {
      return response.data;
    }
    if (response.code === 401) {
      const token = await refreshOnce();
      if (token) {
        const retry = await send();
        if (retry.code === 200) {
          return retry.data;
        }
      }
      handleAuthFailure();
      throw new ApiError(response.message || '登录状态已失效', 401);
    }
    throw new ApiError(response.message || '请求失败', response.code);
  } catch (error) {
    if (error instanceof ApiError) {
      if (options.silent) {
        return null as T;
      }
      throw error;
    }
    // $fetch 的 HTTP 层错误（网络异常 / 5xx）：解析响应体拿业务码
    const fetchError = error as { response?: { status?: number; _data?: ApiEnvelope<unknown> } };
    if (fetchError.response?.status === 401) {
      const token = await refreshOnce();
      if (token) {
        try {
          const retry = await send();
          if (retry.code === 200) {
            return retry.data;
          }
        } catch {
          // 重放仍失败，落入下方失败处理
        }
      }
      handleAuthFailure();
    }
    if (options.silent) {
      return null as T;
    }
    const message = fetchError.response?._data?.message ?? '网络异常，请稍后重试';
    throw new ApiError(message, fetchError.response?.status ?? 0);
  }
}
