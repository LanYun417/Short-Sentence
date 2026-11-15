/**
 * 投稿：精选 / 我的投稿 / 提交。
 */
import { createSubmission, fetchFeaturedSubmissions, fetchMySubmissions } from '../../services/community';
import type { SubmissionFeatured, SubmissionMine } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { showError, toast, toastSuccess } from '../../utils/feedback';
import { goLogin } from '../../utils/nav';

/** 状态文案。 */
const STATUS_TEXT: Record<string, string> = { pending: '审核中', approved: '已通过', rejected: '未通过' };

/** 精选视图模型。 */
interface FeaturedView {
  id: number;
  en: string;
  zh: string;
  note: string;
  author: string;
}

/** 我的投稿视图模型。 */
interface MineView {
  id: number;
  en: string;
  zh: string;
  statusText: string;
  status: string;
  reviewNote: string;
  time: string;
}

interface SubmissionData {
  tab: 'featured' | 'mine' | 'create';
  featured: FeaturedView[];
  mine: MineView[];
  sentenceEn: string;
  translationZh: string;
  note: string;
  loading: boolean;
  submitting: boolean;
}

interface SubmissionCustom {
  refresh(): Promise<void>;
  onSwitchTab(event: WechatMiniprogram.TouchEvent): void;
  onEn(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onZh(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onNote(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onSubmit(): Promise<void>;
}

Page<SubmissionData, SubmissionCustom>({
  data: {
    tab: 'featured',
    featured: [],
    mine: [],
    sentenceEn: '',
    translationZh: '',
    note: '',
    loading: true,
    submitting: false,
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

  /** 拉精选 + 我的。 */
  async refresh() {
    try {
      const [featured, mine] = await Promise.all([
        fetchFeaturedSubmissions(1, 20).catch(() => ({ list: [], total: 0, page: 1, pageSize: 20 })),
        fetchMySubmissions(1, 20).catch(() => ({ list: [], total: 0, page: 1, pageSize: 20 })),
      ]);
      this.setData({
        featured: featured.list.map((item: SubmissionFeatured) => ({
          id: item.id,
          en: item.sentenceEn,
          zh: item.translationZh,
          note: item.note ?? '',
          author: item.author,
        })),
        mine: mine.list.map((item: SubmissionMine) => ({
          id: item.id,
          en: item.sentenceEn,
          zh: item.translationZh,
          statusText: STATUS_TEXT[item.status] ?? item.status,
          status: item.status,
          reviewNote: item.reviewNote ?? '',
          time: item.createdAt ? item.createdAt.slice(0, 10) : '',
        })),
        loading: false,
      });
    } catch (error) {
      this.setData({ loading: false });
      showError(error);
    }
  },

  /** 切 tab。 */
  onSwitchTab(event: WechatMiniprogram.TouchEvent) {
    const tab = event.currentTarget.dataset.tab;
    if (tab !== 'featured' && tab !== 'mine' && tab !== 'create') {
      return;
    }
    this.setData({ tab });
  },

  /** 英文输入。 */
  onEn(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ sentenceEn: event.detail.value });
  },

  /** 中文输入。 */
  onZh(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ translationZh: event.detail.value });
  },

  /** 附言输入。 */
  onNote(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ note: event.detail.value });
  },

  /** 提交投稿。 */
  async onSubmit() {
    const en = this.data.sentenceEn.trim();
    const zh = this.data.translationZh.trim();
    if (!en || !zh) {
      toast('英文句子和中文译文都要填');
      return;
    }
    if (this.data.submitting) {
      return;
    }
    this.setData({ submitting: true });
    try {
      await createSubmission(en, zh, this.data.note);
      this.setData({ submitting: false, sentenceEn: '', translationZh: '', note: '' });
      toastSuccess('已提交，审核通过后会出现在精选');
      await this.refresh();
      this.setData({ tab: 'mine' });
    } catch (error) {
      this.setData({ submitting: false });
      showError(error);
    }
  },
});
