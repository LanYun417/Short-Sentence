/**
 * 成长页：经验 / 等级 / 记忆巩固 / 成就 / 场景探索。
 */
import { fetchGamifyOverview } from '../../services/gamify';
import { fetchMemoryStats } from '../../services/question';
import type { GamifyAchievement, MemoryStats } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { showError } from '../../utils/feedback';
import { absoluteUrl } from '../../utils/format';
import { goLogin, goPractice } from '../../utils/nav';

/** 成就视图模型（多带一个首字，用于无图标字体时的圆形徽章）。 */
interface AchievementView extends GamifyAchievement {
  initial: string;
  /** artUrl 转绝对地址（静态资源走 API 域名，小程序没有同源概念） */
  artSrc: string;
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
  /** 记忆巩固统计（与 Web 记忆卡 / App 同一契约；拉取失败时为 null，不挡成长页其它内容） */
  memory: MemoryStats | null;
  /** 未来 30 天到期分布，已换算成百分比高度（用于纯 CSS 柱状条） */
  memoryBars: Array<{ day: number; due: number; height: number }>;
  /** 第 7 / 30 天的理论记忆保留率（百分数） */
  retain7: number;
  retain30: number;
  achievements: AchievementView[];
  scenes: SceneView[];
  loading: boolean;
}

interface GrowthCustom {
  refresh(): Promise<void>;
  /** 从记忆卡直接开刷到期复习题 */
  onStartReview(): void;
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
    memory: null,
    memoryBars: [],
    retain7: 0,
    retain30: 0,
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

  /** 拉取成长概览与记忆统计。 */
  async refresh() {
    try {
      // 记忆统计是「锦上添花」：单独失败只丢那块卡片，不能让整个成长页报错
      const [overview, memory] = await Promise.all([fetchGamifyOverview(), fetchMemoryStats().catch(() => null)]);
      const { level } = overview;
      const hasNext = level.next !== null && Boolean(level.nextName);
      const achievements: AchievementView[] = overview.achievements
        .slice()
        .sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.rewardXp - a.rewardXp)
        .map((item) => ({
          ...item,
          initial: item.name ? item.name.charAt(0) : '·',
          artSrc: absoluteUrl(item.artUrl),
        }));
      // 柱状条只吃百分比高度：按 30 天内最大值归一，空值留 6% 底线让基线不断
      const dist = memory?.distribution ?? [];
      const maxDue = Math.max(1, ...dist);
      const curve = memory?.retentionCurve ?? [];
      const retentionAt = (day: number): number => {
        const point = curve.find((c) => c.day === day);
        return point ? Math.round(point.retention * 100) : 0;
      };
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
        memory,
        memoryBars: dist.map((due, index) => ({
          day: index + 1,
          due,
          height: due > 0 ? Math.max(8, Math.round((due / maxDue) * 100)) : 6,
        })),
        retain7: retentionAt(7),
        retain30: retentionAt(30),
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

  /** 记忆卡「开始复习」：只抽到期题（与首页复习入口同一路径）。 */
  onStartReview() {
    goPractice('?source=review');
  },
});
