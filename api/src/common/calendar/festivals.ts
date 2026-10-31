/**
 * 节日表：公历固定节日 + 农历节日。
 *
 * 设计原则：**宁缺勿错**。
 * 农历节日在公历上的日期每年不同，需要精确的农历数据。网上流传的对照表
 * 互相矛盾（同一年的重阳节能搜到 10/18、10/19、10/20 三个版本），
 * 而本项目有「零第三方运行时依赖」约束（见 scripts/deps-guard.mjs），
 * 不能引 lunar-javascript 之类的库。因此这里用**可维护的数据表**：
 * - 只收录经过交叉验证的日期；
 * - 表里没有的年份，那天自动回落成「随机风格」，**不会出错**；
 * - 每年补录时只需在 LUNAR_FESTIVALS 里加一行。
 *
 * 公历节日不受此影响：日期固定（或规则明确，如「5 月第二个周日」），
 * 可以永远可靠地算出来。
 */

/** 节日类别：决定文案与配图的风格走向。 */
export type FestivalKind = 'cn-traditional' | 'cn-solar' | 'international';

/** 命中的节日信息。 */
export interface FestivalHit {
  /** 节日中文名，如「重阳节」 */
  name: string;
  /** 节日英文名，用于 prompt */
  nameEn: string;
  kind: FestivalKind;
  /**
   * 风格提示（英文，直接进 prompt）。
   * 描述这个节日该有的意象、配色与情绪，让模型不必自己猜。
   */
  styleHint: string;
}

/* ------------------------------ 公历固定节日 ------------------------------ */

/** 月/日 固定的节日。key 形如 `MM-DD`。 */
const FIXED_FESTIVALS: Readonly<Record<string, FestivalHit>> = {
  '01-01': {
    name: '元旦',
    nameEn: "New Year's Day",
    kind: 'international',
    styleHint:
      'a fresh start: clean morning light, a new notebook, frost on a window, hopeful and crisp palette of pale blue and white',
  },
  '02-14': {
    name: '情人节',
    nameEn: "Valentine's Day",
    kind: 'international',
    styleHint:
      'tender and intimate but NOT cliché: two cups, a folded note, soft pink and cream, warm candlelight, no hearts-and-roses cliché',
  },
  '03-08': {
    name: '妇女节',
    nameEn: "International Women's Day",
    kind: 'international',
    styleHint:
      'strength and warmth: a woman at work or in her own space, confident posture, spring flowers, warm rose and green palette',
  },
  '04-01': {
    name: '愚人节',
    nameEn: "April Fool's Day",
    kind: 'international',
    styleHint:
      'playful and slightly mischievous: a swapped object, a tiny prank, bright saturated colors, cheerful and light',
  },
  '05-01': {
    name: '劳动节',
    nameEn: 'Labour Day',
    kind: 'international',
    styleHint: 'the dignity of work: hands, tools, a finished task, warm daylight, honest earthy palette',
  },
  '06-01': {
    name: '儿童节',
    nameEn: "Children's Day",
    kind: 'international',
    styleHint: 'innocent joy: a child chasing bubbles, crayons, a paper plane, bright candy colors, simple and buoyant',
  },
  '09-10': {
    name: '教师节',
    nameEn: "Teachers' Day",
    kind: 'cn-solar',
    styleHint: 'gratitude for teaching: chalk dust in light, an open book with notes, a red pen, warm study palette',
  },
  '10-01': {
    name: '国庆节',
    nameEn: 'National Day',
    kind: 'cn-solar',
    styleHint: 'wide open skies, autumn air, a city dressed in red, a sense of scale and pride, warm red and gold',
  },
  '10-31': {
    name: '万圣节',
    nameEn: 'Halloween',
    kind: 'international',
    styleHint:
      'playful spooky, NOT scary: carved pumpkins, paper bats, candlelit porch, orange and deep purple palette, storybook friendly',
  },
  '12-24': {
    name: '平安夜',
    nameEn: 'Christmas Eve',
    kind: 'international',
    styleHint: 'quiet warmth: a lit window, a knitted scarf, snowfall outside, deep green and warm amber',
  },
  '12-25': {
    name: '圣诞节',
    nameEn: 'Christmas',
    kind: 'international',
    styleHint: 'cozy celebration: a small tree with lights, a wrapped parcel, cocoa steam, green red and cream',
  },
  '12-31': {
    name: '跨年夜',
    nameEn: "New Year's Eve",
    kind: 'international',
    styleHint:
      'the last hour of the year: city lights, a countdown, reflection and hope, deep blue with warm gold accents',
  },
};

/* ------------------------------ 浮动公历节日 ------------------------------ */

/**
 * 「某月第 n 个周几」型节日。
 * 例：母亲节 = 5 月第二个周日；父亲节 = 6 月第三个周日；感恩节 = 11 月第四个周四。
 */
interface FloatingFestival {
  month: number; // 1~12
  /** 第几个（1-based） */
  ordinal: number;
  /** 周几：0=周日 … 6=周六 */
  weekday: number;
  hit: FestivalHit;
}

const FLOATING_FESTIVALS: readonly FloatingFestival[] = [
  {
    month: 5,
    ordinal: 2,
    weekday: 0,
    hit: {
      name: '母亲节',
      nameEn: "Mother's Day",
      kind: 'international',
      styleHint:
        'tenderness between generations: hands passing a cup, a kitchen window, soft morning light, warm peach and sage',
    },
  },
  {
    month: 6,
    ordinal: 3,
    weekday: 0,
    hit: {
      name: '父亲节',
      nameEn: "Father's Day",
      kind: 'international',
      styleHint: 'quiet support: a worn armchair, a toolbox, a shared silence, muted brown and blue',
    },
  },
  {
    month: 11,
    ordinal: 4,
    weekday: 4,
    hit: {
      name: '感恩节',
      nameEn: 'Thanksgiving',
      kind: 'international',
      styleHint: 'harvest gratitude: a long table, autumn produce, candlelight, amber and rust palette',
    },
  },
];

/* ------------------------------ 农历节日 ------------------------------ */

/**
 * 清明：**既是节气又是节日**。
 *
 * 日期由节气算法决定（每年 4/4 或 4/5），所以不能放进固定日期表；
 * 但它的文化语义是「节日」（中国四大传统节日之一、法定节假日），
 * 因此单独定义一份 FestivalHit，由 day-context 在命中「清明」节气时取用。
 */
export const QINGMING_FESTIVAL: FestivalHit = {
  name: '清明节',
  nameEn: 'Qingming Festival',
  kind: 'cn-traditional',
  styleHint:
    'clear spring remembrance: willows by water, a light drizzle, green hills, gentle and quiet but not sorrowful, fresh green and misty white',
};

/**
 * 农历节日的公历日期表（按年维护）。
 *
 * **数据可靠性说明**：农历节日无法用简单公式算出，必须依赖农历数据。
 * 这里只收录经过交叉验证的日期（例如 2026 年重阳节 10-18 由多个来源
 * 与当天实际日历播报确认）。表里缺失的年份会**自动回落随机风格**，
 * 因此「漏录」只会少一次节日卡，不会生成错误日期的卡片。
 *
 * 补录方式：在对应年份下加一行即可，格式 `'MM-DD': 节日名`。
 */
const LUNAR_FESTIVALS: Readonly<Record<number, Readonly<Record<string, FestivalHit>>>> = {
  2026: {
    '02-17': {
      name: '春节',
      nameEn: 'Chinese New Year',
      kind: 'cn-traditional',
      styleHint:
        'reunion and red: lanterns, tangerines, a red envelope on a table, warm red and gold, family warmth without cliché',
    },
    '03-03': {
      name: '元宵节',
      nameEn: 'Lantern Festival',
      kind: 'cn-traditional',
      styleHint:
        'glowing lanterns at night, glutinous rice balls in a bowl, a riddle on paper, warm amber against deep blue',
    },
    '10-18': {
      name: '重阳节',
      nameEn: 'Double Ninth Festival',
      kind: 'cn-traditional',
      styleHint:
        'climbing high in autumn: chrysanthemums, a distant ridge, tea on a stone table, golden and deep green',
    },
  },
};

/* ------------------------------ 对外接口 ------------------------------ */

/** 补零成两位。 */
function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

/** 把日期转成 `MM-DD`。 */
export function monthDayKey(date: Date): string {
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * 查询某天命中的节日。
 *
 * 优先级：农历节日 > 固定公历节日 > 浮动公历节日。
 * （农历节日更「本地」，同一天撞车时优先它。）
 */
export function festivalOf(date: Date): FestivalHit | null {
  const key = monthDayKey(date);

  // 1) 农历节日（按年查表）
  const lunar = LUNAR_FESTIVALS[date.getFullYear()]?.[key];
  if (lunar) {
    return lunar;
  }

  // 2) 固定公历节日
  const fixed = FIXED_FESTIVALS[key];
  if (fixed) {
    return fixed;
  }

  // 3) 浮动公历节日（某月第 n 个周几）
  const month = date.getMonth() + 1;
  const weekday = date.getDay();
  const day = date.getDate();
  for (const item of FLOATING_FESTIVALS) {
    if (item.month !== month || item.weekday !== weekday) {
      continue;
    }
    // 是本月第几个该周几
    const ordinal = Math.ceil(day / 7);
    if (ordinal === item.ordinal) {
      return item.hit;
    }
  }

  return null;
}

/** 已收录农历节日的年份（供运营自查「今年补录了没」）。 */
export function lunarFestivalYears(): number[] {
  return Object.keys(LUNAR_FESTIVALS)
    .map(Number)
    .sort((a, b) => a - b);
}

/** 全部节日名的缓存（节日表是静态的，算一次即可）。 */
let festivalNameCache: Set<string> | null = null;

/**
 * 全部节日名（公历固定 + 浮动 + 农历 + 清明）。
 *
 * 用途：节日题库会给每个节日建一个场景分类（如「春节」），
 * 日常生题的主题必须把这些分类排除掉，否则一年四季都在出节日题。
 */
export function festivalNameSet(): Set<string> {
  if (!festivalNameCache) {
    const names = new Set<string>();
    for (const hit of Object.values(FIXED_FESTIVALS)) {
      names.add(hit.name);
    }
    for (const item of FLOATING_FESTIVALS) {
      names.add(item.hit.name);
    }
    for (const year of Object.values(LUNAR_FESTIVALS)) {
      for (const hit of Object.values(year)) {
        names.add(hit.name);
      }
    }
    names.add(QINGMING_FESTIVAL.name);
    festivalNameCache = names;
  }
  return festivalNameCache;
}

/** 该名称是否是节日（节日分类不进入日常生题主题）。 */
export function isFestivalName(name: string): boolean {
  return festivalNameSet().has(name);
}
