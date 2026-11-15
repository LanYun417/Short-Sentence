/**
 * 闯关地图：场景列表 + 推荐关卡 + 可领取奖励。
 */
import { fetchStageOverview } from '../../../services/stage';
import type { StageOverview } from '../../../services/types';
import { isLoggedIn, sessionReady } from '../../../utils/auth';
import { showError } from '../../../utils/feedback';
import { absoluteUrl } from '../../../utils/format';
import { goLogin } from '../../../utils/nav';

/** 场景卡视图模型。 */
interface SceneCard {
  id: number;
  name: string;
  nameEn: string;
  coverUrl: string;
  initial: string;
  percent: number;
  clearedCount: number;
  stageCount: number;
  scriptCount: number;
  done: boolean;
}

interface MapData {
  scenes: SceneCard[];
  clearedStages: number;
  totalStages: number;
  claimable: number;
  recommendedId: number;
  percent: number;
  loading: boolean;
  empty: boolean;
}

interface MapCustom {
  refresh(): Promise<void>;
  onOpenScene(event: WechatMiniprogram.TouchEvent): void;
  onContinue(): void;
}

Page<MapData, MapCustom>({
  data: {
    scenes: [],
    clearedStages: 0,
    totalStages: 0,
    claimable: 0,
    recommendedId: 0,
    percent: 0,
    loading: true,
    empty: false,
  },

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

  /** 拉取地图。 */
  async refresh() {
    try {
      const overview: StageOverview = await fetchStageOverview();
      const scenes: SceneCard[] = overview.scenes.map((scene) => ({
        id: scene.id,
        name: scene.name,
        nameEn: scene.nameEn ?? '',
        coverUrl: absoluteUrl(scene.coverUrl),
        initial: scene.name ? scene.name.charAt(0) : '关',
        percent: scene.stageCount > 0 ? Math.round((scene.clearedCount / scene.stageCount) * 100) : 0,
        clearedCount: scene.clearedCount,
        stageCount: scene.stageCount,
        scriptCount: scene.scriptCount,
        done: scene.stageCount > 0 && scene.clearedCount >= scene.stageCount,
      }));
      const total = overview.totalStages || 0;
      this.setData({
        scenes,
        clearedStages: overview.clearedStages,
        totalStages: total,
        claimable: overview.claimable,
        recommendedId: overview.recommendedId ?? 0,
        percent: total > 0 ? Math.max(0, Math.min(100, Math.round((overview.clearedStages / total) * 100))) : 0,
        loading: false,
        empty: scenes.length === 0,
      });
    } catch (error) {
      this.setData({ loading: false, empty: true });
      showError(error);
    }
  },

  /** 进场景。 */
  onOpenScene(event: WechatMiniprogram.TouchEvent) {
    const id = Number(event.currentTarget.dataset.id as string);
    if (!id) {
      return;
    }
    wx.navigateTo({ url: `/pages/stages/scene/scene?id=${id}` });
  },

  /** 继续闯关（跳到推荐关卡）。 */
  onContinue() {
    if (!this.data.recommendedId) {
      return;
    }
    wx.navigateTo({ url: `/pages/stages/dialogue/dialogue?id=${this.data.recommendedId}` });
  },
});
