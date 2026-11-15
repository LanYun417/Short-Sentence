/**
 * 首页（练习页）：今日进度 + 难度选择 + 进入刷题。
 */
import { fetchTodayCheckin } from '../../services/checkin';
import type { ClientUserProfile, TodayCheckin } from '../../services/types';
import { fetchProfile, isLoggedIn, sessionReady } from '../../utils/auth';
import { showError } from '../../utils/feedback';
import { absoluteUrl, initialOf } from '../../utils/format';
import { goLogin, goPractice, goStages, switchTab } from '../../utils/nav';
import { getCachedUser, getDifficulty, setDifficulty } from '../../utils/storage';

/** 难度档位（与后端 Sentence.difficulty 对齐）。 */
const DIFFICULTIES = [
  { value: 1, label: '基础', desc: '短句 · 高频词' },
  { value: 2, label: '进阶', desc: '日常表达' },
  { value: 3, label: '挑战', desc: '长句 · 语法点' },
];

/** 零值进度（避免 WXML 里访问 null 的属性）。 */
const EMPTY_CHECKIN: TodayCheckin = { date: '', doneCount: 0, goalCount: 0, streak: 0, completed: false };

/** 按当前时段给问候语。 */
function greetingText(): string {
  const hour = new Date().getHours();
  if (hour < 6) {
    return '夜深了';
  }
  if (hour < 11) {
    return '早上好';
  }
  if (hour < 14) {
    return '中午好';
  }
  if (hour < 18) {
    return '下午好';
  }
  return '晚上好';
}

interface IndexData {
  user: ClientUserProfile | null;
  checkin: TodayCheckin;
  difficulty: number;
  difficulties: typeof DIFFICULTIES;
  greeting: string;
  avatarUrl: string;
  initial: string;
  percent: number;
  tip: string;
  loading: boolean;
}

interface IndexCustom {
  applyUser(user: ClientUserProfile | null): void;
  refresh(): Promise<void>;
  onPickDifficulty(event: WechatMiniprogram.TouchEvent): void;
  onStart(): void;
  onReview(): void;
  onOpenStages(): void;
  onOpenBanks(): void;
  onOpenBoss(): void;
  onTapProfile(): void;
}

Page<IndexData, IndexCustom>({
  data: {
    user: null,
    checkin: EMPTY_CHECKIN,
    difficulty: getDifficulty(),
    difficulties: DIFFICULTIES,
    greeting: '你好',
    avatarUrl: '',
    initial: '',
    percent: 0,
    tip: '每天答几题，句子自然记住',
    loading: true,
  },

  onLoad() {
    this.setData({ greeting: greetingText() });
  },

  async onShow() {
    await sessionReady();
    if (!isLoggedIn()) {
      goLogin();
      return;
    }
    this.applyUser(getCachedUser());
    this.setData({ difficulty: getDifficulty() });
    void this.refresh();
  },

  onPullDownRefresh() {
    void this.refresh().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /** 把用户资料写进视图。 */
  applyUser(user: ClientUserProfile | null) {
    this.setData({
      user,
      avatarUrl: absoluteUrl(user?.avatarUrl ?? null),
      initial: initialOf(user?.nickname ?? ''),
    });
  },

  /** 拉取今日进度与最新资料。 */
  async refresh() {
    try {
      const [checkin, user] = await Promise.all([fetchTodayCheckin(), fetchProfile().catch(() => null)]);
      const goal = checkin.goalCount || 0;
      const percent = goal > 0 ? Math.max(0, Math.min(100, Math.round((checkin.doneCount / goal) * 100))) : 0;
      this.setData({
        checkin,
        percent,
        loading: false,
        tip: checkin.completed
          ? '今日目标已达成，明天继续保持'
          : goal > 0
            ? `再答 ${goal - checkin.doneCount} 题完成今日目标`
            : '每天答几题，句子自然记住',
      });
      if (user) {
        this.applyUser(user);
      }
    } catch (error) {
      this.setData({ loading: false });
      showError(error);
    }
  },

  /** 切换难度（记住偏好，下次抽题生效）。 */
  onPickDifficulty(event: WechatMiniprogram.TouchEvent) {
    const value = Number(event.currentTarget.dataset.value as string);
    if (!value || value === this.data.difficulty) {
      return;
    }
    setDifficulty(value);
    this.setData({ difficulty: value });
  },

  /** 开始练习。 */
  onStart() {
    goPractice();
  },

  /** 只刷错题/到期的复习题。 */
  onReview() {
    goPractice('?source=review');
  },

  /** 进情景闯关。 */
  onOpenStages() {
    goStages();
  },

  /** 进题库（按场景 / 节日）。 */
  onOpenBanks() {
    wx.navigateTo({ url: '/pages/banks/banks' });
  },

  /** 进每日 Boss。 */
  onOpenBoss() {
    wx.navigateTo({ url: '/pages/boss/boss' });
  },

  /** 点头像去「我的」。 */
  onTapProfile() {
    switchTab('/pages/profile/profile');
  },
});
