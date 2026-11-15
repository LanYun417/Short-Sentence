/**
 * 词根拆解：搜索词根词典；查不到时可让 AI 现场拆解（消耗一次 AI 额度）。
 */
import { fetchWordRoot, searchWordRoots } from '../../services/learn';
import type { WordRootItem } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { showError, toast } from '../../utils/feedback';
import { goLogin } from '../../utils/nav';

/** 构件类型中文名。 */
const PART_LABEL: Record<string, string> = { prefix: '前缀', root: '词根', suffix: '后缀' };

/** 列表项视图模型。 */
interface RootView {
  word: string;
  phonetic: string;
  meaning: string;
  partText: string;
}

interface RootData {
  query: string;
  hot: RootView[];
  results: RootView[];
  detail: WordRootItem | null;
  detailParts: Array<{ label: string; text: string; meaning: string }>;
  loading: boolean;
  searching: boolean;
}

interface RootCustom {
  toView(item: WordRootItem): RootView;
  loadHot(): Promise<void>;
  onInput(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onSearch(): Promise<void>;
  onOpenItem(event: WechatMiniprogram.TouchEvent): void;
  openDetail(word: string): Promise<void>;
  onAiParse(): Promise<void>;
  onCloseDetail(): void;
  onTapSheet(): void;
}

Page<RootData, RootCustom>({
  data: {
    query: '',
    hot: [],
    results: [],
    detail: null,
    detailParts: [],
    loading: true,
    searching: false,
  },

  async onLoad() {
    await sessionReady();
    if (!isLoggedIn()) {
      goLogin();
      return;
    }
    await this.loadHot();
  },

  /** 词条 → 视图模型。 */
  toView(item: WordRootItem): RootView {
    return {
      word: item.word,
      phonetic: item.phonetic ?? '',
      meaning: item.meaning ?? '',
      partText: item.parts.map((part) => part.text).join(' + '),
    };
  },

  /** 热门词。 */
  async loadHot() {
    try {
      const hot = await searchWordRoots('');
      this.setData({ hot: hot.map((item) => this.toView(item)), loading: false });
    } catch (error) {
      this.setData({ loading: false });
      showError(error);
    }
  },

  /** 输入。 */
  onInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ query: event.detail.value });
  },

  /** 搜索词典。 */
  async onSearch() {
    const query = this.data.query.trim();
    if (!query) {
      this.setData({ results: [] });
      return;
    }
    this.setData({ searching: true });
    try {
      const list = await searchWordRoots(query);
      this.setData({ results: list.map((item) => this.toView(item)), searching: false });
      if (list.length === 0) {
        toast('词典里没有，试试 AI 拆解');
      }
    } catch (error) {
      this.setData({ searching: false });
      showError(error);
    }
  },

  /** 打开词条详情。 */
  onOpenItem(event: WechatMiniprogram.TouchEvent) {
    const source = String(event.currentTarget.dataset.source ?? '');
    const index = Number(event.currentTarget.dataset.index as string);
    const list = source === 'hot' ? this.data.hot : this.data.results;
    const picked = list[index];
    if (!picked) {
      return;
    }
    void this.openDetail(picked.word);
  },

  /** AI 拆解当前输入的词。 */
  async onAiParse() {
    const query = this.data.query.trim();
    if (!query) {
      toast('先输入一个英文单词');
      return;
    }
    await this.openDetail(query);
  },

  /** 拉词条详情（命中缓存直接返回，未命中走 AI 解析）。 */
  async openDetail(word: string) {
    wx.showLoading({ title: '拆解中…', mask: true });
    try {
      const detail = await fetchWordRoot(word);
      wx.hideLoading();
      this.setData({
        detail,
        detailParts: detail.parts.map((part) => ({
          label: PART_LABEL[part.type] ?? part.type,
          text: part.text,
          meaning: part.meaning,
        })),
      });
    } catch (error) {
      wx.hideLoading();
      showError(error, '拆解失败，请稍后再试');
    }
  },

  /** 关闭详情。 */
  onCloseDetail() {
    this.setData({ detail: null });
  },

  /** 阻止冒泡。 */
  onTapSheet() {
    // 故意留空：catchtap 只用于吞掉冒泡
  },
});
