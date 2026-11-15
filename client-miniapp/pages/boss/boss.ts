/**
 * 每日 Boss：当天固定一道挑战题，答对额外 +XP，一天一次。
 */
import { answerBoss, fetchBoss } from '../../services/learn';
import type { BossAnswerResult, BossToday } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { haptic, showError, toast, toastSuccess } from '../../utils/feedback';
import { absoluteUrl } from '../../utils/format';
import { goLogin } from '../../utils/nav';

interface BossData {
  boss: BossToday | null;
  answer: string;
  submitting: boolean;
  loading: boolean;
  result: BossAnswerResult | null;
  imageUrl: string;
  xpText: string;
}

interface BossCustom {
  startedAt: number;
  refresh(): Promise<void>;
  onInput(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onSubmit(): Promise<void>;
}

Page<BossData, BossCustom>({
  data: {
    boss: null,
    answer: '',
    submitting: false,
    loading: true,
    result: null,
    imageUrl: '',
    xpText: '',
  },

  startedAt: 0,

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

  /** 拉今日 Boss。 */
  async refresh() {
    try {
      const boss = await fetchBoss();
      this.setData({
        boss,
        imageUrl: absoluteUrl(boss.question?.imageUrl ?? null),
        loading: false,
        result: null,
        xpText: '',
      });
      this.startedAt = Date.now();
    } catch (error) {
      this.setData({ loading: false });
      showError(error);
    }
  },

  /** 输入。 */
  onInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ answer: event.detail.value });
  },

  /** 提交。 */
  async onSubmit() {
    const boss = this.data.boss;
    if (!boss || !boss.question || this.data.submitting || this.data.result) {
      return;
    }
    const answer = this.data.answer.trim();
    if (!answer) {
      toast('先写出这句话吧');
      return;
    }
    this.setData({ submitting: true });
    try {
      const elapsedMs = this.startedAt > 0 ? Math.min(Date.now() - this.startedAt, 3_600_000) : 0;
      const result = await answerBoss(boss.question.sentenceId, answer, elapsedMs);
      const xp = (result.xpEarned ?? 0) + (result.bossBonus ?? 0);
      this.setData({
        result,
        submitting: false,
        xpText: xp > 0 ? `+${xp} XP` : '',
      });
      haptic(result.isCorrect ? 'light' : 'medium');
      if (result.bossCleared) {
        toastSuccess('Boss 通关');
      }
    } catch (error) {
      this.setData({ submitting: false });
      showError(error);
    }
  },

  /** 分享。 */
  onShareAppMessage() {
    return { title: '今天的 Boss 你答得出来吗？', path: '/pages/index/index' };
  },
});
