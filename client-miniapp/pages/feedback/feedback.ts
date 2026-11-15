/**
 * 产品反馈：提交 + 我的反馈。
 *
 * 小程序侧只支持纯文本（`wx.uploadFile` 一次只能带一个文件，后端最多 5 张图），
 * `platform` 不传（后端只接受 web / android）。
 */
import { createFeedback, fetchMyFeedback, type FeedbackType } from '../../services/community';
import type { MyFeedbackItem } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { showError, toast, toastSuccess } from '../../utils/feedback';
import { goLogin } from '../../utils/nav';

/** 反馈类型选项。 */
const TYPES: Array<{ value: FeedbackType; label: string }> = [
  { value: 'bug', label: '使用异常' },
  { value: 'feature', label: '功能建议' },
  { value: 'content', label: '内容问题' },
  { value: 'ux', label: '体验建议' },
  { value: 'other', label: '其他' },
];

/** 状态文案。 */
const STATUS_TEXT: Record<string, string> = { pending: '待处理', resolved: '已处理', dismissed: '已驳回' };

/** 我的反馈视图模型。 */
interface MineView {
  id: number;
  typeLabel: string;
  content: string;
  statusText: string;
  status: string;
  reply: string;
  time: string;
}

interface FeedbackData {
  tab: 'submit' | 'mine';
  types: typeof TYPES;
  type: FeedbackType;
  content: string;
  contact: string;
  submitting: boolean;
  mine: MineView[];
  loading: boolean;
}

interface FeedbackCustom {
  refreshMine(): Promise<void>;
  onSwitchTab(event: WechatMiniprogram.TouchEvent): void;
  onPickType(event: WechatMiniprogram.TouchEvent): void;
  onContent(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onContact(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onSubmit(): Promise<void>;
}

Page<FeedbackData, FeedbackCustom>({
  data: {
    tab: 'submit',
    types: TYPES,
    type: 'bug',
    content: '',
    contact: '',
    submitting: false,
    mine: [],
    loading: true,
  },

  async onShow() {
    await sessionReady();
    if (!isLoggedIn()) {
      goLogin();
      return;
    }
    await this.refreshMine();
  },

  onPullDownRefresh() {
    void this.refreshMine().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /** 拉我的反馈。 */
  async refreshMine() {
    try {
      const result = await fetchMyFeedback(1, 20);
      this.setData({
        mine: result.list.map((item: MyFeedbackItem) => ({
          id: item.id,
          typeLabel: TYPES.find((t) => t.value === item.type)?.label ?? item.type,
          content: item.content,
          statusText: STATUS_TEXT[item.status] ?? item.status,
          status: item.status,
          reply: item.reply ?? '',
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
    if (tab !== 'submit' && tab !== 'mine') {
      return;
    }
    this.setData({ tab });
    if (tab === 'mine') {
      void this.refreshMine();
    }
  },

  /** 选类型。 */
  onPickType(event: WechatMiniprogram.TouchEvent) {
    const value = String(event.currentTarget.dataset.value ?? '') as FeedbackType;
    if (TYPES.some((item) => item.value === value)) {
      this.setData({ type: value });
    }
  },

  /** 输入内容。 */
  onContent(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ content: event.detail.value });
  },

  /** 输入联系方式。 */
  onContact(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ contact: event.detail.value });
  },

  /** 提交。 */
  async onSubmit() {
    const content = this.data.content.trim();
    if (content.length < 5) {
      toast('请至少写 5 个字，方便我们定位问题');
      return;
    }
    if (this.data.submitting) {
      return;
    }
    this.setData({ submitting: true });
    try {
      await createFeedback(this.data.type, content, this.data.contact);
      this.setData({ submitting: false, content: '', contact: '' });
      toastSuccess('已收到反馈，感谢');
      await this.refreshMine();
      this.setData({ tab: 'mine' });
    } catch (error) {
      this.setData({ submitting: false });
      showError(error);
    }
  },
});
