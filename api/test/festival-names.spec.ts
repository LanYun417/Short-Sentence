import { describe, expect, it } from 'vitest';
import { festivalNameSet, isFestivalName } from '../src/common/calendar/festivals.js';

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
