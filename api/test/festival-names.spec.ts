import { describe, expect, it } from 'vitest';
import { festivalNameSet, festivalOf, isFestivalName } from '../src/common/calendar/festivals.js';

/**
 * 节日名集合：日常生题的主题会用它排除节日分类。
 *
 * 如果这里漏了某个节日名，该节日的分类就会混进日常主题，导致一年四季都在出节日题；
 * 如果误把普通场景判成节日，对应分类会被永久排除在主题外。两边都要钉住。
 */
describe('festivalNameSet', () => {
  it('包含公历固定节日', () => {
    expect(isFestivalName('元旦')).toBe(true);
    expect(isFestivalName('圣诞节')).toBe(true);
  });

  it('包含农历节日与清明', () => {
    expect(isFestivalName('春节')).toBe(true);
    expect(isFestivalName('端午节')).toBe(true);
    expect(isFestivalName('中秋节')).toBe(true);
    expect(isFestivalName('清明节')).toBe(true);
  });

  it('包含浮动公历节日', () => {
    expect(isFestivalName('母亲节')).toBe(true);
    expect(isFestivalName('感恩节')).toBe(true);
  });

  it('普通场景分类不算节日', () => {
    expect(isFestivalName('咖啡店点单')).toBe(false);
    expect(isFestivalName('机场通关')).toBe(false);
  });

  it('结果缓存复用（节日表是静态的）', () => {
    expect(festivalNameSet()).toBe(festivalNameSet());
  });
});

/**
 * 农历节日日期表：这些日期每年补录，写错一天就会在错的日子重建题库。
 * 用已核对的来源钉住 2026~2027：
 * - 2026 端午 6/19、中秋 9/25：国务院办公厅 2026 年放假通知；
 * - 2027 各节：香港特区政府宪报 2027 年公众假期 + 农历日历站交叉一致。
 */
describe('festivalOf 农历日期', () => {
  const cases: Array<{ date: Date; name: string }> = [
    { date: new Date(2026, 5, 19), name: '端午节' },
    { date: new Date(2026, 8, 25), name: '中秋节' },
    { date: new Date(2027, 1, 6), name: '春节' },
    { date: new Date(2027, 1, 20), name: '元宵节' },
    { date: new Date(2027, 5, 9), name: '端午节' },
    { date: new Date(2027, 8, 15), name: '中秋节' },
    { date: new Date(2027, 9, 8), name: '重阳节' },
  ];

  for (const item of cases) {
    it(`${item.date.getFullYear()}-${item.date.getMonth() + 1}-${item.date.getDate()} → ${item.name}`, () => {
      expect(festivalOf(item.date)?.name).toBe(item.name);
    });
  }
});
