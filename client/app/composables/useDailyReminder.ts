/**
 * 每日句签提醒（本地设置 + 浏览器通知）。
 *
 * 能力边界说清楚：真正「关掉页面也能收到」的推送需要 App 端（本仓库 Android 端暂缓）
 * 或服务端推送通道；这里实现的是**Web 本地提醒**——用户设一个每日时间，
 * 页面在前台时到点弹一次浏览器通知。零新依赖（Notification 属浏览器原生 API）。
 *
 * 状态存 localStorage（纯本地偏好，不需要上云）：`ss_reminder_setting`；
 * 「今天是否已提醒过」存 `ss_reminder_last`，保证每天最多弹一次。
 */
export interface DailyReminderSetting {
  enabled: boolean;
  /** 提醒时间（0~23 点，本地时区） */
  hour: number;
}

const SETTING_KEY = 'ss_reminder_setting';
const LAST_KEY = 'ss_reminder_last';

export function useDailyReminder() {
  const setting = useState<DailyReminderSetting>('ss:reminder-setting', () => ({ enabled: false, hour: 20 }));

  /** 从 localStorage 读回设置（仅客户端）。 */
  function load(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      const raw = localStorage.getItem(SETTING_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as Partial<DailyReminderSetting>;
      setting.value = {
        enabled: parsed.enabled === true,
        hour: Number.isInteger(parsed.hour) ? Math.min(23, Math.max(0, parsed.hour as number)) : 20,
      };
    } catch {
      // 本地设置损坏：忽略，用默认值
    }
  }

  /** 保存设置。 */
  function persist(next: DailyReminderSetting): void {
    setting.value = next;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SETTING_KEY, JSON.stringify(next));
    }
  }

  /** 浏览器是否支持通知。 */
  function supported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /** 当前通知权限（不支持时返回 unsupported）。 */
  function permission(): NotificationPermission | 'unsupported' {
    return supported() ? Notification.permission : 'unsupported';
  }

  /** 申请通知权限（返回是否已授权）。 */
  async function requestPermission(): Promise<boolean> {
    if (!supported()) {
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission === 'denied') {
      return false;
    }
    return (await Notification.requestPermission()) === 'granted';
  }

  /** 本地时区的今天（YYYY-MM-DD）。 */
  function todayKey(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  /** 今天是否已提醒过。 */
  function notifiedToday(): boolean {
    return typeof localStorage !== 'undefined' && localStorage.getItem(LAST_KEY) === todayKey();
  }

  /**
   * 到点则提醒一次（每天最多一次）。
   * @param shouldRemind 附加条件（例如「今日句签尚未获得」）；返回 false 则本次跳过
   * @returns 是否真的弹了通知
   */
  async function maybeNotify(shouldRemind: () => boolean = () => true): Promise<boolean> {
    if (!supported() || !setting.value.enabled || Notification.permission !== 'granted') {
      return false;
    }
    if (notifiedToday() || new Date().getHours() < setting.value.hour || !shouldRemind()) {
      return false;
    }
    try {
      new Notification('短句 · 今日句签还没领', { body: '来做几道题，点亮今天的闪卡吧', tag: 'ss-daily-reminder' });
      localStorage.setItem(LAST_KEY, todayKey());
      return true;
    } catch {
      return false;
    }
  }

  return { setting, load, persist, supported, permission, requestPermission, maybeNotify, notifiedToday, todayKey };
}
