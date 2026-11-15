/**
 * 通知：公告列表 + 未读红点 + 点开已读。
 */
import { fetchNotices, fetchUnreadCount, markAllNoticesRead, markNoticeRead } from '../../services/community';
import type { ClientNoticeItem } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { showError, toastSuccess } from '../../utils/feedback';
import { goLogin } from '../../utils/nav';

const PAGE_SIZE = 20;

/** 通知视图模型。 */
interface NoticeView {
  id: number;
  title: string;
  content: string;
  typeText: string;
  time: string;
  unread: boolean;
  pinned: boolean;
}

/** 通知类型文案。 */
const TYPE_TEXT: Record<number, string> = { 1: '系统', 2: '公告', 3: '活动' };

interface NoticesData {
  items: NoticeView[];
  unread: number;
  page: number;
  hasMore: boolean;
  loading: boolean;
  expandedId: number;
}

interface NoticesCustom {
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
  toView(item: ClientNoticeItem): NoticeView;
  onOpen(event: WechatMiniprogram.TouchEvent): void;
  onReadAll(): Promise<void>;
}

Page<NoticesData, NoticesCustom>({
  data: {
    items: [],
    unread: 0,
    page: 1,
    hasMore: false,
    loading: true,
    expandedId: 0,
  },

  async onShow() {
    await sessionReady();
    if (!isLoggedIn()) {
      goLogin();
      return;
    }
    await this.refresh();
  },

  onPullDownRefresh() {
    void this.refresh().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    void this.loadMore();
  },

  /** 拉第一页 + 未读数。 */
  async refresh() {
    try {
      const [result, unread] = await Promise.all([
        fetchNotices(1, PAGE_SIZE),
        fetchUnreadCount().catch(() => ({ count: 0 })),
      ]);
      this.setData({
        items: result.list.map((item) => this.toView(item)),
        unread: unread.count,
        page: 1,
        hasMore: result.list.length >= PAGE_SIZE,
        loading: false,
      });
    } catch (error) {
      this.setData({ loading: false });
      showError(error);
    }
  },

  /** 上拉加载。 */
  async loadMore() {
    if (!this.data.hasMore || this.data.loading) {
      return;
    }
    const next = this.data.page + 1;
    try {
      const result = await fetchNotices(next, PAGE_SIZE);
      this.setData({
        items: this.data.items.concat(result.list.map((item) => this.toView(item))),
        page: next,
        hasMore: result.list.length >= PAGE_SIZE,
      });
    } catch (error) {
      showError(error);
    }
  },

  /** 转视图模型。 */
  toView(item: ClientNoticeItem): NoticeView {
    const raw = item.publishedAt || item.createdAt;
    return {
      id: item.id,
      title: item.title,
      content: item.content,
      typeText: TYPE_TEXT[item.noticeType] ?? '通知',
      time: raw ? raw.slice(0, 16).replace('T', ' ') : '',
      unread: item.isRead === 0,
      pinned: item.pinned === 1,
    };
  },

  /** 展开 / 收起，并顺手标记已读。 */
  onOpen(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index as string);
    const notice = this.data.items[index];
    if (!notice) {
      return;
    }
    if (this.data.expandedId === notice.id) {
      this.setData({ expandedId: 0 });
      return;
    }
    this.setData({ expandedId: notice.id });
    if (notice.unread) {
      const items = this.data.items.slice();
      items[index] = { ...notice, unread: false };
      this.setData({ items, unread: Math.max(0, this.data.unread - 1) });
      markNoticeRead(notice.id).catch(() => {
        // 标记失败不回滚 UI：下次刷新会以服务端为准
      });
    }
  },

  /** 全部已读。 */
  async onReadAll() {
    try {
      await markAllNoticesRead();
      const items = this.data.items.map((item) => ({ ...item, unread: false }));
      this.setData({ items, unread: 0 });
      toastSuccess('已全部标记为已读');
    } catch (error) {
      showError(error);
    }
  },
});
