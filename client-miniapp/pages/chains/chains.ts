/**
 * 句子接龙：主题列表（每周一个话题，点进去续写）。
 */
import { fetchChainTopics } from '../../services/community';
import type { ChainTopic } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { showError } from '../../utils/feedback';
import { goLogin } from '../../utils/nav';

interface ChainsData {
  topics: ChainTopic[];
  loading: boolean;
}

interface ChainsCustom {
  refresh(): Promise<void>;
  onOpen(event: WechatMiniprogram.TouchEvent): void;
}

Page<ChainsData, ChainsCustom>({
  data: {
    topics: [],
    loading: true,
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

  /** 拉主题列表。 */
  async refresh() {
    try {
      const topics = await fetchChainTopics();
      this.setData({ topics, loading: false });
    } catch (error) {
      this.setData({ loading: false });
      showError(error);
    }
  },

  /** 进主题。 */
  onOpen(event: WechatMiniprogram.TouchEvent) {
    const id = Number(event.currentTarget.dataset.id as string);
    if (!id) {
      return;
    }
    wx.navigateTo({ url: `/pages/chains/detail/detail?id=${id}` });
  },
});
