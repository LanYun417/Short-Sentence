/**
 * 封装组件门禁（admin/src 禁止裸用 Element Plus 的弹窗 / 分页，一律走项目封装）。
 *
 * 为什么需要门禁：`el-dialog` / `el-pagination` 能直接用、也不报错，但会绕过封装里
 * 已经踩过并解决掉的问题：
 *
 * - `el-dialog` → `BasicDialog`：
 *   1. 正文 el-scrollbar 限高（长表单在弹窗内滚动，不把页面撑出原生滚动条）；
 *   2. 禁止点遮罩关闭（防手误点空白丢表单数据）；
 *   3. 小屏自适应宽度（≤768px 自动 98%）；
 *   4. 默认 footer（取消/确定 + loading/disabled）。
 * - `el-pagination` → `Pagination`：
 *   1. 窄屏自动切 `small`（移动端不横向溢出）；
 *   2. 受控式 `v-model:current-page` / `v-model:page-size`；
 *   3. 切每页条数自动回到第 1 页（避免停在越界页码）；
 *   4. 外层自带 el-scrollbar 横向滚动（窄屏分页器超宽不撑破布局）。
 *
 * 规则：`admin/src/**\/*.vue` 出现 `<el-dialog` / `<el-pagination` 即报错；
 * 封装自身（components/BasicDialog、components/Pagination）豁免。
 *
 * 用法：node scripts/check-wrapped-components.mjs（根目录 npm run guard:components）
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIR = path.join(ROOT, 'admin/src');

/** 被封装的 Element Plus 组件 → 项目封装（含改写建议） */
const RULES = [
  {
    tag: 'el-dialog',
    wrapper: 'BasicDialog',
    hint: '<BasicDialog v-model="visible" title="…" width="…">，自定义按钮放 #footer 插槽',
  },
  {
    tag: 'el-pagination',
    wrapper: 'Pagination',
    hint: '<Pagination v-model:current-page="page" v-model:page-size="size" :total="total" />',
  },
];

/** 封装自身允许出现原始标签 */
const ALLOW = new Set(['admin/src/components/BasicDialog/index.vue', 'admin/src/components/Pagination/index.vue']);

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
    // 只拦模板里的裸标签；注释里提到原始标签说明「为什么不用」是允许的
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    for (const rule of RULES) {
      if (!new RegExp(`<${rule.tag}\\b`).test(line)) continue;
      problems.push({ file: rel, line: index + 1, code: trimmed, rule });
    }
  }
}

if (problems.length > 0) {
  console.error(`[ComponentGuard] ❌ 发现 ${problems.length} 处裸用 Element Plus 组件，请改用项目封装：\n`);
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line}`);
    console.error(`    ${p.code}`);
    console.error(`    → ${p.rule.tag} 请改用 ${p.rule.wrapper}：${p.rule.hint}\n`);
  }
  console.error('约定见 docs/admin-vue-规范.md §1「硬性约定」与 §8「弹窗 / 分页约定」。');
  process.exit(1);
}

console.log(
  '[ComponentGuard] ✅ admin/src 未发现裸 el-dialog / el-pagination（弹窗走 BasicDialog、分页走 Pagination）。',
);
