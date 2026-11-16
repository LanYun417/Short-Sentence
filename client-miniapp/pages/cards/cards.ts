/**
 * 每日句签：领取今日 / 我拥有的 / 未拥有。
 *
 * 规则：完成当日目标（todayDone >= todayGoal）且当日句签已就绪，才能领取；
 * 未达成时 claim 返回 null，这里给出引导而不是报错。
 */
import { claimTodayCard, fetchMissingCards, fetchMyCards } from '../../services/cards';
import type { SentenceCard } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { showError, toast, toastSuccess } from '../../utils/feedback';
import { absoluteUrl } from '../../utils/format';
import { goLogin, goPractice } from '../../utils/nav';

/** 卡片视图模型。 */
interface CardView {
  id: number;
  bizDate: string;
  title: string;
  titleZh: string;
  en: string;
  zh: string;
  blessing: string;
  imageUrl: string;
  owned: boolean;
}

interface CardsData {
  tab: 'today' | 'mine' | 'missing';
  today: CardView | null;
  mine: CardView[];
  missing: CardView[];
  missingTotal: number;
  loading: boolean;
  claiming: boolean;
  detail: CardView | null;
  /** 闪卡当前是否显示卡背面（false = 默认显示正面；点击卡片切换） */
  cardBackShown: boolean;
}

interface CardsCustom {
  refresh(): Promise<void>;
  todayKey(): string;
  toView(card: SentenceCard, owned: boolean): CardView;
  onSwitchTab(event: WechatMiniprogram.TouchEvent): void;
  onClaim(): Promise<void>;
  onOpenCard(event: WechatMiniprogram.TouchEvent): void;
  onFlipCard(): void;
  onCloseDetail(): void;
  onTapSheet(): void;
  onGoPractice(): void;
}

Page<CardsData, CardsCustom>({
  data: {
    tab: 'today',
    today: null,
    mine: [],
    missing: [],
    missingTotal: 0,
    loading: true,
    claiming: false,
    detail: null,
    // 闪卡翻面状态：false = 正面（句子+配图），true = 卡背（日期+寄语）。
    // 打开详情默认显示正面，与「先看到内容、再翻看寄语」的预期一致。
    cardBackShown: false,
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

  /** 拉我的 + 未拥有。 */
  async refresh() {
    try {
      const [mine, missing] = await Promise.all([
        fetchMyCards().catch(() => []),
        fetchMissingCards().catch(() => ({ total: 0, list: [] })),
      ]);
      const mineViews = mine.map((card) => this.toView(card, true));
      this.setData({
        mine: mineViews,
        missing: missing.list.map((card) => this.toView(card, false)),
        missingTotal: missing.total,
        today: mineViews.length > 0 && mineViews[0].bizDate === this.todayKey() ? mineViews[0] : null,
        loading: false,
      });
    } catch (error) {
      this.setData({ loading: false });
      showError(error);
    }
  },

  /** YYYY-MM-DD（本地时区）。 */
  todayKey(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  },

  /** 转视图模型。 */
  toView(card: SentenceCard, owned: boolean): CardView {
    return {
      id: card.id,
      bizDate: card.bizDate,
      title: card.title,
      titleZh: card.titleZh,
      en: card.sentenceEn,
      zh: card.translationZh,
      blessing: card.blessing || '每天一句，慢慢就记住了。',
      imageUrl: absoluteUrl(card.imageUrl),
      owned,
    };
  },

  /** 切 tab。 */
  onSwitchTab(event: WechatMiniprogram.TouchEvent) {
    const tab = event.currentTarget.dataset.tab;
    if (tab !== 'today' && tab !== 'mine' && tab !== 'missing') {
      return;
    }
    this.setData({ tab });
  },

  /** 领取今日句签。 */
  async onClaim() {
    if (this.data.claiming) {
      return;
    }
    this.setData({ claiming: true });
    try {
      const card = await claimTodayCard();
      this.setData({ claiming: false });
      if (!card) {
        // 两种原因都会返回 null：目标没完成，或当日句签还没生成（00:30 定时任务）
        toast('今日句签尚未就绪，稍后再来看看');
        return;
      }
      toastSuccess('句签已领取');
      await this.refresh();
      // 新领到的卡也先显示正面（看到内容才算「翻开」这张卡）
      this.setData({ detail: this.toView(card, true), cardBackShown: false });
    } catch (error) {
      this.setData({ claiming: false });
      showError(error);
    }
  },

  /** 打开卡片详情。 */
  onOpenCard(event: WechatMiniprogram.TouchEvent) {
    const tab = String(event.currentTarget.dataset.tab ?? '');
    const index = Number(event.currentTarget.dataset.index as string);
    if (tab === 'today') {
      if (this.data.today) {
        this.setData({ detail: this.data.today, cardBackShown: false });
      }
      return;
    }
    const list = tab === 'mine' ? this.data.mine : tab === 'missing' ? this.data.missing : [];
    const card = list[index];
    if (card) {
      this.setData({ detail: card, cardBackShown: false });
    }
  },

  /**
   * 翻面（闪卡）：默认正面，点击切到卡背寄语，再点翻回正面。
   * 未拥有的句签没有正面可看，不响应翻面。
   */
  onFlipCard() {
    const detail = this.data.detail;
    if (!detail || !detail.owned) {
      return;
    }
    this.setData({ cardBackShown: !this.data.cardBackShown });
  },

  /** 关闭详情。 */
  onCloseDetail() {
    this.setData({ detail: null });
  },

  /** 阻止冒泡。 */
  onTapSheet() {
    // 故意留空：catchtap 只用于吞掉冒泡
  },

  /** 去刷题达成目标。 */
  onGoPractice() {
    goPractice();
  },

  /** 分享今日句签。 */
  onShareAppMessage() {
    const card = this.data.today ?? this.data.mine[0];
    if (!card) {
      return { title: '每天一句，慢慢就记住了', path: '/pages/index/index' };
    }
    const share: { title: string; path: string; imageUrl?: string } = {
      title: card.en ? `${card.en}` : card.title || '今日句签',
      path: '/pages/index/index',
    };
    if (card.imageUrl) {
      share.imageUrl = card.imageUrl;
    }
    return share;
  },
});
