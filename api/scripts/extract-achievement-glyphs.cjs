/**
 * 一次性脚本：从 client-web 的 ICON_MAP + @iconify-json/lucide 提取 33 枚成就图标的
 * 原始 SVG 形状，产物写到 api/src/common/achievement-glyphs.ts。
 * 这样点开弹窗里的线稿和列表里的 lucide 图标是同一份路径，不会再出现对不上。
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const seedSrc = fs.readFileSync(path.join(root, 'api/src/prisma/seed.service.ts'), 'utf8');
const webSrc = fs.readFileSync(path.join(root, 'client-web/app/pages/achievements.vue'), 'utf8');
const iconify = JSON.parse(
  fs.readFileSync(path.join(root, 'client-web/node_modules/@iconify-json/lucide/icons.json'), 'utf8'),
);

// 解析 Web 列表的 ICON_MAP（key 是种子里的 icon 名，value 是 i-lucide-xxx）
const mapBlock = webSrc.slice(webSrc.indexOf('const ICON_MAP'), webSrc.indexOf('function iconOf'));
const iconMap = new Map();
for (const match of mapBlock.matchAll(/'?([\w-]+)'?:\s*'i-lucide-([\w-]+)'/g)) {
  iconMap.set(match[1], match[2]);
}
console.log('ICON_MAP 条数', iconMap.size);

// 取 ACHIEVEMENT_SEEDS 段里的 code/icon 配对
const seedBlock = seedSrc.slice(
  seedSrc.indexOf('export const ACHIEVEMENT_SEEDS'),
  seedSrc.indexOf('];', seedSrc.indexOf('export const ACHIEVEMENT_SEEDS')),
);
const pairs = [];
for (const chunk of seedBlock.split(/(?=code: ')/).slice(1)) {
  const code = chunk.match(/code: '([^']+)'/)?.[1];
  const icon = chunk.match(/icon: '([^']+)'/)?.[1];
  if (code && icon) pairs.push({ code, icon });
}
console.log('成就数', pairs.length);

function bodyOf(lucideName) {
  const item = iconify.icons[lucideName] ?? iconify.aliases[lucideName];
  if (!item) return null;
  if (item.body) return item.body;
  if (item.parent) return bodyOf(item.parent);
  return null;
}

function innerShapes(body) {
  return body
    .replace(/^<g[^>]*>/, '')
    .replace(/<\/g>$/, '')
    .trim();
}

const entries = [];
for (const { icon } of pairs) {
  const lucide = iconMap.get(icon) ?? 'award';
  const body = bodyOf(lucide);
  if (!body) {
    console.warn('未找到 lucide 图标', icon, '->', lucide);
    continue;
  }
  if (!entries.some((e) => e.icon === icon)) {
    entries.push({ icon, lucide, shapes: innerShapes(body) });
  }
}

const out = [
  '/**',
  ' * 成就图标线稿：从 client-web ICON_MAP + @iconify-json/lucide 自动提取，',
  ' * 由 api/scripts/extract-achievement-glyphs.cjs 生成，勿手改。',
  ' * key = 种子里的 icon 名，value = lucide 24x24 的 SVG 内部形状。',
  ' */',
  'export const LUCIDE_GLYPHS: Record<string, string> = {',
  ...entries.map((e) => `  ${JSON.stringify(e.icon)}: ${JSON.stringify(e.shapes)},`),
  '};',
  '',
].join('\n');
fs.writeFileSync(path.join(root, 'api/src/common/achievement-glyphs.ts'), out);
console.log('写入', entries.length, '个图标；样例', entries.find((e) => e.icon === 'compass')?.shapes.slice(0, 100));
