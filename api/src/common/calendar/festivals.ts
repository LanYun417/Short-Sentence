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

import { solarTermDate } from './solar-terms.js';

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
/* ------------------- 农历节日定义（各年只记日期，风格复用） ------------------- */

/** 春节。 */
const SPRING_FESTIVAL: FestivalHit = {
  name: '春节',
  nameEn: 'Chinese New Year',
  kind: 'cn-traditional',
  styleHint:
    'reunion and red: lanterns, tangerines, a red envelope on a table, warm red and gold, family warmth without cliché',
};

/** 元宵节。 */
const LANTERN_FESTIVAL: FestivalHit = {
  name: '元宵节',
  nameEn: 'Lantern Festival',
  kind: 'cn-traditional',
  styleHint:
    'glowing lanterns at night, glutinous rice balls in a bowl, a riddle on paper, warm amber against deep blue',
};

/** 端午节。 */
const DRAGON_BOAT_FESTIVAL: FestivalHit = {
  name: '端午节',
  nameEn: 'Dragon Boat Festival',
  kind: 'cn-traditional',
  styleHint:
    'dragon boats on a river, zongzi wrapped in bamboo leaves, mugwort hung by the door, vivid green and warm red',
};

/** 中秋节。 */
const MID_AUTUMN_FESTIVAL: FestivalHit = {
  name: '中秋节',
  nameEn: 'Mid-Autumn Festival',
  kind: 'cn-traditional',
  styleHint:
    'a full moon over rooftops, mooncakes on a table, paper lanterns, family reunion, warm amber and deep blue',
};

/** 重阳节。 */
const DOUBLE_NINTH_FESTIVAL: FestivalHit = {
  name: '重阳节',
  nameEn: 'Double Ninth Festival',
  kind: 'cn-traditional',
  styleHint: 'climbing high in autumn: chrysanthemums, a distant ridge, tea on a stone table, golden and deep green',
};

/**
 * 农历节日的公历日期表（按年维护）。
 *
 * **数据可靠性说明**：农历节日无法用简单公式算出，必须依赖农历数据。
 * 这里只收录经过交叉验证的日期（例如 2026 年重阳节 10-18 由多个来源
 * 与当天实际日历播报确认）。表里缺失的年份会**自动回落随机风格**，
 * 因此「漏录」只会少一次节日卡，不会生成错误日期的卡片。
 *
 * 已核对来源（2026-10-31）：
 * - 2026 端午 6/19、中秋 9/25：国务院办公厅《关于 2026 年部分节假日安排的通知》；
 * - 2027 春节 2/6、元宵 2/20、端午 6/9、中秋 9/15、重阳 10/8：香港特区政府宪报
 *   2027 年公众假期 + 农历日历站交叉一致。
 *
 * 补录方式：在对应年份下加一行即可，格式 `'MM-DD': 节日常量`。
 */
const LUNAR_FESTIVALS: Readonly<Record<number, Readonly<Record<string, FestivalHit>>>> = {
  2026: {
    '02-17': SPRING_FESTIVAL,
    '03-03': LANTERN_FESTIVAL,
    '06-19': DRAGON_BOAT_FESTIVAL,
    '09-25': MID_AUTUMN_FESTIVAL,
    '10-18': DOUBLE_NINTH_FESTIVAL,
  },
  2027: {
    '02-06': SPRING_FESTIVAL,
    '02-20': LANTERN_FESTIVAL,
    '06-09': DRAGON_BOAT_FESTIVAL,
    '09-15': MID_AUTUMN_FESTIVAL,
    '10-08': DOUBLE_NINTH_FESTIVAL,
  },
};

/* ------------------------------ 节日封面图 ------------------------------ */

/**
 * 节日**专属封面图**提示词：每个节日一张主视觉。
 *
 * 为什么不能复用 `styleHint`：styleHint 是给「日常场景句子」定调的（只描述氛围与
 * 配色），照它生成的题图往往只有氛围、看不出是哪个节日——元旦成了「两人沙发喝热饮」、
 * 春节成了「女人提行李出门」（2026-11-01 用户反馈「封面不贴合节日」）。
 *
 * 封面要的是**一眼认得出的标志性元素**：红灯笼 / 龙舟 / 圣诞树 / 南瓜灯……
 * 所以单独维护这张表，与 styleHint 解耦（改题图风格不影响封面）。
 *
 * 约束：
 * - **不出现文字**：模型画字必是乱码，且图像审核会把「以文字为主体」判不通过；
 *   需要表达「年份/数字」时改用不含字形的实物（钟面、烛台、灯串）。
 * - 人物出现时写明构成（避免生图模型随机出两个男性——情人节已出过这种事故）。
 */
const FESTIVAL_COVER_PROMPTS: Readonly<Record<string, string>> = {
  元旦: 'midnight New Year celebration: golden fireworks bursting over a city skyline, a clock tower striking midnight, silver confetti and streamers drifting in the air, a glass of sparkling champagne on a windowsill, crisp gold and deep blue palette',
  春节: 'Chinese New Year still life: rows of big red lanterns hanging overhead, red couplet papers on a wooden doorway, a round table with steaming dumplings and red envelopes, paper-cut window decorations, warm red and gold palette',
  元宵节:
    'a night street lined with glowing red and gold lanterns, a bowl of sweet tangyuan dumplings on a wooden table, a rabbit-shaped lantern floating above, deep blue night with warm amber glow',
  情人节:
    'a tender Valentine still life: two lit candles on a small table, a single red rose and a folded card, a heart-shaped box of chocolates, soft pink and cream palette, warm candlelight',
  妇女节:
    'a bright office desk beside a large window with a bouquet of tulips and sunflowers in a vase, spring blossoms visible outside the glass, a silk ribbon tied on the vase, warm rose and green palette',
  清明节:
    'Qingming spring remembrance: slender willow branches over a calm river, fine rain drizzle, green misty hills in the distance, a paper kite in the sky, fresh green and misty white palette, gentle and quiet, no gravestones',
  愚人节:
    'a playful prank still life: a jack-in-the-box toy mid-pop on a table, rubber spiders and a whoopee cushion beside it, a mismatched gift box, bright saturated colors, cheerful and light',
  劳动节:
    'the dignity of work: a hard hat, a wrench and rolled blueprints on a workbench beside a half-finished wooden bench, warm daylight through a workshop window, honest earthy palette',
  儿童节:
    "children's day joy: soap bubbles floating over a wooden floor with scattered colorful crayons and a paper airplane, a bunch of bright balloons tied to a chair, candy colors, simple and buoyant",
  教师节:
    'appreciation for a teacher: an open notebook with neat notes and a red pen on a desk, a green chalkboard behind, chalk dust floating in a beam of warm light, a small bouquet of flowers, warm study palette',
  国庆节:
    'National Day celebration: a city square with a huge red flag on a tall pole, golden fireworks in the sky, red and gold street decorations, warm red and gold palette',
  万圣节:
    'playful spooky Halloween, NOT scary: carved pumpkins glowing on a porch, paper bats hanging from a branch, a witch hat on a fence, candlelight, orange and deep purple palette, storybook friendly, no monsters',
  平安夜:
    'quiet Christmas Eve: a warmly lit window seen from outside with snow falling, a knitted scarf and a steaming mug on the sill, a small wreath on the door, deep green and warm amber palette',
  圣诞节:
    'cozy Christmas: a small decorated tree with glowing lights and ornaments, wrapped presents underneath, a mug of cocoa with steam, gingerbread cookies on a plate, green red and cream palette',
  跨年夜:
    'the last hour of the year: a city skyline at midnight with golden fireworks, a clock tower with a plain blank clock face, champagne glasses and confetti on a balcony railing in the foreground, deep blue night with warm gold accents',
  母亲节:
    'tenderness in a sunlit kitchen: a vase of pink carnations on the table beside a warm cup of tea and a folded card, soft morning light through the window, warm peach and sage palette',
  父亲节:
    'quiet support: a worn armchair with a folded newspaper, a toolbox and a fishing hat on a side table, a mug of coffee steaming, calm living room light, muted brown and blue palette',
  感恩节:
    'harvest gratitude: a long dining table with a roasted turkey, pumpkins and a cornucopia, candles in glass holders, autumn leaves on the windowsill, amber and rust palette',
  端午节:
    'dragon boat festival still life: a carved dragon boat head on a calm river at dawn, zongzi wrapped in bamboo leaves on a table, mugwort bundles and a colorful sachet by the door, vivid green and warm red palette',
  中秋节:
    'mid-autumn festival: a huge full moon above tiled rooftops, a table with mooncakes and a tea set, glowing paper lanterns, warm amber and deep blue palette',
  重阳节:
    'double ninth festival: blooming chrysanthemums on a stone table with a teapot and cups, a golden autumn hillside path in the distance, deep green and golden palette',
};

/**
 * 取某节日的封面图提示词（没有则返回 null）。
 *
 * 用 name 查而不是靠 styleHint 推：封面是「这个节日的招牌画面」，
 * 一一对应，不做推导（推导出来的画面必然不贴合）。
 */
export function festivalCoverPromptOf(name: string): string | null {
  return FESTIVAL_COVER_PROMPTS[name] ?? null;
}

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

/* ------------------------------ 全部节日清单 ------------------------------ */

/** 某年可用的节日条目（含该年的公历日期）。 */
export interface FestivalEntry {
  /** 节日中文名（如「春节」） */
  name: string;
  /** 节日英文名（进 prompt 用） */
  nameEn: string;
  /** 节日类别 */
  kind: FestivalKind;
  /** 风格提示（英文，进 prompt） */
  styleHint: string;
  /** 该节日在指定年份的公历日期（YYYY-MM-DD） */
  date: string;
}

/** 清明在节气表里的下标（SOLAR_TERM_NAMES：0 小寒 … 6 清明）。 */
const QINGMING_SOLAR_TERM_INDEX = 6;

/** Date → YYYY-MM-DD（本地时区）。 */
function formatDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * 计算「某月第 n 个周几」在指定年份的公历日期。
 *
 * 超出该月天数则返回 null（实际不会发生：5 月有 5 个周几，装得下第 2 个周日）。
 */
function floatingFestivalDate(year: number, item: FloatingFestival): Date | null {
  const firstDayOfMonth = new Date(year, item.month - 1, 1);
  // 1 号的星期几与目标星期几的差（0~6），即当月第一个目标星期几是几号
  const offset = (item.weekday - firstDayOfMonth.getDay() + 7) % 7;
  const day = 1 + offset + (item.ordinal - 1) * 7;
  if (day > new Date(year, item.month, 0).getDate()) {
    return null;
  }
  return new Date(year, item.month - 1, day);
}

/**
 * 列出某一年的**全部**节日及其公历日期。
 *
 * 用途：节日题库**一次性预生成**——用户端随时能看到所有节日题库并专门刷题，
 * 而不是只有「当天那个节日」才有题可选（那会让 95% 的日子看不到节日题库）。
 *
 * 覆盖范围：
 * - 公历固定节日（月/日固定，永远可靠）；
 * - 浮动公历节日（某月第 n 个周几，按规则正算）；
 * - 农历节日（**仅当该年已补录**；缺表则跳过，宁缺勿错，不猜日期）；
 * - 清明（日期由节气算法给出，语义按节日处理）。
 *
 * 结果按公历日期升序（元旦 → 跨年夜），前端按顺序展示即时间轴。
 */
export function allFestivalsOf(year: number): FestivalEntry[] {
  const entries: FestivalEntry[] = [];

  // 1) 公历固定节日：表里的 key 形如 'MM-DD'，直接补年份
  for (const [key, hit] of Object.entries(FIXED_FESTIVALS)) {
    entries.push({ ...hit, date: `${year}-${key}` });
  }

  // 2) 浮动公历节日：按「某月第 n 个周几」正算日期
  for (const item of FLOATING_FESTIVALS) {
    const date = floatingFestivalDate(year, item);
    if (!date) {
      continue;
    }
    entries.push({ ...item.hit, date: formatDateKey(date) });
  }

  // 3) 农历节日：该年未补录则整体跳过（不猜日期）
  for (const [key, hit] of Object.entries(LUNAR_FESTIVALS[year] ?? {})) {
    entries.push({ ...hit, date: `${year}-${key}` });
  }

  // 4) 清明：日期由节气算法给出（每年 4/4 或 4/5），语义按节日处理
  entries.push({
    ...QINGMING_FESTIVAL,
    date: formatDateKey(solarTermDate(year, QINGMING_SOLAR_TERM_INDEX)),
  });

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 按节日名取指定年份的条目（找不到返回 null）。
 *
 * 生成流水线用它拿准确的 nameEn / styleHint：不能只靠 dayContextOf——
 * 清明在 dayContextOf 里会退化成「节气」语义，风格提示不是节日的。
 */
export function festivalEntryOf(name: string, year: number): FestivalEntry | null {
  return allFestivalsOf(year).find((entry) => entry.name === name) ?? null;
}
