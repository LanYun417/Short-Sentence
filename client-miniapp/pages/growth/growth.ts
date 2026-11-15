/**
 * 成长页：经验 / 等级 / 成就 / 场景探索。
 */
import { fetchGamifyOverview } from '../../services/gamify';
import type { GamifyAchievement } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { showError } from '../../utils/feedback';
import { goLogin } from '../../utils/nav';

/** 成就视图模型（多带一个首字，用于无图标字体时的圆形徽章）。 */
interface AchievementView extends GamifyAchievement {
  initial: string;
}

/** 场景视图模型。 */
interface SceneView {
  id: number;
  name: string;
  unlocked: boolean;
  practicedCount: number;
}

interface GrowthData {
  xpText: string;
  levelName: string;
  levelPercent: number;
  levelTip: string;
  unlockedAchievements: number;
  totalAchievements: number;
  /** 成就完成度（0-100，用于成就区顶部的进度条） */
  achPercent: number;
  unlockedScenes: number;
  totalScenes: number;
  achievements: AchievementView[];
  scenes: SceneView[];
  loading: boolean;
}

interface GrowthCustom {
  refresh(): Promise<void>;
}

Page<GrowthData, GrowthCustom>({
  data: {
    xpText: '0',
    levelName: '',
    levelPercent: 0,
    levelTip: '',
    unlockedAchievements: 0,
    totalAchievements: 0,
    achPercent: 0,
    unlockedScenes: 0,
    totalScenes: 0,
    achievements: [],
    scenes: [],
    loading: true,
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

  /** 拉取成长概览。 */
  async refresh() {
    try {
      const overview = await fetchGamifyOverview();
      const { level } = overview;
      const hasNext = level.next !== null && Boolean(level.nextName);
      const achievements: AchievementView[] = overview.achievements
        .slice()
        .sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.rewardXp - a.rewardXp)
        .map((item) => ({ ...item, initial: item.name ? item.name.charAt(0) : '·' }));
      this.setData({
        xpText: String(overview.xp),
        levelName: level.name || '初学',
        // 后端 level.progress 已经是 0~100 的百分比（Web/Android 同样按 0~100 使用），
        // 这里**不能再乘 100**——曾经乘过，结果进度条永远满格
        levelPercent: Math.max(0, Math.min(100, Math.round(level.progress))),
        levelTip: hasNext ? `再获得 ${level.toNext} XP 升到 ${level.nextName}` : '已达最高等级',
        unlockedAchievements: overview.unlockedAchievements,
        totalAchievements: overview.totalAchievements,
        achPercent:
          overview.totalAchievements > 0
            ? Math.round((overview.unlockedAchievements / overview.totalAchievements) * 100)
            : 0,
        unlockedScenes: overview.unlockedScenes,
        totalScenes: overview.totalScenes,
        achievements,
        scenes: overview.sceneMap.map((item) => ({
          id: item.id,
          name: item.name,
          unlocked: item.unlocked,
          practicedCount: item.practicedCount,
        })),
        loading: false,
      });
    } catch (error) {
      this.setData({ loading: false });
      showError(error);
    }
  },
});
