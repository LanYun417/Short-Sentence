import { describe, expect, it } from 'vitest';

import { buildPosterModel, posterHeight, type WeeklyPosterReport } from '~/composables/useWeeklyPoster';

/**
 * 周报海报的展示模型（Web 端手绘 Canvas 的数据层）。
 *
 * 守三条：
 * 1. 主指标口径与卡片/分享文案一致（正确率四舍五入、活跃天数带 /7）；
 * 2. 柱状归一按本周峰值，空数据不除零；
 * 3. 次级信息「有值才出现」，与上周对比恒出现（0 也要说「持平/0 题」）。
 */

function report(overrides: Partial<WeeklyPosterReport> = {}): WeeklyPosterReport {
  return {
    answered: 42,
    correct: 30,
    accuracy: 30 / 42,
    activeDays: 5,
    xpGained: 210,
    newAchievements: 2,
    streak: 7,
    daily: [
      { date: '2026-11-09', weekday: '周一', answered: 10, correct: 8 },
      { date: '2026-11-10', weekday: '周二', answered: 20, correct: 12 },
      { date: '2026-11-11', weekday: '周三', answered: 0, correct: 0 },
      { date: '2026-11-12', weekday: '周四', answered: 12, correct: 10 },
      { date: '2026-11-13', weekday: '周五', answered: 0, correct: 0 },
      { date: '2026-11-14', weekday: '周六', answered: 0, correct: 0 },
      { date: '2026-11-15', weekday: '周日', answered: 0, correct: 0 },
    ],
    topCategory: { name: '职场沟通', count: 18 },
    prevAnswered: 35,
    deltaAnswered: 7,
    ...overrides,
  };
}

describe('buildPosterModel', () => {
  it('主指标与卡片同口径（正确率四舍五入、活跃天数 /7）', () => {
    const model = buildPosterModel(report());
    expect(model.stats).toEqual([
      { value: '42', label: '本周答题' },
      { value: '71%', label: '正确率' },
      { value: '5/7', label: '活跃天数' },
    ]);
  });

  it('柱状按本周峰值归一，空日为零、答对占比可叠加', () => {
    const model = buildPosterModel(report());
    // 峰值 20 → 周二 ratio=1，答对 12/20=0.6
    expect(model.days[1]).toEqual({ label: '二', ratio: 1, correctRatio: 0.6 });
    expect(model.days[2]).toEqual({ label: '三', ratio: 0, correctRatio: 0 });
  });

  it('次级信息有值才出现；与上周对比恒出现', () => {
    const full = buildPosterModel(report());
    expect(full.lines).toContain('新解锁 2 个成就');
    expect(full.lines).toContain('连续打卡 7 天');
    expect(full.lines).toContain('最常练「职场沟通」（18 题）');
    expect(full.lines.at(-1)).toBe('比上周多 7 题');

    const bare = buildPosterModel(report({ newAchievements: 0, streak: 0, topCategory: null, deltaAnswered: -3 }));
    expect(bare.lines.some((line) => line.includes('成就'))).toBe(false);
    expect(bare.lines.some((line) => line.includes('连续打卡'))).toBe(false);
    expect(bare.lines.some((line) => line.includes('最常练'))).toBe(false);
    expect(bare.lines.at(-1)).toBe('比上周少 3 题');
  });

  it('全空数据不除零，海报高度随信息行收缩', () => {
    const empty = buildPosterModel(
      report({
        answered: 0,
        correct: 0,
        accuracy: 0,
        activeDays: 0,
        xpGained: 0,
        newAchievements: 0,
        streak: 0,
        daily: [],
        topCategory: null,
        prevAnswered: 0,
        deltaAnswered: 0,
      }),
    );
    expect(empty.days).toEqual([]);
    expect(empty.lines).toEqual(['本周获得 0 经验', '比上周多 0 题']);
    expect(posterHeight(empty)).toBeLessThan(posterHeight(buildPosterModel(report())));
  });
});
