/**
 * 节气与节日判定测试。
 *
 * 这组测试是「日期感知」功能的地基：算错一天，用户就会在错误的日子
 * 收到错误的卡片，比没有这个功能更糟。因此用**已知锚点**锁定：
 * - 节气：用公开可查的年份日期（如 2026 年霜降 10-23、冬至 12-22）
 * - 节日：用固定公历节日 + 浮动节日规则（母亲节 = 5 月第二个周日）
 * - 农历：只用已交叉验证的 2026 年数据
 */
import { describe, expect, it } from 'vitest';

import { dayContextOf, parseDateKey, toDateKey } from '../src/common/calendar/day-context.js';
import { festivalOf, lunarFestivalYears } from '../src/common/calendar/festivals.js';
import { solarTermDate, solarTermOf } from '../src/common/calendar/solar-terms.js';

describe('二十四节气', () => {
  it('2026 年关键节气日期正确（公开日历可查）', () => {
    // 下标：0 小寒 / 5 春分 / 6 清明 / 17 秋分 / 19 霜降 / 23 冬至
    const cases: Array<[number, number, number]> = [
      [5, 3, 20], // 春分 3-20
      [6, 4, 5], // 清明 4-5
      [17, 9, 23], // 秋分 9-23
      [19, 10, 23], // 霜降 10-23
      [23, 12, 22], // 冬至 12-22
    ];
    for (const [index, month, day] of cases) {
      const date = solarTermDate(2026, index);
      expect({ index, month: date.getMonth() + 1, day: date.getDate() }).toEqual({ index, month, day });
    }
  });

  it('节气日期落在正确的月份（每月两个，全年 24 个）', () => {
    for (let index = 0; index < 24; index += 1) {
      const date = solarTermDate(2026, index);
      expect(date.getMonth() + 1).toBe(Math.floor(index / 2) + 1);
    }
  });

  it('solarTermOf 能命中霜降，非节气日返回 null', () => {
    expect(solarTermOf(parseDateKey('2026-10-23'))?.name).toBe('霜降');
    // 10-24 不是节气
    expect(solarTermOf(parseDateKey('2026-10-24'))).toBeNull();
  });

  it('跨年份也稳定（2025 霜降 10-23）', () => {
    expect(solarTermOf(parseDateKey('2025-10-23'))?.name).toBe('霜降');
  });
});

describe('节日判定', () => {
  it('公历固定节日', () => {
    expect(festivalOf(parseDateKey('2026-01-01'))?.name).toBe('元旦');
    expect(festivalOf(parseDateKey('2026-02-14'))?.name).toBe('情人节');
    expect(festivalOf(parseDateKey('2026-10-31'))?.name).toBe('万圣节');
    expect(festivalOf(parseDateKey('2026-12-25'))?.name).toBe('圣诞节');
  });

  it('浮动节日：母亲节 = 5 月第二个周日', () => {
    // 2026-05-10 是周日，且是 5 月第二个周日
    const motherDay = parseDateKey('2026-05-10');
    expect(motherDay.getDay()).toBe(0);
    expect(festivalOf(motherDay)?.name).toBe('母亲节');

    // 5 月第一个周日（05-03）不应命中
    expect(festivalOf(parseDateKey('2026-05-03'))?.name).not.toBe('母亲节');
  });

  it('浮动节日：父亲节 = 6 月第三个周日', () => {
    expect(festivalOf(parseDateKey('2026-06-21'))?.name).toBe('父亲节');
  });

  it('农历节日：2026 重阳节 10-18（已交叉验证）', () => {
    expect(festivalOf(parseDateKey('2026-10-18'))?.name).toBe('重阳节');
  });

  it('农历节日：2026 春节 02-17 / 元宵 03-03', () => {
    expect(festivalOf(parseDateKey('2026-02-17'))?.name).toBe('春节');
    expect(festivalOf(parseDateKey('2026-03-03'))?.name).toBe('元宵节');
  });

  it('未收录农历节日的年份返回 null（宁缺勿错，不猜日期）', () => {
    // 2030 年未收录，不应误报
    expect(festivalOf(parseDateKey('2030-10-18'))).toBeNull();
    expect(lunarFestivalYears()).toContain(2026);
  });

  it('普通日返回 null', () => {
    expect(festivalOf(parseDateKey('2026-10-24'))).toBeNull();
  });
});

describe('日期语境（节日 > 节气 > 普通日）', () => {
  it('节日优先于节气：清明既是节气又是节日时按节日走', () => {
    const context = dayContextOf(parseDateKey('2026-04-05'));
    expect(context.kind).toBe('festival');
    expect(context.name).toBe('清明节');
  });

  it('纯节气日走 solar-term 并带风格提示', () => {
    const context = dayContextOf(parseDateKey('2026-10-23'));
    expect(context.kind).toBe('solar-term');
    expect(context.name).toBe('霜降');
    expect(context.nameEn).toBe('Frost Descent');
    expect(context.styleHint.length).toBeGreaterThan(0);
  });

  it('普通日 kind=ordinary 且无风格提示（交给随机维度）', () => {
    const context = dayContextOf(parseDateKey('2026-10-24'));
    expect(context.kind).toBe('ordinary');
    expect(context.styleHint).toBe('');
  });

  it('节日带英文名与风格提示（进 prompt 用）', () => {
    const context = dayContextOf(parseDateKey('2026-10-31'));
    expect(context.nameEn).toBe('Halloween');
    expect(context.styleHint).toContain('pumpkin');
  });
});

describe('日期工具', () => {
  it('parseDateKey 不受时区影响（不会退一天）', () => {
    const date = parseDateKey('2026-10-18');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9); // 0-based
    expect(date.getDate()).toBe(18);
  });

  it('toDateKey 与 parseDateKey 往返一致', () => {
    for (const key of ['2026-01-01', '2026-02-17', '2026-10-18', '2026-12-31']) {
      expect(toDateKey(parseDateKey(key))).toBe(key);
    }
  });
});
