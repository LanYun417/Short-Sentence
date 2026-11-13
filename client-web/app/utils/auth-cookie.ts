/**
 * 令牌 Cookie 读写（供 SSR 守卫与 401 兜底使用）。
 *
 * 为什么令牌要同时放 localStorage 和 Cookie：
 * - localStorage：客户端 API 请求注入 `Authorization: Bearer`。
 * - Cookie：SSR 时服务端读不到 localStorage，路由中间件必须靠 Cookie 判断登录态，
 *   否则刷新会被误判为未登录、302 回登录页。
 *
 * Cookie 为非 httpOnly（登录后由客户端写入），只用于「是否登录」的判定，
 * 不参与接口鉴权（后端仍只认 Authorization 头），因此不引入额外的 CSRF 面。
 */
const TOKEN_COOKIE = 'ss_token';
/** 与 refreshToken 有效期对齐（7 天）。 */
const MAX_AGE = 60 * 60 * 24 * 7;

/** 写入令牌 Cookie（客户端）。 */
export function setTokenCookie(token: string): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`;
}

/** 清除令牌 Cookie（客户端）。 */
export function clearTokenCookie(): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export { TOKEN_COOKIE };
