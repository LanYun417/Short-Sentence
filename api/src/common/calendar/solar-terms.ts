/**
 * 二十四节气（纯算法，零依赖）。
 *
 * 为什么自己算而不是查表：节气是按太阳黄经定义的，每年在公历上的日期
 * 会浮动 1~2 天（例如清明在 4/4 或 4/5）。写死一张表，过了几年就得补，
 * 且容易补错。用「寿星公式」可以在 1900~2100 区间内直接算出日期，
 * 精度到日，不需要任何数据维护。
 *
 * 公式来源：通用节气计算公式（寿星公式），
 * `minutes = 31556925974.7 × (year − 1900) + sTermInfo[n] × 60000 + Date.UTC(1900,0,6,2,5)`。
 * 该式在 1900~2100 内与天文台数据一致（个别年份可能差 1 天，
 * 对「今天是哪个节气」的判定足够）。
 *
 * 注意：本项目有「零第三方运行时依赖」的约束（见 scripts/deps-guard.mjs），
 * 所以不能用 lunar-javascript 之类的库，只能自己实现。
 */

/** 各节气相对基准的分钟偏移（顺序：小寒、大寒、立春……冬至）。 */
const SOLAR_TERM_MINUTES: readonly number[] = [
  0, 21208, 42467, 63836, 85337, 107014, 128867, 150921, 173149, 195551, 218072, 240693, 263343, 285989, 308563, 331033,
  353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758,
];

/** 节气名（下标与 SOLAR_TERM_MINUTES 对齐）。 */
export const SOLAR_TERM_NAMES: readonly string[] = [
  '小寒',
  '大寒',
  '立春',
  '雨水',
  '惊蛰',
  '春分',
  '清明',
  '谷雨',
  '立夏',
  '小满',
  '芒种',
  '夏至',
  '小暑',
  '大暑',
  '立秋',
  '处暑',
  '白露',
  '秋分',
  '寒露',
  '霜降',
  '立冬',
  '小雪',
  '大雪',
  '冬至',
];

/**
 * 计算某年第 index 个节气的公历日期。
 *
 * @param year 公历年份（1900~2100）
 * @param index 0~23，对应 SOLAR_TERM_NAMES 的下标
 * @returns 该节气的日期（本地时区，只保证年月日正确）
 */
export function solarTermDate(year: number, index: number): Date {
  const offset = SOLAR_TERM_MINUTES[index];
  if (offset === undefined) {
    throw new RangeError(`节气下标越界：${index}（应为 0~23）`);
  }
  const utc = 31556925974.7 * (year - 1900) + offset * 60000 + Date.UTC(1900, 0, 6, 2, 5);
  const date = new Date(utc);
  // 用本地年月日构造，避免时区把日期推前/推后一天
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** 命中的节气信息。 */
export interface SolarTermHit {
  /** 节气名，如「霜降」 */
  name: string;
  /** 在该年第几个节气（0~23） */
  index: number;
}

/**
 * 判断某天是否正好是节气。
 *
 * @param date 待判断的日期
 * @returns 命中则返回节气信息，否则 null
 */
export function solarTermOf(date: Date): SolarTermHit | null {
  const year = date.getFullYear();
  const month = date.getMonth();
  // 每月固定两个节气：第 month*2 个与第 month*2+1 个
  for (const index of [month * 2, month * 2 + 1]) {
    const termDate = solarTermDate(year, index);
    if (
      termDate.getFullYear() === year &&
      termDate.getMonth() === date.getMonth() &&
      termDate.getDate() === date.getDate()
    ) {
      return { name: SOLAR_TERM_NAMES[index]!, index };
    }
  }
  return null;
}
