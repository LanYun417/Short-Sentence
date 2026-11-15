/**
 * AI 私教：薄弱点画像 + 今日复习计划（纯计算、始终可用）+ 可选 AI 点评（失败自动降级）。
 */
import { fetchCoachProfile, requestCoachAdvice } from '../../services/learn';
import type { CoachProfile } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { showError } from '../../utils/feedback';
import { percentText } from '../../utils/format';
import { goLogin, goPractice } from '../../utils/nav';

/** 弱项视图模型。 */
interface WeakView {
  name: string;
  total: number;
  accuracyText: string;
  percent: number;
}

interface CoachData {
  profile: CoachProfile | null;
  weak: WeakView[];
  accuracyText: string;
  advice: string;
  adviceSource: string;
  advising: boolean;
  loading: boolean;
}

interface CoachCustom {
  refresh(): Promise<void>;
  onAdvice(): Promise<void>;
  onGoPractice(): void;
  onReviewWrong(): void;
}

Page<CoachData, CoachCustom>({
  data: {
    profile: null,
    weak: [],
    accuracyText: '—',
    advice: '',
    adviceSource: '',
    advising: false,
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

  /** 拉画像。 */
  async refresh() {
    try {
      const profile = await fetchCoachProfile();
      this.setData({
        profile,
        accuracyText: profile.totalAnswers > 0 ? percentText(profile.accuracy) : '—',
        weak: profile.weakCategories.map((item) => ({
          name: item.name,
          total: item.total,
          accuracyText: percentText(item.accuracy),
          percent: Math.round(item.accuracy * 100),
        })),
        loading: false,
      });
    } catch (error) {
      this.setData({ loading: false });
      showError(error);
    }
  },

  /** 生成 AI 点评（不可用时后端自动降级为规则文案）。 */
  async onAdvice() {
    if (this.data.advising) {
      return;
    }
    this.setData({ advising: true });
    try {
      const advice = await requestCoachAdvice();
      this.setData({
        advice: advice.text,
        adviceSource: advice.source === 'ai' ? 'AI 生成' : '规则建议',
        advising: false,
      });
    } catch (error) {
      this.setData({ advising: false });
      showError(error);
    }
  },

  /** 去刷题。 */
  onGoPractice() {
    goPractice();
  },

  /** 只刷错题。 */
  onReviewWrong() {
    goPractice('?source=review');
  },
});
