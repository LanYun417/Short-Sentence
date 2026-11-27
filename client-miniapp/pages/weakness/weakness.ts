/**
 * 弱点词根：近 30 天错题按词自动归类。
 * 数据来自 /client/questions/weakness，与 Web / Android 同口径：
 * 功能词已由服务端过滤，中文释义取题库逐词释义，词根解析取词根词典。
 */
import { fetchWeakness } from '../../services/learn';
import type { WeaknessReport } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { absoluteUrl } from '../../utils/format';
import { goLogin, goPractice } from '../../utils/nav';
import { showError } from '../../utils/feedback';

interface ExampleView {
  sentenceId: number;
  translationZh: string;
  imageUrl: string;
  userAnswer: string;
}

interface ItemView {
  word: string;
  meaning: string;
  rootAnalysis: string;
  wrongCount: number;
  totalCount: number;
  examples: ExampleView[];
}

interface WeaknessData {
  report: WeaknessReport | null;
  items: ItemView[];
  loading: boolean;
  errorText: string;
}

interface WeaknessCustom {
  load(): Promise<void>;
  onRetry(): void;
  onGoReview(): void;
}

Page<WeaknessData, WeaknessCustom>({
  data: {
    report: null,
    items: [],
    loading: true,
    errorText: '',
  },

  async onLoad() {
    await sessionReady();
    if (!isLoggedIn()) {
      goLogin();
      return;
    }
    await this.load();
  },

  onPullDownRefresh() {
    void this.load().finally(() => wx.stopPullDownRefresh());
  },

  async load() {
    this.setData({ loading: true, errorText: '' });
    try {
      const report = await fetchWeakness();
      const items: ItemView[] = report.items.map((item) => ({
        word: item.word,
        meaning: item.meaning ?? '',
        rootAnalysis: item.rootAnalysis ?? '',
        wrongCount: item.wrongCount,
        totalCount: item.totalCount,
        examples: item.examples.map((example) => ({
          sentenceId: example.sentenceId,
          translationZh: example.translationZh,
          imageUrl: absoluteUrl(example.imageUrl),
          userAnswer: example.userAnswer || '（空）',
        })),
      }));
      this.setData({ report, items, loading: false });
    } catch (error) {
      showError(error);
      this.setData({ loading: false, errorText: '加载失败，请检查网络后重试' });
    }
  },

  onRetry() {
    void this.load();
  },

  onGoReview() {
    goPractice('?source=review');
  },
});
