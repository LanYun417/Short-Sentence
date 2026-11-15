/**
 * 本周学习报告：答题 / 正确率 / 活跃天数 / 每日明细 / 与上周对比。
 */
import { fetchWeeklyReport } from '../../services/learn';
import type { WeeklyReport } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { showError } from '../../utils/feedback';
import { percentText } from '../../utils/format';
import { goLogin } from '../../utils/nav';

/** 每日柱状图的视图模型。 */
interface DayBar {
  weekday: string;
  date: string;
  answered: number;
  percent: number;
}

interface WeeklyData {
  report: WeeklyReport | null;
  days: DayBar[];
  accuracyText: string;
  deltaText: string;
  deltaDown: boolean;
  loading: boolean;
}

interface WeeklyCustom {
  refresh(): Promise<void>;
}

Page<WeeklyData, WeeklyCustom>({
  data: {
    report: null,
    days: [],
    accuracyText: '—',
    deltaText: '',
    deltaDown: false,
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

  /** 拉周报。 */
  async refresh() {
    try {
      const report = await fetchWeeklyReport();
      const max = Math.max(1, ...report.daily.map((day) => day.answered));
      const days: DayBar[] = report.daily.map((day) => ({
        weekday: day.weekday,
        date: day.date,
        answered: day.answered,
        percent: Math.round((day.answered / max) * 100),
      }));
      const delta = report.deltaAnswered;
      this.setData({
        report,
        days,
        accuracyText: report.answered > 0 ? percentText(report.accuracy) : '—',
        deltaText: delta === 0 ? '与上周持平' : `${delta > 0 ? '比上周多' : '比上周少'} ${Math.abs(delta)} 题`,
        deltaDown: delta < 0,
        loading: false,
      });
    } catch (error) {
      this.setData({ loading: false });
      showError(error);
    }
  },
});
