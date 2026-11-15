/**
 * 接龙详情：看续写 / 点赞 / 举报 / 提交自己的续写。
 *
 * 内容有 UGC 三闸（入库校验、每天 3 条 + 去重、举报累计自动隐藏），
 * 提交响应里的 status 会告诉前端是否「已展示 / 待人工 / 未通过」。
 */
import { createChainEntry, fetchChainDetail, likeChainEntry, reportChainEntry } from '../../../services/community';
import type { ChainEntry, ChainTopic } from '../../../services/types';
import { isLoggedIn, sessionReady } from '../../../utils/auth';
import { showError, toast, toastSuccess } from '../../../utils/feedback';
import { goLogin } from '../../../utils/nav';

/** 主题（详情页用到的字段）。 */
interface TopicView {
  id: number;
  title: string;
  starterEn: string;
  promptZh: string;
}

interface DetailData {
  topic: TopicView | null;
  entries: ChainEntry[];
  remainingToday: number;
  dailyLimit: number;
  content: string;
  submitting: boolean;
  loading: boolean;
}

interface DetailCustom {
  topicId: number;
  refresh(): Promise<void>;
  onInput(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onSubmit(): Promise<void>;
  onLike(event: WechatMiniprogram.TouchEvent): Promise<void>;
  onReport(event: WechatMiniprogram.TouchEvent): void;
}

Page<DetailData, DetailCustom>({
  data: {
    topic: null,
    entries: [],
    remainingToday: 0,
    dailyLimit: 3,
    content: '',
    submitting: false,
    loading: true,
  },

  topicId: 0,

  async onLoad(options: Record<string, string | undefined>) {
    this.topicId = Number(options.id ?? 0);
    await sessionReady();
    if (!isLoggedIn()) {
      goLogin();
      return;
    }
    if (!this.topicId) {
      this.setData({ loading: false });
      return;
    }
    await this.refresh();
  },

  onPullDownRefresh() {
    void this.refresh().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /** 拉详情。 */
  async refresh() {
    try {
      const detail = await fetchChainDetail(this.topicId);
      const topic: ChainTopic = detail.topic;
      this.setData({
        topic: {
          id: topic.id,
          title: topic.title,
          starterEn: topic.starterEn,
          promptZh: topic.promptZh,
        },
        entries: detail.entries,
        remainingToday: detail.remainingToday,
        dailyLimit: detail.dailyLimit,
        loading: false,
      });
    } catch (error) {
      this.setData({ loading: false });
      showError(error);
    }
  },

  /** 输入。 */
  onInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ content: event.detail.value });
  },

  /** 提交续写。 */
  async onSubmit() {
    const content = this.data.content.trim();
    if (!content) {
      toast('先写一句吧');
      return;
    }
    if (this.data.remainingToday <= 0) {
      toast('今天的接龙次数用完了');
      return;
    }
    if (this.data.submitting) {
      return;
    }
    this.setData({ submitting: true });
    try {
      const created = await createChainEntry(this.topicId, content, '');
      this.setData({ submitting: false, content: '' });
      if (created.status === 'rejected') {
        toast(created.moderationNote || '内容未通过审核，换个说法试试');
        return;
      }
      if (created.status === 'pending') {
        toast('已提交，等待人工审核');
      } else {
        toastSuccess('已接上');
      }
      await this.refresh();
    } catch (error) {
      this.setData({ submitting: false });
      showError(error);
    }
  },

  /** 点赞 / 取消。 */
  async onLike(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index as string);
    const entry = this.data.entries[index];
    if (!entry) {
      return;
    }
    try {
      const result = await likeChainEntry(entry.id);
      const entries = this.data.entries.slice();
      entries[index] = { ...entry, liked: result.liked, likeCount: result.likeCount };
      this.setData({ entries });
    } catch (error) {
      showError(error);
    }
  },

  /** 举报（弹窗填原因）。 */
  onReport(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index as string);
    const entry = this.data.entries[index];
    if (!entry) {
      return;
    }
    wx.showModal({
      title: '举报这条内容',
      editable: true,
      placeholderText: '写下举报原因（如抄袭、不适内容）',
      confirmText: '提交',
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        const reason = (res.content ?? '').trim() || '用户举报';
        void reportChainEntry(entry.id, reason)
          .then(() => {
            toastSuccess('已收到举报，我们会尽快核实');
          })
          .catch((error: unknown) => {
            showError(error);
          });
      },
    });
  },
});
