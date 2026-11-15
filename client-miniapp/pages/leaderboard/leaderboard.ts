/**
 * 排行榜：周期（今日 / 近 7 天 / 近 30 天）+ 指标（答题数 / 答对数），外加累计打卡榜。
 *
 * 后端 7 个榜统一入口 `GET /client/leaderboard?type=...`；
 * 周/月是「滚动 N 个自然日」而非自然周/月（与答题记录保留 30 天对齐）。
 */
import { fetchLeaderboard } from '../../services/leaderboard';
import type { LeaderboardType } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { showError } from '../../utils/feedback';
import { absoluteUrl, initialOf, withThousands } from '../../utils/format';
import { goLogin } from '../../utils/nav';
import { getCachedUser } from '../../utils/storage';

/** 周期选项。 */
const PERIODS = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '近 7 天' },
  { key: 'month', label: '近 30 天' },
  { key: 'checkin', label: '累计打卡' },
];

/** 榜单行视图模型。 */
interface RowView {
  rank: number;
  userId: number;
  nickname: string;
  initial: string;
  avatarUrl: string;
  countText: string;
  isMe: boolean;
  medal: string;
}

interface LeaderboardData {
  periods: typeof PERIODS;
  period: string;
  metric: 'answered' | 'correct';
  rows: RowView[];
  unit: string;
  isCheckin: boolean;
  meText: string;
  meRank: number;
  loading: boolean;
  empty: boolean;
}

interface LeaderboardCustom {
  refresh(): Promise<void>;
  typeOf(): LeaderboardType;
  onPickPeriod(event: WechatMiniprogram.TouchEvent): void;
  onPickMetric(event: WechatMiniprogram.TouchEvent): void;
}

Page<LeaderboardData, LeaderboardCustom>({
  data: {
    periods: PERIODS,
    period: 'today',
    metric: 'answered',
    rows: [],
    unit: '题',
    isCheckin: false,
    meText: '暂未上榜',
    meRank: 0,
    loading: true,
    empty: false,
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

  /** 当前周期 + 指标 → 榜单类型。 */
  typeOf(): LeaderboardType {
    if (this.data.period === 'checkin') {
      return 'checkin_total';
    }
    const period = this.data.period === 'week' ? 'week' : this.data.period === 'month' ? 'month' : 'today';
    return `${period}_${this.data.metric}` as LeaderboardType;
  },

  /** 拉取榜单。 */
  async refresh() {
    this.setData({ loading: true });
    try {
      const type = this.typeOf();
      const result = await fetchLeaderboard(type);
      const me = getCachedUser();
      const rows: RowView[] = result.top.map((row) => ({
        rank: row.rank,
        userId: row.userId,
        nickname: row.nickname || '匿名学习者',
        initial: initialOf(row.nickname),
        avatarUrl: absoluteUrl(row.avatarUrl),
        countText: withThousands(row.count),
        isMe: Boolean(me && me.id === row.userId),
        medal: row.rank === 1 ? 'medal-1' : row.rank === 2 ? 'medal-2' : row.rank === 3 ? 'medal-3' : '',
      }));
      this.setData({
        rows,
        unit: result.unit,
        isCheckin: type === 'checkin_total',
        meRank: result.me ? result.me.rank : 0,
        meText: result.me ? `第 ${result.me.rank} 名 · ${withThousands(result.me.count)} ${result.unit}` : '暂未上榜',
        loading: false,
        empty: rows.length === 0,
      });
    } catch (error) {
      this.setData({ loading: false, empty: true });
      showError(error);
    }
  },

  /** 切换周期。 */
  onPickPeriod(event: WechatMiniprogram.TouchEvent) {
    const key = String(event.currentTarget.dataset.key ?? '');
    if (!key || key === this.data.period) {
      return;
    }
    this.setData({ period: key });
    void this.refresh();
  },

  /** 切换指标。 */
  onPickMetric(event: WechatMiniprogram.TouchEvent) {
    const metric = event.currentTarget.dataset.metric;
    if (metric !== 'answered' && metric !== 'correct') {
      return;
    }
    if (metric === this.data.metric) {
      return;
    }
    this.setData({ metric });
    void this.refresh();
  },
});
