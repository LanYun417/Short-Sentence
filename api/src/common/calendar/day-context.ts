/**
 * 日期语境：给「这一天」一个可解释的主题倾向。
 *
 * 供句签生成使用：命中节日/节气 → 按节日风格生成；都没有 → 走随机维度。
 *
 * 为什么要单独一层：节日与节气是两套体系（公历 vs 太阳黄经），
 * 且优先级需要明确（节日 > 节气：节日的文化指向更强，用户期待更具体）。
 * 把判定收在一处，生成侧只关心「今天是什么语境」，不必知道底层规则。
 */
import { QINGMING_FESTIVAL, festivalOf, type FestivalHit } from './festivals.js';
import { solarTermOf } from './solar-terms.js';

/** 日期语境类型。 */
export type DayContextKind = 'festival' | 'solar-term' | 'ordinary';

/** 一天的语境。 */
export interface DayContext {
  kind: DayContextKind;
  /** 展示名（节日名 / 节气名 / 空） */
  name: string;
  /** 英文名（进 prompt 用；节气为拼音） */
  nameEn: string;
  /**
   * 风格提示（英文，进 prompt）。
   * ordinary 时为空字符串——那时交给随机维度清单。
   */
  styleHint: string;
  /** 日期（YYYY-MM-DD） */
  date: string;
}

/** 节气名的拼音（用于英文 prompt，避免模型不认识中文）。 */
const SOLAR_TERM_PINYIN: Readonly<Record<string, string>> = {
  小寒: 'Minor Cold',
  大寒: 'Major Cold',
  立春: 'Start of Spring',
  雨水: 'Rain Water',
  惊蛰: 'Awakening of Insects',
  春分: 'Spring Equinox',
  清明: 'Pure Brightness',
  谷雨: 'Grain Rain',
  立夏: 'Start of Summer',
  小满: 'Grain Buds',
  芒种: 'Grain in Ear',
  夏至: 'Summer Solstice',
  小暑: 'Minor Heat',
  大暑: 'Major Heat',
  立秋: 'Start of Autumn',
  处暑: 'End of Heat',
  白露: 'White Dew',
  秋分: 'Autumn Equinox',
  寒露: 'Cold Dew',
  霜降: 'Frost Descent',
  立冬: 'Start of Winter',
  小雪: 'Minor Snow',
  大雪: 'Major Snow',
  冬至: 'Winter Solstice',
};

/** 节气 → 风格提示。节气是「自然节律」，风格要贴物候而非民俗。 */
const SOLAR_TERM_STYLE: Readonly<Record<string, string>> = {
  小寒: 'deep winter cold, bare branches, breath visible in the air, pale grey and blue',
  大寒: 'the coldest days, frost patterns on glass, still air, muted white and steel',
  立春: 'the first thaw, a green shoot in soil, thin sunlight, pale green and cream',
  雨水: 'spring rain on stone, wet umbrellas, budding twigs, soft grey-green',
  惊蛰: 'awakening earth, an insect on a leaf, the first thunder, fresh green',
  春分: 'balanced light, blossoms and shadow of equal length, soft pink and light green',
  清明: 'clear spring air, willows by water, a light drizzle, fresh green and misty white',
  谷雨: 'grain-feeding rain, wet fields, tea leaves, deep green and earth brown',
  立夏: 'the start of heat, new leaves fully out, a cold drink, bright green and white',
  小满: 'grain filling out, a breeze through wheat, warm yellow-green',
  芒种: 'busy planting season, a field of seedlings, sweat and sunlight, vivid green and gold',
  夏至: 'the longest day, high sun, deep shade, saturated green and white glare',
  小暑: 'rising heat, a fan, watermelon slices, bright yellow and cool shade',
  大暑: 'peak summer, heat shimmer, a shaded courtyard, intense light and deep shadow',
  立秋: 'the turn of summer, one yellowing leaf, still-warm light, gold and green',
  处暑: 'heat retreating, evening cool, cicadas fading, dusty gold',
  白露: 'dew on grass at dawn, thin mist, a light cardigan, silver and pale blue',
  秋分: 'equal day and night, clear high sky, harvested fields, amber and blue',
  寒露: 'cold dew, chrysanthemums opening, a warm cup, deep gold and cool grey',
  霜降: 'first frost, frosted leaves, a quiet field, white rime and russet',
  立冬: 'winter begins, the last leaves down, a warm bowl, muted brown and grey',
  小雪: 'first snowflakes, a scarf, grey sky, soft white and pale blue',
  大雪: 'heavy snow, muffled streets, warm window light, white and deep blue',
  冬至: 'the shortest day, dumplings or tangyuan on a table, warm lamp in early dark, cream and amber',
};

/** 补零。 */
function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

/** Date → YYYY-MM-DD（本地时区）。 */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * 解析 `YYYY-MM-DD` 为本地 Date（避免 `new Date('2026-10-18')` 被当成 UTC 而退一天）。
 */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/**
 * 取某天的语境。
 *
 * 优先级：**节日 > 节气 > 普通日**。
 * 节日优先是因为它的文化指向更强（用户对「中秋」有明确预期），
 * 而节气只是自然节律；同一天撞车时（如清明既是节气又是节日）按节日走。
 */
export function dayContextOf(date: Date): DayContext {
  const key = toDateKey(date);

  const festival: FestivalHit | null = festivalOf(date);
  if (festival) {
    return {
      kind: 'festival',
      name: festival.name,
      nameEn: festival.nameEn,
      styleHint: festival.styleHint,
      date: key,
    };
  }

  const term = solarTermOf(date);
  if (term) {
    // 清明是唯一「既是节气又是节日」的：日期由节气算法给出，
    // 但语义按节日处理（四大传统节日 + 法定假日）。
    if (term.name === '清明') {
      return {
        kind: 'festival',
        name: QINGMING_FESTIVAL.name,
        nameEn: QINGMING_FESTIVAL.nameEn,
        styleHint: QINGMING_FESTIVAL.styleHint,
        date: key,
      };
    }
    return {
      kind: 'solar-term',
      name: term.name,
      nameEn: SOLAR_TERM_PINYIN[term.name] ?? term.name,
      styleHint: SOLAR_TERM_STYLE[term.name] ?? '',
      date: key,
    };
  }

  return { kind: 'ordinary', name: '', nameEn: '', styleHint: '', date: key };
}
