import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_SEEDS } from '../src/prisma/seed.service.js';
import { ACHIEVEMENT_CONDITIONS } from '../src/modules/client/gamify/gamify.service.js';

/**
 * 成就目录完整性。
 *
 * 背景：成就的「定义」在种子表、「判定」在 GamifyService 的 CONDITIONS 里，
 * 靠 code 关联。**只加一边不会报错**——只加定义则该勋章永远解不开（静默失效），
 * 只加判定则是永远走不到的死代码。用测试把两边钉在一起。
 */

/** 全零上下文：新用户还没答题时的样子。 */
const EMPTY_CONTEXT = {
  answerCount: 0,
  correctCount: 0,
  favoriteCount: 0,
  streak: 0,
  unlockedCategories: 0,
  totalCategories: 14,
  xp: 0,
  todayAnswerCount: 0,
  todayCorrectCount: 0,
  checkinTotal: 0,
  inTeam: false,
  teamStreak: 0,
  clearedStages: 0,
  stageTotal: 14,
  bestRank: Number.POSITIVE_INFINITY,
};

/** 全满上下文：各项都远超阈值。 */
const MAX_CONTEXT = {
  answerCount: 99_999,
  correctCount: 99_999,
  favoriteCount: 99_999,
  streak: 9_999,
  unlockedCategories: 14,
  totalCategories: 14,
  xp: 99_999,
  todayAnswerCount: 99_999,
  todayCorrectCount: 99_999,
  checkinTotal: 99_999,
  inTeam: true,
  teamStreak: 9_999,
  clearedStages: 14,
  stageTotal: 14,
  bestRank: 1,
};

describe('成就目录', () => {
  it('每条成就定义都有判定条件（否则永远解锁不了）', () => {
    for (const item of ACHIEVEMENT_SEEDS) {
      expect(ACHIEVEMENT_CONDITIONS[item.code], `成就 ${item.code} 缺少判定条件`).toBeTypeOf('function');
    }
  });

  it('每个判定条件都有对应定义（否则是不会被解锁的死代码）', () => {
    const codes = new Set(ACHIEVEMENT_SEEDS.map((item) => item.code));
    for (const code of Object.keys(ACHIEVEMENT_CONDITIONS)) {
      expect(codes.has(code), `判定条件 ${code} 没有对应的成就定义`).toBe(true);
    }
  });

  it('code 与 sort 都不重复（排序错乱会让勋章墙顺序漂移）', () => {
    expect(new Set(ACHIEVEMENT_SEEDS.map((item) => item.code)).size).toBe(ACHIEVEMENT_SEEDS.length);
    expect(new Set(ACHIEVEMENT_SEEDS.map((item) => item.sort)).size).toBe(ACHIEVEMENT_SEEDS.length);
  });

  it('零状态下没有任何成就成立（不能一注册就白送奖励）', () => {
    const unlocked = ACHIEVEMENT_SEEDS.filter((item) => ACHIEVEMENT_CONDITIONS[item.code](EMPTY_CONTEXT));
    expect(unlocked.map((item) => item.code)).toEqual([]);
  });

  it('全满状态下所有成就都成立（判定方向没写反）', () => {
    const locked = ACHIEVEMENT_SEEDS.filter((item) => !ACHIEVEMENT_CONDITIONS[item.code](MAX_CONTEXT));
    expect(locked.map((item) => item.code)).toEqual([]);
  });

  it('排行榜成就各认各的维度（累计值不能顶替今日值，名次默认不点亮）', () => {
    const lazy = {
      ...EMPTY_CONTEXT,
      answerCount: 999,
      correctCount: 999,
      streak: 999,
    };
    const codes = [
      'today_answer_20',
      'today_answer_50',
      'today_correct_15',
      'today_correct_30',
      'checkin_total_30',
      'checkin_total_100',
      'rank_top100',
      'rank_top10',
      'rank_top3',
      'rank_first',
    ];
    for (const code of codes) {
      expect(ACHIEVEMENT_CONDITIONS[code](lazy), `${code} 不该被累计值/默认名次误解锁`).toBe(false);
    }

    const onBoard = { ...EMPTY_CONTEXT, todayAnswerCount: 20, todayCorrectCount: 30, checkinTotal: 30, bestRank: 3 };
    expect(ACHIEVEMENT_CONDITIONS.today_answer_20(onBoard)).toBe(true);
    expect(ACHIEVEMENT_CONDITIONS.today_answer_50(onBoard)).toBe(false);
    expect(ACHIEVEMENT_CONDITIONS.today_correct_15(onBoard)).toBe(true);
    expect(ACHIEVEMENT_CONDITIONS.today_correct_30(onBoard)).toBe(true);
    expect(ACHIEVEMENT_CONDITIONS.checkin_total_30(onBoard)).toBe(true);
    expect(ACHIEVEMENT_CONDITIONS.checkin_total_100(onBoard)).toBe(false);
    expect(ACHIEVEMENT_CONDITIONS.rank_top100(onBoard)).toBe(true);
    expect(ACHIEVEMENT_CONDITIONS.rank_top10(onBoard)).toBe(true);
    expect(ACHIEVEMENT_CONDITIONS.rank_top3(onBoard)).toBe(true);
    expect(ACHIEVEMENT_CONDITIONS.rank_first(onBoard)).toBe(false);
    expect(ACHIEVEMENT_CONDITIONS.rank_first({ ...onBoard, bestRank: 1 })).toBe(true);
  });

  it('首次上榜 / 十强按名次逐级点亮，百名外不点亮', () => {
    const rankCodes = ['rank_top100', 'rank_top10', 'rank_top3', 'rank_first'];
    const lit = (bestRank: number): string[] =>
      rankCodes.filter((code) => ACHIEVEMENT_CONDITIONS[code]({ ...EMPTY_CONTEXT, bestRank }));
    expect(lit(Number.POSITIVE_INFINITY)).toEqual([]);
    expect(lit(101)).toEqual([]);
    expect(lit(100)).toEqual(['rank_top100']);
    expect(lit(50)).toEqual(['rank_top100']);
    expect(lit(10)).toEqual(['rank_top100', 'rank_top10']);
    expect(lit(3)).toEqual(['rank_top100', 'rank_top10', 'rank_top3']);
    expect(lit(1)).toEqual(rankCodes);
  });

  it('奖励经验与图标名都填了（空值会让勋章墙空白）', () => {
    for (const item of ACHIEVEMENT_SEEDS) {
      expect(item.icon.trim().length, `${item.code} 缺图标`).toBeGreaterThan(0);
      expect(item.name.trim().length, `${item.code} 缺名称`).toBeGreaterThan(0);
      expect(item.description.trim().length, `${item.code} 缺描述`).toBeGreaterThan(0);
      expect(item.rewardXp, `${item.code} 奖励经验应为正数`).toBeGreaterThan(0);
    }
  });
});
