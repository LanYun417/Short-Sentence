/**
 * 展示层格式化工具。
 */
import { ASSET_BASE_URL } from './env';

/** 补全静态资源绝对地址（后端下发的是 `/static/xxx.webp` 相对路径）。 */
export function absoluteUrl(path: string | null | undefined): string {
  if (!path) {
    return '';
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return `${ASSET_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** 数字千分位（榜单/经验显示用）。 */
export function withThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 昵称首字（无头像时的占位）。 */
export function initialOf(nickname: string): string {
  return nickname ? nickname.trim().charAt(0).toUpperCase() : '?';
}

/** 百分比（0~1 → 0~100 整数）。 */
export function percentText(ratio: number): string {
  return `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
}

/** 把毫秒格式化成 m:ss（作答计时）。 */
export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
