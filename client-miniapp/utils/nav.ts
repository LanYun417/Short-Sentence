/**
 * 导航小工具（独立成文件，避免 request ↔ auth 互相 import 形成环）。
 */

/** 登录页路径。 */
export const LOGIN_PAGE = '/pages/login/login';

/** 当前页面路由（用于「已在登录页就不再跳」的判定）。 */
function currentRoute(): string {
  const pages = getCurrentPages();
  const top = pages[pages.length - 1] as { route?: string } | undefined;
  return top?.route ?? '';
}

/** 跳登录页（reLaunch：清掉返回栈，避免登录后回退到需登录的页面）。 */
export function goLogin(): void {
  if (currentRoute() === 'pages/login/login') {
    return;
  }
  wx.reLaunch({ url: LOGIN_PAGE });
}

/** 去刷题页。 */
export function goPractice(query = ''): void {
  wx.navigateTo({ url: `/pages/practice/practice${query}` });
}

/** 切到某个 tab 页（tabBar 页面必须用 switchTab）。 */
export function switchTab(url: string): void {
  wx.switchTab({ url });
}
