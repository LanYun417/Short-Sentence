import { describe, expect, it } from 'vitest';

import { allFestivalsOf, festivalCoverPromptOf, festivalEntryOf } from '../src/common/calendar/festivals.js';

/**
 * 全量节日清单：节日题库要**一次性铺满全年**，用户端随时能看到所有节日并专门刷题。
 *
 * 这组测试钉住「一个节日在哪天」——日期算错，题库就会生成到错的日子里；
 * 漏掉某个节日，那天用户就点不到对应题库。
 */
describe('allFestivalsOf（全量节日清单）', () => {
  it('公历固定节日日期正确', () => {
    const byName = new Map(allFestivalsOf(2026).map((item) => [item.name, item]));
    expect(byName.get('元旦')?.date).toBe('2026-01-01');
    expect(byName.get('情人节')?.date).toBe('2026-02-14');
    expect(byName.get('万圣节')?.date).toBe('2026-10-31');
    expect(byName.get('跨年夜')?.date).toBe('2026-12-31');
  });

  it('浮动节日按「某月第 n 个周几」正算（母亲节 = 5 月第二个周日）', () => {
    const byName = new Map(allFestivalsOf(2026).map((item) => [item.name, item]));
    expect(byName.get('母亲节')?.date).toBe('2026-05-10');
    expect(byName.get('父亲节')?.date).toBe('2026-06-21');
  });

  it('农历节日取该年已补录的日期', () => {
    const byName = new Map(allFestivalsOf(2026).map((item) => [item.name, item]));
    expect(byName.get('春节')?.date).toBe('2026-02-17');
    expect(byName.get('中秋节')?.date).toBe('2026-09-25');
  });

  it('清明按节气算日期（2026 = 4 月 5 日）', () => {
    const byName = new Map(allFestivalsOf(2026).map((item) => [item.name, item]));
    expect(byName.get('清明节')?.date).toBe('2026-04-05');
  });

  it('农历年份未补录时跳过该年农历节日（宁缺勿错，不猜日期）', () => {
    const names = allFestivalsOf(2030).map((item) => item.name);
    expect(names).not.toContain('春节');
    // 公历固定节日不受农历缺表影响
    expect(names).toContain('元旦');
  });

  it('结果按日期升序（用户端当时间轴展示）', () => {
    const dates = allFestivalsOf(2026).map((item) => item.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it('每个节日都带英文名与风格提示（生题 prompt 要用）', () => {
    for (const item of allFestivalsOf(2026)) {
      expect(item.nameEn.length).toBeGreaterThan(0);
      expect(item.styleHint.length).toBeGreaterThan(0);
    }
  });

  it('覆盖全年主要节日（一个都不能漏）', () => {
    const names = allFestivalsOf(2026).map((item) => item.name);
    for (const expected of [
      '元旦',
      '春节',
      '元宵节',
      '情人节',
      '妇女节',
      '清明节',
      '愚人节',
      '劳动节',
      '儿童节',
      '端午节',
      '父亲节',
      '母亲节',
      '中秋节',
      '教师节',
      '国庆节',
      '重阳节',
      '万圣节',
      '感恩节',
      '平安夜',
      '圣诞节',
      '跨年夜',
    ]) {
      expect(names).toContain(expected);
    }
  });
});

describe('festivalEntryOf（按名取条目）', () => {
  it('取到英文名与风格提示', () => {
    expect(festivalEntryOf('万圣节', 2026)?.nameEn).toBe('Halloween');
    expect(festivalEntryOf('万圣节', 2026)?.styleHint).toContain('pumpkin');
  });

  it('取不到时返回 null', () => {
    expect(festivalEntryOf('不存在的节日', 2026)).toBeNull();
  });
});

/**
 * 节日封面提示词。
 *
 * 封面必须是**每个节日都有一张专属主视觉**：用户端题库页的节日卡片要「一眼看出是
 * 哪个节日」，而题图只体现氛围（元旦=两人喝热饮、春节=提行李出门，用户反馈不贴合）。
 * 所以这张表必须**跟着节日清单同步**：新增节日忘了写封面提示词，封面就会缺一块。
 */
describe('festivalCoverPromptOf（节日封面提示词）', () => {
  it('全年每个节日都有专属封面提示词', () => {
    const missing = allFestivalsOf(2026)
      .map((entry) => entry.name)
      .filter((name) => {
        const prompt = festivalCoverPromptOf(name);
        return prompt === null || prompt.trim().length === 0;
      });
    expect(missing).toEqual([]);
  });

  it('提示词写明节日的标志性元素（能认出是哪个节日）', () => {
    // 每个节日的关键词：模型要看到这些物件/场景才画得出该节日
    const expected: Array<[string, string]> = [
      ['元旦', 'fireworks'],
      ['春节', 'lantern'],
      ['元宵节', 'lantern'],
      ['情人节', 'rose'],
      ['端午节', 'dragon boat'],
      ['中秋节', 'moon'],
      ['万圣节', 'pumpkin'],
      ['圣诞节', 'Christmas'],
      ['跨年夜', 'fireworks'],
      ['重阳节', 'chrysanthemum'],
    ];
    for (const [name, keyword] of expected) {
      expect(festivalCoverPromptOf(name)).toContain(keyword);
    }
  });

  it('提示词不要求画面出现文字（模型画字必是乱码，且审核会判不通过）', () => {
    for (const entry of allFestivalsOf(2026)) {
      const prompt = festivalCoverPromptOf(entry.name);
      expect(prompt).not.toBeNull();
      // 提示词里不能出现「写上 XX 字」「写着 XX」这类要求模型画字的表述
      expect(prompt ?? '').not.toMatch(/\b(says?|reads?|with the words?|spelled)\b/i);
    }
  });

  it('未知节日返回 null（不猜提示词）', () => {
    expect(festivalCoverPromptOf('不存在的节日')).toBeNull();
  });
});
