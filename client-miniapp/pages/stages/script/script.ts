/**
 * 剧本详情：该剧本下的关卡列表（含解锁/进度）。
 */
import { fetchStageScript } from '../../../services/stage';
import { isLoggedIn, sessionReady } from '../../../utils/auth';
import { showError, toast } from '../../../utils/feedback';
import { goLogin } from '../../../utils/nav';

/** 关卡条目视图模型。 */
interface StageItem {
  id: number;
  index: number;
  title: string;
  goal: string;
  rolesText: string;
  minTurns: number;
  rewardXp: number;
  cleared: boolean;
  unlocked: boolean;
  claimed: boolean;
  progress: number;
  /** 进行中（有未结束的会话） */
  active: boolean;
}

interface ScriptData {
  scriptName: string;
  blurb: string;
  sceneName: string;
  clearedCount: number;
  total: number;
  percent: number;
  stages: StageItem[];
  loading: boolean;
  empty: boolean;
}

interface ScriptCustom {
  scriptId: number;
  refresh(): Promise<void>;
  onOpenStage(event: WechatMiniprogram.TouchEvent): void;
}

Page<ScriptData, ScriptCustom>({
  data: {
    scriptName: '',
    blurb: '',
    sceneName: '',
    clearedCount: 0,
    total: 0,
    percent: 0,
    stages: [],
    loading: true,
    empty: false,
  },

  scriptId: 0,

  async onLoad(options: Record<string, string | undefined>) {
    this.scriptId = Number(options.id ?? 0);
    await sessionReady();
    if (!isLoggedIn()) {
      goLogin();
      return;
    }
    if (!this.scriptId) {
      this.setData({ loading: false, empty: true });
      return;
    }
    await this.refresh();
  },

  /** 拉取剧本下的关卡。 */
  async refresh() {
    try {
      const detail = await fetchStageScript(this.scriptId);
      const stages: StageItem[] = detail.stages.map((stage, index) => ({
        id: stage.id,
        index: index + 1,
        title: stage.title,
        goal: stage.goal,
        rolesText: stage.roles.map((role) => role.emoji).join(''),
        minTurns: stage.minTurns,
        rewardXp: stage.rewardXp,
        cleared: stage.cleared,
        unlocked: stage.unlocked,
        claimed: stage.claimed,
        progress: Math.max(0, Math.min(100, stage.progress)),
        active: stage.cleared === false && stage.activeSessionId !== null,
      }));
      const total = detail.total || 0;
      this.setData({
        scriptName: detail.script.name,
        blurb: detail.script.blurb,
        sceneName: detail.scene?.name ?? '',
        clearedCount: detail.clearedCount,
        total,
        percent: total > 0 ? Math.round((detail.clearedCount / total) * 100) : 0,
        stages,
        loading: false,
        empty: stages.length === 0,
      });
      wx.setNavigationBarTitle({ title: detail.script.name || '剧本' });
    } catch (error) {
      this.setData({ loading: false, empty: true });
      showError(error);
    }
  },

  /** 进入关卡对话。 */
  onOpenStage(event: WechatMiniprogram.TouchEvent) {
    const id = Number(event.currentTarget.dataset.id as string);
    const unlocked = event.currentTarget.dataset.unlocked === true;
    if (!id) {
      return;
    }
    if (!unlocked) {
      toast('先通过上一关才能解锁');
      return;
    }
    wx.navigateTo({ url: `/pages/stages/dialogue/dialogue?id=${id}` });
  },
});
