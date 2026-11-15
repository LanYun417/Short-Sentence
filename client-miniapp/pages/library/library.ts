/**
 * 语句库：收藏夹 / 学习记录 / 复习池 三合一。
 *
 * 三者返回同构的 SentenceLibraryItem，只是筛选口径不同：
 * - favorites：我收藏的句子；
 * - history  ：我做过的句子（可按 全部 / 错题 / 对题 再筛）；
 * - review   ：答错且已到复习期的句子（间隔重复排期）。
 */
import { fetchFavorites, fetchHistory, fetchReview, type HistoryKind } from '../../services/library';
import type { SentenceLibraryItem } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { showError } from '../../utils/feedback';
import { goLogin, goPractice } from '../../utils/nav';

const PAGE_SIZE = 20;

/** 难度文案。 */
const DIFFICULTY_TEXT: Record<number, string> = { 1: '基础', 2: '进阶', 3: '挑战' };

/** 列表项视图模型。 */
interface ItemView {
  sentenceId: number;
  en: string;
  zh: string;
  ipa: string;
  meta: string;
  explanation: string;
  correct: boolean | null;
  userAnswer: string;
  nextReviewAt: string;
}

interface LibraryData {
  tab: 'favorites' | 'history' | 'review';
  kind: HistoryKind;
  items: ItemView[];
  page: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  detail: ItemView | null;
}

interface LibraryCustom {
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
  fetchPage(page: number): Promise<{ list: SentenceLibraryItem[]; total: number }>;
  toItem(item: SentenceLibraryItem): ItemView;
  onSwitchTab(event: WechatMiniprogram.TouchEvent): void;
  onPickKind(event: WechatMiniprogram.TouchEvent): void;
  onOpenItem(event: WechatMiniprogram.TouchEvent): void;
  onCloseDetail(): void;
  onTapSheet(): void;
  onGoPractice(): void;
}

Page<LibraryData, LibraryCustom>({
  data: {
    tab: 'favorites',
    kind: 'all',
    items: [],
    page: 1,
    total: 0,
    hasMore: false,
    loading: true,
    detail: null,
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

  /** 按当前 tab 拉第一页。 */
  async refresh() {
    this.setData({ loading: true });
    try {
      const result = await this.fetchPage(1);
      this.setData({
        items: result.list.map((item) => this.toItem(item)),
        total: result.total,
        page: 1,
        hasMore: result.list.length >= PAGE_SIZE,
        loading: false,
      });
    } catch (error) {
      this.setData({ loading: false });
      showError(error);
    }
  },

  /** 上拉加载下一页。 */
  async loadMore() {
    if (!this.data.hasMore || this.data.loading) {
      return;
    }
    const next = this.data.page + 1;
    try {
      const result = await this.fetchPage(next);
      this.setData({
        items: this.data.items.concat(result.list.map((item) => this.toItem(item))),
        page: next,
        hasMore: result.list.length >= PAGE_SIZE,
      });
    } catch (error) {
      showError(error);
    }
  },

  /** 按 tab 分派接口。 */
  async fetchPage(page: number) {
    const query = { page, pageSize: PAGE_SIZE };
    if (this.data.tab === 'favorites') {
      return fetchFavorites(query);
    }
    if (this.data.tab === 'history') {
      return fetchHistory(this.data.kind, query);
    }
    return fetchReview(query);
  },

  /** 转视图模型。 */
  toItem(item: SentenceLibraryItem): ItemView {
    const meta = [item.categoryName, DIFFICULTY_TEXT[item.difficulty]].filter(Boolean).join(' · ');
    return {
      sentenceId: item.sentenceId,
      en: item.sentenceEn,
      zh: item.translationZh,
      ipa: item.ipa ?? '',
      meta,
      explanation: item.explanation ?? '',
      correct: typeof item.isCorrect === 'boolean' ? item.isCorrect : null,
      userAnswer: item.userAnswer ?? '',
      nextReviewAt: item.nextReviewAt ?? '',
    };
  },

  /** 切 tab。 */
  onSwitchTab(event: WechatMiniprogram.TouchEvent) {
    const tab = event.currentTarget.dataset.tab;
    if (tab !== 'favorites' && tab !== 'history' && tab !== 'review') {
      return;
    }
    if (tab === this.data.tab) {
      return;
    }
    this.setData({ tab, items: [], detail: null });
    void this.refresh();
  },

  /** 历史子筛选。 */
  onPickKind(event: WechatMiniprogram.TouchEvent) {
    const kind = event.currentTarget.dataset.kind;
    if (kind !== 'all' && kind !== 'wrong' && kind !== 'right') {
      return;
    }
    if (kind === this.data.kind) {
      return;
    }
    this.setData({ kind, items: [] });
    void this.refresh();
  },

  /** 打开详情。 */
  onOpenItem(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index as string);
    const item = this.data.items[index];
    if (item) {
      this.setData({ detail: item });
    }
  },

  /** 关闭详情。 */
  onCloseDetail() {
    this.setData({ detail: null });
  },

  /** 阻止弹层内点击冒泡到遮罩（否则点正文就关了）。 */
  onTapSheet() {
    // 故意留空：catchtap 只用于吞掉冒泡
  },

  /** 去刷几题（空态引导）。 */
  onGoPractice() {
    goPractice();
  },
});
