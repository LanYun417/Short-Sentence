/**
 * 场景详情：该场景下的剧本列表（场景 → 剧本 → 关卡 的第二层）。
 */
import { fetchStageScene } from '../../../services/stage';
import { isLoggedIn, sessionReady } from '../../../utils/auth';
import { showError } from '../../../utils/feedback';
import { absoluteUrl } from '../../../utils/format';
import { goLogin } from '../../../utils/nav';

/** 剧本卡视图模型。 */
interface ScriptCard {
  id: number;
  name: string;
  blurb: string;
  coverUrl: string;
  initial: string;
  percent: number;
  clearedCount: number;
  stageCount: number;
  completed: boolean;
}

interface SceneData {
  sceneId: number;
  sceneName: string;
  sceneEn: string;
  clearedCount: number;
  stageCount: number;
  scripts: ScriptCard[];
  loading: boolean;
  empty: boolean;
}

interface SceneCustom {
  sceneId: number;
  refresh(): Promise<void>;
  onOpenScript(event: WechatMiniprogram.TouchEvent): void;
}

Page<SceneData, SceneCustom>({
  data: {
    sceneId: 0,
    sceneName: '',
    sceneEn: '',
    clearedCount: 0,
    stageCount: 0,
    scripts: [],
    loading: true,
    empty: false,
  },

  sceneId: 0,

  async onLoad(options: Record<string, string | undefined>) {
    this.sceneId = Number(options.id ?? 0);
    await sessionReady();
    if (!isLoggedIn()) {
      goLogin();
      return;
    }
    if (!this.sceneId) {
      this.setData({ loading: false, empty: true });
      return;
    }
    await this.refresh();
  },

  /** 拉取场景下的剧本。 */
  async refresh() {
    try {
      const detail = await fetchStageScene(this.sceneId);
      const scripts: ScriptCard[] = detail.scripts.map((script) => ({
        id: script.id,
        name: script.name,
        blurb: script.blurb,
        coverUrl: absoluteUrl(script.coverUrl),
        initial: script.name ? script.name.charAt(0) : '剧',
        percent: script.stageCount > 0 ? Math.round((script.clearedCount / script.stageCount) * 100) : 0,
        clearedCount: script.clearedCount,
        stageCount: script.stageCount,
        completed: script.completed,
      }));
      this.setData({
        sceneId: detail.scene.id,
        sceneName: detail.scene.name,
        sceneEn: detail.scene.nameEn ?? '',
        clearedCount: detail.scene.clearedCount,
        stageCount: detail.scene.stageCount,
        scripts,
        loading: false,
        empty: scripts.length === 0,
      });
      wx.setNavigationBarTitle({ title: detail.scene.name || '场景' });
    } catch (error) {
      this.setData({ loading: false, empty: true });
      showError(error);
    }
  },

  /** 进剧本。 */
  onOpenScript(event: WechatMiniprogram.TouchEvent) {
    const id = Number(event.currentTarget.dataset.id as string);
    if (!id) {
      return;
    }
    wx.navigateTo({ url: `/pages/stages/script/script?id=${id}` });
  },
});
