/**
 * 为同源 `/static` 静态资源附加访问令牌。
 *
 * 后端 `/static` 已启用鉴权（见 `api/src/common/http/static-auth.middleware.ts`，由 `app.setup.ts`
 * 显式挂到 express 栈上），而浏览器渲染 `<img>` 时**不会**自动附带 `Authorization` 头，
 * 后端为此内置了 `?token=` 回退（`extractToken`）。因此前端必须在静态资源 URL 上拼令牌，
 * 否则题目配图一律 401，卡片只剩「配图缺失」占位（与 admin 端 `utils/uploadToken.ts` 同一套约定）。
 *
 * 仅对同源且路径以 `/static` 开头的资源附加；跨域 / 外部 / 非上传资源原样返回，避免令牌外泄给第三方。
 * 无登录态时原样返回（由静态鉴权中间件统一返回 401）。
 */
import { getToken } from '~/composables/useApi';

/** 提取 URL 的 pathname（相对路径直接返回；异常时回退空串）。 */
function toPath(url: string): string {
  if (url.startsWith('/')) {
    return url;
  }
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
}

/**
 * 为静态资源 URL 附加访问令牌（仅同源 `/static`）。
 * @param url 资源地址（可为相对路径或绝对地址）
 * @param token 显式令牌（SSR 场景必须传 Cookie 里读到的值——服务端读不到 localStorage，
 *   显式传入才能让 SSR 输出的图片 URL 带令牌且与客户端水合结果一致）
 * @returns 处理后的地址；无需或无法附加时原样返回
 */
export function withUploadToken(url?: string | null, token?: string | null): string {
  if (!url) {
    return '';
  }
  const value = token ?? getToken();
  if (!value) {
    return url;
  }
  // 跨域 / 外部资源不附加令牌，避免泄露给第三方
  if (/^https?:\/\//i.test(url)) {
    // SSR 无 window 无法判同源：绝对地址保守原样返回（业务里图片都是相对路径，走不到这里）
    if (typeof window === 'undefined') {
      return url;
    }
    try {
      if (new URL(url).origin !== window.location.origin) {
        return url;
      }
    } catch {
      return url;
    }
  }
  // 仅对同源 /static 资源附加
  if (!toPath(url).startsWith('/static')) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(value)}`;
}
