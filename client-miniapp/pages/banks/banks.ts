/**
 * 题库：按场景 / 按节日进入专项刷题。
 *
 * 选了范围后直接进刷题页，把 categoryId / festival 透传过去，
 * 由后端在抽题时限定范围（与 Web 端「题库」入口同一套参数）。
 */
import { fetchCategoryBanks, fetchFestivalBanks } from '../../services/learn';
import type { CategoryBank, FestivalBank } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { showError } from '../../utils/feedback';
import { absoluteUrl } from '../../utils/format';
import { goLogin } from '../../utils/nav';

interface BanksData {
  tab: 'scene' | 'festival';
  scenes: CategoryBank[];
  festivals: FestivalBank[];
  loading: boolean;
}

interface BanksCustom {
  festivalCover: Record<string, string>;
  refresh(): Promise<void>;
  onSwitchTab(event: WechatMiniprogram.TouchEvent): void;
  onPickScene(event: WechatMiniprogram.TouchEvent): void;
  onPickFestival(event: WechatMiniprogram.TouchEvent): void;
}

Page<BanksData, BanksCustom>({
  data: {
    tab: 'scene',
    scenes: [],
    festivals: [],
    loading: true,
  },

  festivalCover: {},

  async onShow() {
    await sessionReady();
    if (!isLoggedIn()) {
      goLogin();
      return;
    }
    void this.refresh();
  },

  onPullDownRefresh() {
    void this.refresh().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /** 并行拉场景与节日题库。 */
  async refresh() {
    try {
      const [scenes, festivals] = await Promise.all([
        fetchCategoryBanks().catch(() => []),
        fetchFestivalBanks().catch(() => []),
      ]);
      const cover: Record<string, string> = {};
      festivals.forEach((item) => {
        cover[item.name] = absoluteUrl(item.coverUrl);
      });
      this.festivalCover = cover;
      this.setData({ scenes, festivals, loading: false });
    } catch (error) {
      this.setData({ loading: false });
      showError(error);
    }
  },

  /** 切 tab。 */
  onSwitchTab(event: WechatMiniprogram.TouchEvent) {
    const tab = event.currentTarget.dataset.tab;
    if (tab !== 'scene' && tab !== 'festival') {
      return;
    }
    this.setData({ tab });
  },

  /** 按场景刷。 */
  onPickScene(event: WechatMiniprogram.TouchEvent) {
    const id = Number(event.currentTarget.dataset.id as string);
    if (!id) {
      return;
    }
    wx.navigateTo({ url: `/pages/practice/practice?categoryId=${id}` });
  },

  /** 按节日刷。 */
  onPickFestival(event: WechatMiniprogram.TouchEvent) {
    const name = String(event.currentTarget.dataset.name ?? '');
    if (!name) {
      return;
    }
    wx.navigateTo({ url: `/pages/practice/practice?festival=${encodeURIComponent(name)}` });
  },
});
