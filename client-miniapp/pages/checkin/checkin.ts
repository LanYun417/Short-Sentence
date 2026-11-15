/**
 * 每日打卡：今日进度 + 打卡 + 分享卡片。
 *
 * 说明：作答本身会 upsert 今日打卡行，`POST /client/checkin` 是幂等的
 * 「确认打卡」动作（返回同样的进度）。小程序侧不生成 PNG 长图
 * （那需要 canvas 2D + 相册权限），改为原生分享卡片。
 */
import { fetchTodayCheckin, submitCheckin } from '../../services/checkin';
import type { TodayCheckin } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { showError, toastSuccess } from '../../utils/feedback';
import { goLogin, goPractice } from '../../utils/nav';

const EMPTY: TodayCheckin = { date: '', doneCount: 0, goalCount: 0, streak: 0, completed: false };

interface CheckinData {
  checkin: TodayCheckin;
  percent: number;
  remaining: number;
  loading: boolean;
  submitting: boolean;
}

interface CheckinCustom {
  refresh(): Promise<void>;
  onCheckin(): Promise<void>;
  onGoPractice(): void;
}

Page<CheckinData, CheckinCustom>({
  data: {
    checkin: EMPTY,
    percent: 0,
    remaining: 0,
    loading: true,
    submitting: false,
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

  /** 读今日进度。 */
  async refresh() {
    try {
      const checkin = await fetchTodayCheckin();
      const goal = checkin.goalCount || 0;
      this.setData({
        checkin,
        percent: goal > 0 ? Math.max(0, Math.min(100, Math.round((checkin.doneCount / goal) * 100))) : 0,
        remaining: Math.max(0, goal - checkin.doneCount),
        loading: false,
      });
    } catch (error) {
      this.setData({ loading: false });
      showError(error);
    }
  },

  /** 打卡（幂等）。 */
  async onCheckin() {
    if (this.data.submitting) {
      return;
    }
    this.setData({ submitting: true });
    try {
      const checkin = await submitCheckin();
      const goal = checkin.goalCount || 0;
      this.setData({
        checkin,
        percent: goal > 0 ? Math.max(0, Math.min(100, Math.round((checkin.doneCount / goal) * 100))) : 0,
        remaining: Math.max(0, goal - checkin.doneCount),
        submitting: false,
      });
      toastSuccess('打卡成功');
    } catch (error) {
      this.setData({ submitting: false });
      showError(error);
    }
  },

  /** 去刷题。 */
  onGoPractice() {
    goPractice();
  },

  /** 分享卡片。 */
  onShareAppMessage() {
    return {
      title: `我已经连续打卡 ${this.data.checkin.streak} 天，一起来学英语短句`,
      path: '/pages/index/index',
    };
  },
});
