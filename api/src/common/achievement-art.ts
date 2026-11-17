/**
 * 成就徽章 SVG 生成器。
 *
 * 线稿直接取 Web 列表 ICON_MAP 对应的 lucide 图标路径（见同目录 achievement-glyphs.ts，
 * 由 scripts/extract-achievement-glyphs.cjs 从 @iconify-json/lucide 提取），
 * 保证「列表里看到什么图标，点开弹窗就是什么图标」；不再用手写近似线稿。
 *
 * 纯透明底 + 金色描边（#f59e0b，与 Web 列表的 text-amber-500 一致），无背景块。
 * SMIL 描边动画把每枚图标从左下起点一笔连完；静态渲染器显示完整线稿不白屏。
 * 服务端同时栅格化一份静态 PNG 作兜底，Android 则以自绘组件播同样动画。
 */
import { LUCIDE_GLYPHS } from './achievement-glyphs.js';

/** 24x24 线稿路径（fill:none / stroke:white / stroke-width≈1.8，由外层统一设置）。 */
const GLYPHS: Record<string, string> = {
  footprints:
    '<ellipse cx="8" cy="15" rx="3" ry="5"/><ellipse cx="16" cy="16" rx="2.6" ry="4.4"/>' +
    '<circle cx="5" cy="7" r="1.2"/><circle cx="8" cy="5.4" r="1.2"/><circle cx="11" cy="6" r="1.2"/>' +
    '<circle cx="15" cy="8" r="1.1"/><circle cx="18" cy="7.4" r="1.1"/>',
  flame:
    'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  'flame-kindling':
    'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3' + 'M12 13v4M9 20h6M10 17h4',
  medal: '<circle cx="12" cy="15" r="5"/><path d="M9 4l2 6M15 4l-2 6M8 3h8M12 13v4M9.5 15h5"/>',
  crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8zM5 19h14',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z',
  book: 'M4 5a2 2 0 0 1 2-2h6v17H6a2 2 0 0 1-2-2V5zM20 5a2 2 0 0 0-2-2h-6v17h6a2 2 0 0 0 2-2V5z',
  map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6zM9 3v15M15 6v15',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
  flag: 'M5 21V4M5 5h11l-2 3 2 3H5',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 15l2.5 2.5L16 13"/>',
  people:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2"/>' +
    '<circle cx="17" cy="9" r="2.5"/><path d="M16 14a5 5 0 0 1 5 5v1"/>',
  users:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2"/>' +
    '<circle cx="17" cy="9" r="2.5"/><path d="M16 14a5 5 0 0 1 5 5v1"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  route: '<circle cx="5" cy="17" r="2.5"/><circle cx="19" cy="7" r="2.5"/><path d="M7.5 16c5 0 3-8 9-8"/>',
  swords: 'M4 20l8-8M6 14l4 4M20 20l-8-8M18 14l-4 4M14 6l4-4M10 6L6 2',
  shield: 'M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4zM8 12l3 3 5-5',
  zap: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  'lightning-charge': 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  sparkles:
    'M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z' +
    'M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z',
  rocket: 'M12 2c4 3 6 7 6 12l-6 4-6-4c0-5 2-9 6-12zM9 14l-3 3M15 14l3 3M12 18v4',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  'check2-circle': '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  robot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 17h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  speed: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 13l4-4"/><circle cx="12" cy="17" r="1"/>',
  chat: '<path d="M4 5h16v11H9l-5 4V5z"/><path d="M8 10h8M8 13h5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2"/>',
};

/** 没登记图标名时的兜底线稿（星光），靠配色区分即可。 */
const FALLBACK_GLYPH = GLYPHS['sparkles'] as string;

/** 取图标线稿：优先用从 Web ICON_MAP 提取的 lucide 原路径，保证列表与弹窗一致。 */
function glyphOf(icon: string): string {
  return LUCIDE_GLYPHS[icon] ?? GLYPHS[icon] ?? FALLBACK_GLYPH;
}

/** 取属性值（lucide 的 path 上带 stroke/fill 等一堆属性，不能假设 d 排第一）。 */
function attr(attrs: string, name: string): string | null {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1] ?? null;
}

/** 把 circle / rect / path 统一成 `<path d="..."/>`，客户端只需解析一种元素。 */
function normalizeToPaths(glyph: string): string[] {
  if (!glyph.startsWith('<')) {
    return [`<path d="${glyph}"/>`];
  }
  const out: string[] = [];
  for (const match of glyph.matchAll(/<circle\b([^>]*)\/>/g)) {
    const cx = Number(attr(match[1] as string, 'cx'));
    const cy = Number(attr(match[1] as string, 'cy'));
    const r = Number(attr(match[1] as string, 'r'));
    out.push(`<path d="M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z"/>`);
  }
  for (const match of glyph.matchAll(/<ellipse\b([^>]*)\/>/g)) {
    const cx = Number(attr(match[1] as string, 'cx'));
    const cy = Number(attr(match[1] as string, 'cy'));
    const rx = Number(attr(match[1] as string, 'rx'));
    const ry = Number(attr(match[1] as string, 'ry'));
    out.push(`<path d="M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0 Z"/>`);
  }
  for (const match of glyph.matchAll(/<rect\b([^>]*)\/>/g)) {
    const x = attr(match[1] as string, 'x');
    const y = attr(match[1] as string, 'y');
    const w = attr(match[1] as string, 'width');
    const h = attr(match[1] as string, 'height');
    out.push(`<path d="M ${x} ${y} h ${w} v ${h} h ${-Number(w)} Z"/>`);
  }
  for (const match of glyph.matchAll(/<path\b([^>]*)\/>/g)) {
    const d = attr(match[1] as string, 'd');
    if (d) {
      out.push(`<path d="${d}"/>`);
    }
  }
  return out;
}

/**
 * 按成就元数据生成「纯线稿 + 绘制动画」的 SVG（256x256，无背景，透明底）。
 *
 * 动画用 SMIL：pathLength=1 把每条路径长度归一，dasharray=1 / dashoffset 从 1 走到 0，
 * 视觉上就是从一个点出发把线稿连完。静态渲染器（不支持 SMIL）会看到 base 状态
 * dashoffset=0，即完整线稿，不会白屏。
 *
 * 描边统一用列表里的金色（Tailwind amber-500 / #f59e0b），没有背景块后白线会看不见。
 */
export function renderAchievementSvg(_code: string, icon: string, _category: string): string {
  const stroke = '#f59e0b';
  const glyph = normalizeToPaths(glyphOf(icon));
  const paths = glyph
    .map((item, index) =>
      item.replace(
        '/>',
        ` pathLength="1" stroke-dasharray="1" stroke-dashoffset="0">` +
          `<animate attributeName="stroke-dashoffset" from="1" to="0" begin="${(index * 0.12).toFixed(2)}s" ` +
          `dur="1s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1"/></path>`,
      ),
    )
    .join('');
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">',
    `<g transform="translate(56 56) scale(6)" fill="none" stroke="${stroke}" ` +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">',
    paths,
    '</g>',
    '</svg>',
  ].join('');
}
