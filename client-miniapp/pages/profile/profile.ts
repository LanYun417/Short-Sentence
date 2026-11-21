/**
 * 我的：资料 / 成长摘要 / 注销 / 数据导出 / 退出。
 *
 * 注销与导出是上线合规门槛（隐私政策承诺的能力），入口必须常驻且可用。
 */
import { fetchTodayCheckin } from '../../services/checkin';
import { fetchGamifyOverview } from '../../services/gamify';
import { exportMyData, writeExportFile } from '../../services/profile';
import type { ClientUserProfile } from '../../services/types';
import { fetchProfile, isLoggedIn, logout, sessionReady } from '../../utils/auth';
import { showError, toast } from '../../utils/feedback';
import { absoluteUrl, initialOf } from '../../utils/format';
import { goLogin } from '../../utils/nav';
import { syncNoticeBadge } from '../../utils/notice-badge';
import { menuIcon } from '../../utils/menu-icons';
import { getCachedUser } from '../../utils/storage';

/** 微信登录自动建的占位邮箱后缀（不展示给用户）。 */
const WECHAT_PLACEHOLDER_SUFFIX = '@wx.local';

/** 功能入口（分三组渲染）。图标用语义名，交给 menuIcon() 生成内联 SVG，取代 emoji。 */
const MENUS = [
  { key: 'banks', label: '题库', icon: 'bookOpen', group: 1 },
  { key: 'library', label: '语句库', icon: 'library', group: 1 },
  { key: 'boss', label: '每日 Boss', icon: 'zap', group: 1 },
  { key: 'ipa', label: '音标', icon: 'type', group: 1 },
  { key: 'wordRoot', label: '词根', icon: 'puzzle', group: 1 },
  { key: 'coach', label: 'AI 私教', icon: 'graduationCap', group: 1 },
  { key: 'memory', label: '记忆健康', icon: 'brain', group: 1 },
  { key: 'cards', label: '句签', icon: 'sparkles', group: 2 },
  { key: 'checkin', label: '打卡', icon: 'flame', group: 2 },
  { key: 'weekly', label: '周报', icon: 'chartColumn', group: 2 },
  { key: 'chains', label: '接龙', icon: 'link', group: 2 },
  { key: 'team', label: '小分队', icon: 'usersRound', group: 2 },
  { key: 'submissions', label: '投稿', icon: 'penLine', group: 3 },
  { key: 'notices', label: '通知', icon: 'bell', group: 3 },
  { key: 'feedback', label: '反馈', icon: 'lightbulb', group: 3 },
  { key: 'edit', label: '编辑资料', icon: 'settings', group: 3 },
];

/** 菜单项视图模型：icon 已预生成为 SVG background-image。 */
interface MenuItem {
  key: string;
  label: string;
  icon: string;
}

/** 造一组菜单（把语义图标名转成可直接用的 background-image data URI）。 */
function menuGroup(group: number): MenuItem[] {
  return MENUS.filter((item) => item.group === group).map((item) => ({
    key: item.key,
    label: item.label,
    icon: menuIcon(item.icon),
  }));
}

/** key → 页面路径。 */
const ROUTES: Record<string, string> = {
  banks: '/pages/banks/banks',
  library: '/pages/library/library',
  boss: '/pages/boss/boss',
  ipa: '/pages/ipa/ipa',
  wordRoot: '/pages/word-root/word-root',
  coach: '/pages/coach/coach',
  memory: '/pages/memory/memory',
  cards: '/pages/cards/cards',
  checkin: '/pages/checkin/checkin',
  weekly: '/pages/weekly/weekly',
  chains: '/pages/chains/chains',
  team: '/pages/team/team',
  submissions: '/pages/submissions/submissions',
  notices: '/pages/notices/notices',
  feedback: '/pages/feedback/feedback',
  edit: '/pages/profile-edit/profile-edit',
};

interface ProfileData {
  user: ClientUserProfile | null;
  avatarUrl: string;
  initial: string;
  accountLabel: string;
  xpText: string;
  streakText: string;
  achievementText: string;
  version: string;
  /** 未读公告数（通知入口上的小红点） */
  noticeUnread: number;
  group1: MenuItem[];
  group2: MenuItem[];
  group3: MenuItem[];
}

interface ProfileCustom {
  applyUser(user: ClientUserProfile | null): void;
  refresh(): Promise<void>;
  shareFile(filePath: string): void;
  onMenu(event: WechatMiniprogram.TouchEvent): void;
  onExport(): Promise<void>;
  onDelete(): void;
  onLogout(): void;
  onOpenTerms(): void;
  onOpenPrivacy(): void;
}

Page<ProfileData, ProfileCustom>({
  data: {
    user: null,
    avatarUrl: '',
    initial: '',
    accountLabel: '',
    xpText: '0',
    streakText: '0',
    achievementText: '0',
    version: '1.0.0',
    noticeUnread: 0,
    group1: menuGroup(1),
    group2: menuGroup(2),
    group3: menuGroup(3),
  },

  onLoad() {
    let version = '1.0.0';
    try {
      version = wx.getAccountInfoSync().miniProgram.version || '1.0.0';
    } catch {
      // 开发者工具早期版本没有该 API：保留默认版本号
    }
    this.setData({ version });
  },

  async onShow() {
    await sessionReady();
    if (!isLoggedIn()) {
      goLogin();
      return;
    }
    this.applyUser(getCachedUser());
    void this.refresh();
  },

  onPullDownRefresh() {
    void this.refresh().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /** 渲染用户资料。 */
  applyUser(user: ClientUserProfile | null) {
    const email = user?.email ?? '';
    this.setData({
      user,
      avatarUrl: absoluteUrl(user?.avatarUrl ?? null),
      initial: initialOf(user?.nickname ?? ''),
      accountLabel: email.endsWith(WECHAT_PLACEHOLDER_SUFFIX) ? '微信登录账号' : email,
    });
  },

  /** 并行拉取资料 / 成长 / 打卡摘要 / 未读数。 */
  async refresh() {
    try {
      const [user, overview, checkin, unread] = await Promise.all([
        fetchProfile().catch(() => null),
        fetchGamifyOverview().catch(() => null),
        fetchTodayCheckin().catch(() => null),
        syncNoticeBadge().catch(() => 0),
      ]);
      if (user) {
        this.applyUser(user);
      }
      this.setData({
        xpText: overview ? String(overview.xp) : '0',
        streakText: checkin ? String(checkin.streak) : '0',
        achievementText: overview ? `${overview.unlockedAchievements}/${overview.totalAchievements}` : '0',
        noticeUnread: unread,
      });
    } catch (error) {
      showError(error);
    }
  },

  /** 功能入口跳转。 */
  onMenu(event: WechatMiniprogram.TouchEvent) {
    const key = String(event.currentTarget.dataset.key ?? '');
    const url = ROUTES[key];
    if (!url) {
      return;
    }
    wx.navigateTo({ url });
  },

  /** 导出我的数据 → 生成 JSON → 调起「发送给朋友/保存」。 */
  async onExport() {
    wx.showLoading({ title: '正在打包…', mask: true });
    try {
      const data = await exportMyData();
      wx.hideLoading();
      const filePath = writeExportFile(data);
      wx.showModal({
        title: '导出完成',
        content: '已生成 JSON 文件。点「发送文件」可转发到聊天或保存到手机；开发者工具不支持该能力。',
        confirmText: '发送文件',
        cancelText: '知道了',
        success: (res) => {
          if (res.confirm) {
            this.shareFile(filePath);
          }
        },
      });
    } catch (error) {
      wx.hideLoading();
      showError(error, '导出失败，请稍后重试');
    }
  },

  /** 调起文件转发（真机可用；失败时提示文件位置）。 */
  shareFile(filePath: string) {
    wx.shareFileMessage({
      filePath,
      fail: () => toast('当前环境不支持转发，文件已生成在小程序本地目录'),
    });
  },

  /**
   * 去注销页。
   *
   * 注销要二次身份校验（邮箱验证码 / 微信授权）+ 可选原因，弹窗装不下；
   * 单独一页（pages/account-delete）比套三层 showModal 清楚得多。
   */
  onDelete() {
    wx.navigateTo({ url: '/pages/account-delete/account-delete' });
  },

  /** 退出登录。 */
  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需要重新登录才能继续练习。',
      confirmText: '退出',
      success: (res) => {
        if (res.confirm) {
          void logout();
        }
      },
    });
  },

  /** 法务页入口：登录页之外也要随时可查（隐私政策承诺的知情权）。 */
  onOpenTerms() {
    wx.navigateTo({ url: '/pages/terms/terms' });
  },

  onOpenPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },
});
