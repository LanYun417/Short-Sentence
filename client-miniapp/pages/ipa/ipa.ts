/**
 * 音标学习：分组浏览 + 标记「学会了」（首次发 XP）。
 */
import { fetchIpaPhonemes, fetchIpaProgress, markIpaLearned } from '../../services/learn';
import type { IpaPhoneme, IpaPhonemeGroup } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { showError, toastSuccess } from '../../utils/feedback';
import { goLogin } from '../../utils/nav';

interface IpaData {
  groups: IpaPhonemeGroup[];
  learned: Record<string, boolean>;
  learnedCount: number;
  total: number;
  percent: number;
  loading: boolean;
  detail: IpaPhoneme | null;
  detailLearned: boolean;
}

interface IpaCustom {
  refresh(): Promise<void>;
  onOpenPhoneme(event: WechatMiniprogram.TouchEvent): void;
  onCloseDetail(): void;
  onTapSheet(): void;
  onLearn(): Promise<void>;
}

Page<IpaData, IpaCustom>({
  data: {
    groups: [],
    learned: {},
    learnedCount: 0,
    total: 0,
    percent: 0,
    loading: true,
    detail: null,
    detailLearned: false,
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

  /** 拉音标库 + 进度。 */
  async refresh() {
    try {
      const [phonemes, progress] = await Promise.all([fetchIpaPhonemes(), fetchIpaProgress()]);
      const learned: Record<string, boolean> = {};
      progress.items.forEach((item) => {
        learned[item.symbol] = item.learned;
      });
      const total = phonemes.total || 0;
      this.setData({
        groups: phonemes.groups,
        learned,
        learnedCount: progress.learnedCount,
        total,
        percent: total > 0 ? Math.round((progress.learnedCount / total) * 100) : 0,
        loading: false,
      });
    } catch (error) {
      this.setData({ loading: false });
      showError(error);
    }
  },

  /** 点开某个音标。 */
  onOpenPhoneme(event: WechatMiniprogram.TouchEvent) {
    const groupIndex = Number(event.currentTarget.dataset.group as string);
    const index = Number(event.currentTarget.dataset.index as string);
    const group = this.data.groups[groupIndex];
    const phoneme = group?.items[index];
    if (!phoneme) {
      return;
    }
    this.setData({ detail: phoneme, detailLearned: Boolean(this.data.learned[phoneme.symbol]) });
  },

  /** 关闭。 */
  onCloseDetail() {
    this.setData({ detail: null });
  },

  /** 阻止冒泡。 */
  onTapSheet() {
    // 故意留空：catchtap 只用于吞掉冒泡
  },

  /** 标记学会。 */
  async onLearn() {
    const detail = this.data.detail;
    if (!detail || this.data.detailLearned) {
      return;
    }
    try {
      const result = await markIpaLearned(detail.symbol);
      const learned = { ...this.data.learned, [detail.symbol]: true };
      const total = this.data.total || 0;
      this.setData({
        learned,
        learnedCount: result.learnedCount,
        percent: total > 0 ? Math.round((result.learnedCount / total) * 100) : 0,
        detailLearned: true,
      });
      toastSuccess(result.xpAwarded ? `学会了 +XP` : '已标记为学会');
    } catch (error) {
      showError(error);
    }
  },
});
