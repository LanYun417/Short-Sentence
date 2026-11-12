/**
 * 弹窗门禁（admin/src 禁止裸用 `el-dialog`，一律走项目封装的 `BasicDialog`）。
 *
 * 为什么需要门禁：`el-dialog` 能直接用、也不报错，但会绕过封装里踩过的四个坑——
 * 1. 正文限高（封装的 el-scrollbar 让长表单在弹窗内滚动，不把页面撑出原生滚动条）；
 * 2. 禁止点遮罩关闭（防手误点空白导致表单数据丢失）；
 * 3. 小屏自适应宽度（≤768px 自动 98%，固定宽不再溢出）；
 * 4. 默认 footer（取消/确定 + loading/disabled），不必每个弹窗重写按钮与 loading 态。
 *
 * 规则：`admin/src/**\/*.vue` 里出现 `<el-dialog` 即报错；封装自身（components/BasicDialog）豁免。
 *
 * 用法：node scripts/check-basic-dialog.mjs（根目录 npm run guard:dialog）
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIR = path.join(ROOT, 'admin/src');
/** 封装自身允许出现 el-dialog */
const ALLOW = new Set(['admin/src/components/BasicDialog/index.vue']);

function collect(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...collect(full));
    } else if (path.extname(name) === '.vue') {
      out.push(full);
    }
  }
  return out;
}

const problems = [];
for (const file of collect(SCAN_DIR)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (ALLOW.has(rel)) continue;
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    // 只拦模板里的裸标签；注释里提到 el-dialog 说明「为什么不用」是允许的
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    if (!/<el-dialog\b/.test(line)) continue;
    problems.push({ file: rel, line: index + 1, code: trimmed });
  }
}

if (problems.length > 0) {
  console.error(`[DialogGuard] ❌ 发现 ${problems.length} 处裸 el-dialog，请改用 BasicDialog：\n`);
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line}`);
    console.error(`    ${p.code}`);
    console.error('    → <BasicDialog v-model="visible" title="…" width="…">，自定义按钮放 #footer 插槽\n');
  }
  console.error('约定见 docs/admin-vue-规范.md §1「硬性约定」。');
  process.exit(1);
}

console.log('[DialogGuard] ✅ admin/src 未发现裸 el-dialog（弹窗统一走 BasicDialog）。');
