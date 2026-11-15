/**
 * 网络层：wx.request 封装（统一信封解包 + 令牌注入 + 401 无感刷新）。
 *
 * 与 Web 端 `useApi.ts` 的语义保持一致，便于两端排查同一个问题：
 * - 后端成功响应恒为 `{ code: 200, message, data }`，这里直接返回 `data`；
 * - 业务错误（code !== 200）统一抛 ApiError，携带服务端 message；
 * - 401 先单飞刷新一次并重放原请求，刷新失败清会话并跳登录。
 */
import type { ApiEnvelope } from '../services/types';
import { API_BASE_URL } from './env';
import { goLogin } from './nav';
import { clearSession, getAccessToken, getRefreshToken, saveTokens } from './storage';

/** 业务/网络错误。 */
export class ApiError extends Error {
  /** 业务码；网络层失败为 -1 */
  code: number;

  constructor(message: string, code: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

/** 支持的 HTTP 动词（wx.request 不支持 PATCH，故不纳入）。 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** 请求选项。 */
export interface RequestOptions {
  method?: HttpMethod;
  /** GET 作 query 参数，其余作 JSON body */
  data?: Record<string, unknown>;
  /** 免登录接口（登录/注册/站点配置）：不带令牌，401 也不触发刷新 */
  auth?: boolean;
  /** 跳过 401 自动刷新（刷新接口自身使用，防递归） */
  noRefresh?: boolean;
}

/** 一次原始响应。 */
interface RawResponse {
  statusCode: number;
  body: unknown;
}

/** 是否正在刷新（单飞：并发 401 只刷一次）。 */
let refreshing: Promise<string | null> | null = null;

/** 调用刷新接口换新 accessToken；失败返回 null。 */
function doRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return Promise.resolve(null);
  }
  return new Promise<string | null>((resolve) => {
    wx.request({
      url: `${API_BASE_URL}/client/auth/refresh`,
      method: 'POST',
      data: { refreshToken },
      timeout: 15000,
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        const body = res.data as ApiEnvelope<{ accessToken: string; refreshToken: string }> | undefined;
        if (res.statusCode === 200 && body && body.code === 200 && body.data && body.data.accessToken) {
          saveTokens(body.data.accessToken, body.data.refreshToken);
          resolve(body.data.accessToken);
          return;
        }
        resolve(null);
      },
      fail: () => resolve(null),
    });
  });
}

/** 单飞刷新。 */
function refreshOnce(): Promise<string | null> {
  if (!refreshing) {
    refreshing = doRefresh().then((token) => {
      refreshing = null;
      return token;
    });
  }
  return refreshing;
}

/** 鉴权彻底失效：清会话 + 跳登录（reLaunch 清返回栈）。 */
function handleAuthFailure(): void {
  clearSession();
  goLogin();
}

/** 发送一次请求（不做任何业务判定）。 */
function send(url: string, options: RequestOptions, token: string): Promise<RawResponse> {
  return new Promise<RawResponse>((resolve, reject) => {
    const header: Record<string, string> = {
      'Content-Type': 'application/json',
      // 后端据此格式化时间（东八区为 -480）
      'X-Timezone-Offset': String(new Date().getTimezoneOffset()),
    };
    if (token) {
      header.Authorization = `Bearer ${token}`;
    }
    wx.request({
      url: `${API_BASE_URL}${url}`,
      method: options.method ?? 'GET',
      data: options.data ?? {},
      header,
      timeout: 20000,
      success: (res) => resolve({ statusCode: res.statusCode, body: res.data }),
      fail: (err) => reject(new ApiError(err.errMsg || '网络异常，请检查网络后重试', -1)),
    });
  });
}

/** 判断是否为统一响应信封。 */
function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return typeof value === 'object' && value !== null && 'code' in value;
}

/**
 * 发起请求并返回业务数据。
 * @param url 接口路径（以 `/client/...` 开头，不含基地址）
 * @param options 请求选项
 */
export async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const withAuth = options.auth !== false;
  let token = withAuth ? getAccessToken() : '';
  let res = await send(url, options, token);

  // 401：刷新一次后重放（刷新失败视为登录态彻底失效）
  if (res.statusCode === 401 && withAuth && !options.noRefresh) {
    const renewed = await refreshOnce();
    if (!renewed) {
      handleAuthFailure();
      throw new ApiError('登录状态已失效，请重新登录', 401);
    }
    token = renewed;
    res = await send(url, options, token);
  }

  const body = res.body;
  if (isEnvelope(body)) {
    if (body.code === 200) {
      return body.data as T;
    }
    if (body.code === 401) {
      handleAuthFailure();
    }
    throw new ApiError(body.message || '请求失败', body.code);
  }

  // 非信封（导出等裸响应）：2xx 直接返回原始体
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return body as T;
  }
  throw new ApiError(`请求失败（${res.statusCode}）`, res.statusCode);
}

/**
 * 静默请求：失败返回 null，不抛异常（用于「拿不到也不影响主流程」的旁路数据）。
 */
export async function tryRequest<T>(url: string, options: RequestOptions = {}): Promise<T | null> {
  try {
    return await request<T>(url, options);
  } catch {
    return null;
  }
}
