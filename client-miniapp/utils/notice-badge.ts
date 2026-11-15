/**
 * tabBar 未读红点。
 *
 * 未读公告挂在「我的」这个 tab 上：小程序没有全局红点，只能给 tab 加徽标，
 * 而通知入口在「我的」里，所以徽标打在 index=3。
 */
import { fetchUnreadCount } from '../services/community';

/** 「我的」在 tabBar 里的下标（与 app.json 的 list 顺序一致）。 */
const MINE_TAB_INDEX = 3;

/**
 * 拉未读数并同步到 tabBar 徽标。
 * @returns 未读条数（拉取失败按 0 处理，不影响页面）
 */
export async function syncNoticeBadge(): Promise<number> {
  const result = await fetchUnreadCount().catch(() => ({ count: 0 }));
  const count = result.count || 0;
  try {
    if (count > 0) {
      wx.setTabBarBadge({ index: MINE_TAB_INDEX, text: count > 99 ? '99+' : String(count) });
    } else {
      wx.removeTabBarBadge({ index: MINE_TAB_INDEX });
    }
  } catch {
    // 非 tabBar 页面 / 时机过早：忽略，下次进入页面会再同步
  }
  return count;
}
