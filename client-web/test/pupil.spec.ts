import { describe, expect, it } from 'vitest';
import { pupilOffset } from '../app/utils/pupil';

describe('pupilOffset', () => {
  it('光标与参考点重合时返回原点', () => {
    expect(pupilOffset(50, 50, 50, 50, 4)).toEqual({ x: 0, y: 0 });
  });

  it('光标极近时不产生明显偏移（避免除零抖动）', () => {
    const r = pupilOffset(50.0001, 50, 50, 50, 4);
    expect(Math.hypot(r.x, r.y)).toBeLessThan(1e-2);
  });

  it('光标在右侧时瞳孔朝正右、长度被限幅到 max', () => {
    const r = pupilOffset(200, 50, 50, 50, 4);
    expect(r.x).toBeCloseTo(4, 6);
    expect(Math.abs(r.y)).toBeLessThan(1e-6);
    expect(Math.hypot(r.x, r.y)).toBeLessThanOrEqual(4 + 1e-9);
  });

  it('光标在左上方时方向正确、长度恒为 max', () => {
    const r = pupilOffset(10, 10, 50, 50, 4);
    expect(r.x).toBeLessThan(0);
    expect(r.y).toBeLessThan(0);
    expect(Math.hypot(r.x, r.y)).toBeCloseTo(4, 6);
  });

  it('远处与近处光标给出相同幅值（只看方向）', () => {
    const near = pupilOffset(60, 50, 50, 50, 4);
    const far = pupilOffset(500, 50, 50, 50, 4);
    expect(Math.hypot(near.x, near.y)).toBeCloseTo(Math.hypot(far.x, far.y), 6);
  });
});
