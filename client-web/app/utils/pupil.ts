/**
 * 瞳孔朝向计算（纯函数，便于单测）。
 *
 * 给定光标在 viewBox 坐标系中的位置 (mx,my) 与参考点 (refX,refY)，
 * 返回瞳孔应偏移的向量（viewBox 单位），方向指向光标、长度不超过 max。
 * 光标与参考点重合或极近时返回 {0,0}，避免除零与抖动。
 */
export interface Point {
  x: number;
  y: number;
}

export function pupilOffset(mx: number, my: number, refX: number, refY: number, max: number): Point {
  const dx = mx - refX;
  const dy = my - refY;
  const len = Math.hypot(dx, dy);
  if (len < 1e-3) {
    return { x: 0, y: 0 };
  }
  return { x: (dx / len) * max, y: (dy / len) * max };
}
