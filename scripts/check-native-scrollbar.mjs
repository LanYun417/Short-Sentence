/**
 * 原生滚动条门禁（admin/ 前台样式里禁止自己造滚动容器）。
 *
 * 为什么需要门禁：`overflow-y-auto` 这类写法**不会报错**，只是让浏览器画出原生
 * 滚动条 —— 与全局内容区/侧边栏/抽屉统一的 el-scrollbar 细滚动条并存时非常割裂，
 * 而且只有滚动内容足够长才看得见，属于「本地容易漏、上线上才发现」的问题。
 * 已经真实发生过两次：客户端用户详情弹窗、字典项抽屉（后者还是 EP `el-scrollbar`
 * 默认 `height:100%` 撑满定高容器导致的）。
 *
 * 规则（只扫 admin/src，只禁**纵向/两向**原生滚动）：
 * - 类名：`overflow-auto` / `overflow-y-auto` / `overflow-scroll` / `overflow-y-scroll`；
 * - 声明：`overflow: auto|scroll` / `overflow-y: auto|scroll`；
 * - 放行 `overflow-x-*`（只横向，代码块/长表格常有意为之）与 `overflow-hidden`
 *   （那是裁剪，不会产生滚动条）。
 *
 * 纵向滚动应改用 `<el-scrollbar max-height="…">`；flex 容器里记得 `min-h-0 flex-1`
 * （el-scrollbar 自带 `height:100%`，不限制会抢高度）。
 *
 * 用法：node scripts/check-native-scrollbar.mjs（根目录 npm run guard:scrollbar）
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIR = path.join(ROOT, 'admin/src');
/** 只看这几类文件：模板（类名）+ 样式（声明） */
const EXTS = new Set(['.vue', '.css', '.scss']);

/** 需要拦截的写法（含说明，便于报错时直接告诉人怎么改） */
const RULES = [
  {
    // \b 确保不会把 overflow-x-auto 误伤（它是 overflow-x-…，两种写法都对不上）
    re: /\boverflow-y-(?:auto|scroll)\b|\boverflow-(?:auto|scroll)\b/g,
    why: '类名会产生浏览器原生滚动条，请改用 <el-scrollbar max-height="…">',
  },
  {
    re: /\boverflow-y\s*:\s*(?:auto|scroll)\b|\boverflow\s*:\s*(?:auto|scroll)\b/g,
    why: '样式声明会产生浏览器原生滚动条，请把滚动交给 <el-scrollbar>',
  },
];

/** 递归收集待扫描文件 */
function collect(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...collect(full));
    } else if (EXTS.has(path.extname(name))) {
      out.push(full);
    }
  }
  return out;
}

const problems = [];
for (const file of collect(SCAN_DIR)) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    for (const [index, line] of lines.entries()) {
      // 注释行不拦：说明「为什么不用原生滚动」时必然要提到这些字面量
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }
      rule.re.lastIndex = 0;
      if (rule.re.test(line)) {
        problems.push({
          file: path.relative(ROOT, file).replace(/\\/g, '/'),
          line: index + 1,
          code: trimmed,
          why: rule.why,
        });
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`[ScrollbarGuard] ❌ 发现 ${problems.length} 处原生滚动条写法：\n`);
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line}`);
    console.error(`    ${p.code}`);
    console.error(`    → ${p.why}\n`);
  }
  console.error('约定见 docs/admin-vue-规范.md §1「硬性约定」。');
  process.exit(1);
}

console.log('[ScrollbarGuard] ✅ admin/src 未发现原生纵向滚动条写法（滚动统一走 el-scrollbar）。');
