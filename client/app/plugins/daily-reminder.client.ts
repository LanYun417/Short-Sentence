/**
 * 每日句签提醒调度（仅客户端）。
 *
 * 进入站点时读回设置，之后每 5 分钟检查一次：到点、且今日句签尚未获得 → 弹一次通知。
 * 之所以「每 5 分钟轮询」而不是「精确到点 setTimeout」：用户可能一直开着页面跨过提醒时间，
 * 轮询实现简单且不会因为设备休眠 / 时钟调整而漏掉；每天最多弹一次由 localStorage 兜底。
 */
export default defineNuxtPlugin(() => {
  const { setting, load, maybeNotify, todayKey } = useDailyReminder();
  const { status: todayCard } = useTodayCard();

  load();

  const tick = (): void => {
    if (!setting.value.enabled) {
      return;
    }
    void maybeNotify(() => {
      // 今日已获得则不必提醒；bizDate 必须等于今天，避免用到 SSR 的旧值
      return !(todayCard.value.obtained && todayCard.value.bizDate === todayKey());
    });
  };

  // 首次稍等片刻，让 SSR 预取的句签状态落地后再判断
  const firstTimer = setTimeout(tick, 3000);
  const timer = setInterval(tick, 5 * 60 * 1000);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      clearTimeout(firstTimer);
      clearInterval(timer);
    });
  }
});
