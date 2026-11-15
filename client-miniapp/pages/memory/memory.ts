/**
 * 记忆健康：累计/待复习数字 + 未来 30 天复习分布 + 理论遗忘曲线。
 * 数据来自 /client/questions/memory-stats，与 Web MemoryHealthCard、Android 同口径。
 * 纯 WXML/CSS 画条形，不引图表库。
 */
import { fetchMemoryStats } from '../../services/question';
import type { MemoryStats } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { showError } from '../../utils/feedback';
import { goLogin, goPractice } from '../../utils/nav';

interface Bar {
  day: number;
  count: number;
  /** 相对最高柱的百分比高度 */
  height: number;
}

interface CurvePoint {
  day: number;
  /** 保持率百分比 */
  percent: number;
}

interface MemoryData {
  stats: MemoryStats | null;
  loading: boolean;
  errorText: string;
  bars: Bar[];
  curve: CurvePoint[];
}

interface MemoryCustom {
  load(): Promise<void>;
  onRetry(): void;
  onGoReview(): void;
}

Page<MemoryData, MemoryCustom>({
  data: {
    stats: null,
    loading: true,
    errorText: '',
    bars: [],
    curve: [],
  },

  async onLoad() {
    await sessionReady();
    if (!isLoggedIn()) {
      goLogin();
      return;
    }
    await this.load();
  },

  async load() {
    this.setData({ loading: true, errorText: '' });
    try {
      const stats = await fetchMemoryStats();
      const distribution = Array.isArray(stats.distribution) ? stats.distribution : [];
      const curveRaw = Array.isArray(stats.retentionCurve) ? stats.retentionCurve : [];
      const max = Math.max(1, ...distribution);
      const bars: Bar[] = distribution.map((count, index) => ({
        day: index + 1,
        count,
        height: Math.round((count / max) * 100),
      }));
      // 31 个点全画太密，每 5 天取一个（0/5/…/30）
      const curve: CurvePoint[] = curveRaw
        .filter((_, index) => index % 5 === 0)
        .map((point) => ({ day: point.day, percent: Math.round(point.retention * 100) }));
      this.setData({ stats, bars, curve, loading: false });
    } catch (error) {
      showError(error);
      this.setData({ loading: false, errorText: '加载失败，请检查网络后重试' });
    }
  },

  onRetry() {
    void this.load();
  },

  /** 直接进复习池：与首页「复习」入口同一口径（source=review）。 */
  onGoReview() {
    goPractice('?source=review');
  },
});
