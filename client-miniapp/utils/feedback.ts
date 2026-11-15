/**
 * 轻反馈：Toast / 震动 / 错误文案归一化。
 */

/** 轻提示。 */
export function toast(title: string, icon: 'none' | 'success' | 'error' = 'none'): void {
  wx.showToast({ title, icon, duration: 1800 });
}

/** 成功提示。 */
export function toastSuccess(title: string): void {
  wx.showToast({ title, icon: 'success', duration: 1500 });
}

/** 触感反馈（失败静默：部分机型/系统关闭了震动）。 */
export function haptic(type: 'light' | 'medium' | 'heavy' = 'light'): void {
  try {
    wx.vibrateShort({ type });
  } catch {
    // 忽略：震动属于锦上添花，不影响主流程
  }
}

/** 把任意异常转成可展示文案。 */
export function errorText(error: unknown, fallback = '操作失败，请稍后重试'): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

/** 展示异常。 */
export function showError(error: unknown, fallback?: string): void {
  toast(errorText(error, fallback), 'none');
}
