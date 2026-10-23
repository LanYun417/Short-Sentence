/**
 * 今日句签状态（跨页面共享）。
 * 用途：导航头像的常驻特效（表示「今日句签已获得」）；刷题页领取成功后立即点亮。
 * 用 useState 而非 Pinia：只是一个布尔值，但要参与 SSR 序列化（否则首屏无特效）。
 */
export interface TodayCardStatus {
  /** 今日句签是否已获得 */
  obtained: boolean;
  /** 今日业务日期（YYYY-MM-DD） */
  bizDate: string;
}

export function useTodayCard() {
  const status = useState<TodayCardStatus>('ss:today-card', () => ({ obtained: false, bizDate: '' }));

  return {
    status,
    /** 标记今日句签已获得（刷题页领取成功后调用，头像特效立刻点亮）。 */
    markObtained: (bizDate?: string): void => {
      status.value = { obtained: true, bizDate: bizDate ?? status.value.bizDate };
    },
  };
}
