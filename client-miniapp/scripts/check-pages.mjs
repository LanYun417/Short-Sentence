#!/usr/bin/env node
/**
 * 小程序静态自检（零第三方依赖）。
 *
 * 为什么需要它：WXML 里绑定的方法写错名字、页面漏了 wxss、tagBar 图标路径写错，
 * 在微信开发者工具里都是「点了没反应 / 样式全丢」这类难定位的问题；
 * tsc 只查 TS，eslint 不认 WXML。这里把三类低级错误前置成一次可复跑的检查。
 *
 * 校验项：
 * 1. app.json 声明的页面四件套（ts/json/wxml/wxss）齐全，且没有「有文件但没注册」的孤儿页面；
 * 2. WXML 中 bind / catch 绑定的处理函数在页面 ts 里存在；
 * 3. WXML 标签正确闭合；
 * 4. wx:for 必须带 wx:key（缺 key 会在真机上产生渲染复用错乱）；
 * 5. tabBar 图标路径存在。
 *
 * 用法：npm run check
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));

let problems = 0;
const fail = (message) => {
  problems += 1;
  console.log(`  x ${message}`);
};
const ok = (message) => console.log(`  ok ${message}`);

/** 1. 页面四件套 + 孤儿页面 */
function checkPages() {
  console.log('页面完整性');
  for (const page of app.pages) {
    for (const ext of ['ts', 'json', 'wxml', 'wxss']) {
      const file = path.join(ROOT, `${page}.${ext}`);
      if (!fs.existsSync(file)) {
        fail(`缺少 ${page}.${ext}`);
      }
    }
  }

  const declared = new Set(app.pages);
  const pagesDir = path.join(ROOT, 'pages');
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.wxml')) {
        const rel = path
          .relative(ROOT, full)
          .replace(/\\/g, '/')
          .replace(/\.wxml$/, '');
        if (!declared.has(rel)) {
          fail(`${rel}.wxml 未在 app.json 注册`);
        }
      }
    }
  };
  if (fs.existsSync(pagesDir)) {
    walk(pagesDir);
  }
  if (problems === 0) {
    ok(`${app.pages.length} 个页面齐全且无孤儿`);
  }
}

/** 2 & 4. WXML 事件绑定与 wx:for key */
function checkBindings() {
  console.log('事件绑定');
  const bindRe = /\b(?:bind|catch):?(?:tap|input|confirm|change|longpress|blur|focus|scrolltolower)="([A-Za-z0-9_]+)"/g;

  for (const page of app.pages) {
    const wxmlPath = path.join(ROOT, `${page}.wxml`);
    const tsPath = path.join(ROOT, `${page}.ts`);
    if (!fs.existsSync(wxmlPath) || !fs.existsSync(tsPath)) {
      continue;
    }
    const wxml = fs.readFileSync(wxmlPath, 'utf8');
    const ts = fs.readFileSync(tsPath, 'utf8');

    const handlers = new Set();
    for (const match of wxml.matchAll(bindRe)) {
      handlers.add(match[1]);
    }
    const missing = [...handlers].filter((name) => !new RegExp(`\\b${name}\\s*\\(`).test(ts));
    if (missing.length > 0) {
      fail(`${page}: WXML 绑定了未定义的方法 ${missing.join(', ')}`);
      continue;
    }

    // wx:for 必须带 wx:key
    const forBlocks = wxml.match(/<[^>]*wx:for=[^>]*>/g) ?? [];
    const keyless = forBlocks.filter((tag) => !/wx:key=/.test(tag));
    if (keyless.length > 0) {
      fail(`${page}: ${keyless.length} 处 wx:for 缺少 wx:key`);
      continue;
    }

    ok(`${page}（${handlers.size} 个绑定 / ${forBlocks.length} 处循环）`);
  }
}

/** 3. 标签闭合 */
function checkTags() {
  console.log('标签闭合');
  const SELF_CLOSING = /^(input|image|icon|import|include|wxs|audio|video|camera|canvas|map|web-view)$/;
  const tagRe = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;

  for (const page of app.pages) {
    const wxmlPath = path.join(ROOT, `${page}.wxml`);
    if (!fs.existsSync(wxmlPath)) {
      continue;
    }
    const source = fs.readFileSync(wxmlPath, 'utf8');
    const stack = [];
    let broken = false;
    for (const match of source.matchAll(tagRe)) {
      const [, closing, tag, , selfClosing] = match;
      if (selfClosing || SELF_CLOSING.test(tag)) {
        continue;
      }
      if (closing) {
        const top = stack.pop();
        if (top !== tag) {
          fail(`${page}: </${tag}> 与 <${top}> 不匹配`);
          broken = true;
          break;
        }
      } else {
        stack.push(tag);
      }
    }
    if (!broken && stack.length > 0) {
      fail(`${page}: 未闭合标签 ${stack.join(', ')}`);
      broken = true;
    }
    if (!broken) {
      ok(`${page}.wxml`);
    }
  }
}

/** 4. 样式：WXSS 花括号配平 + WXML 里用到的静态 class 必须有定义 */
function checkStyles() {
  console.log('样式类');
  const cssPath = path.join(ROOT, 'app.wxss');
  const globalSelectors = new Set();
  const collect = (css, into) => {
    for (const match of css.matchAll(/\.([A-Za-z_][\w-]*)/g)) {
      into.add(match[1]);
    }
  };
  if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, 'utf8');
    collect(css, globalSelectors);
    const open = (css.match(/{/g) ?? []).length;
    const close = (css.match(/}/g) ?? []).length;
    if (open !== close) {
      fail(`app.wxss 花括号不配平（{ ${open} / } ${close}）`);
    }
  }

  for (const page of app.pages) {
    const wxssPath = path.join(ROOT, `${page}.wxss`);
    const wxmlPath = path.join(ROOT, `${page}.wxml`);
    if (!fs.existsSync(wxssPath) || !fs.existsSync(wxmlPath)) {
      continue;
    }
    const css = fs.readFileSync(wxssPath, 'utf8');
    const open = (css.match(/{/g) ?? []).length;
    const close = (css.match(/}/g) ?? []).length;
    if (open !== close) {
      fail(`${page}.wxss 花括号不配平（{ ${open} / } ${close}）`);
      continue;
    }

    const defined = new Set(globalSelectors);
    collect(css, defined);

    const used = new Set();
    const wxml = fs.readFileSync(wxmlPath, 'utf8');
    for (const match of wxml.matchAll(/(?:^|\s)(?:class|hover-class)="([^"]*)"/g)) {
      const raw = match[1];
      // 含插值的类名无法静态判断（可能拼出 -active 等变体），跳过
      if (raw.includes('{{')) {
        continue;
      }
      raw
        .split(/\s+/)
        .filter(Boolean)
        .forEach((name) => used.add(name));
    }

    const missing = [...used].filter((name) => !defined.has(name));
    if (missing.length > 0) {
      fail(`${page}: 样式类未定义 ${missing.join(', ')}`);
      continue;
    }
    ok(`${page}.wxss（${used.size} 个静态类）`);
  }
}

/** 5. tabBar 图标 */
function checkTabBar() {
  console.log('tabBar 图标');
  const list = app.tabBar?.list ?? [];
  if (list.length === 0) {
    ok('未配置 tabBar');
    return;
  }
  let missing = 0;
  for (const item of list) {
    for (const key of ['iconPath', 'selectedIconPath']) {
      const icon = item[key];
      if (icon && !fs.existsSync(path.join(ROOT, icon))) {
        fail(`缺少图标 ${icon}`);
        missing += 1;
      }
    }
  }
  if (missing === 0) {
    ok(`${list.length} 个 tab × 2 态图标齐全`);
  }
}

checkPages();
checkBindings();
checkTags();
checkStyles();
checkTabBar();

console.log(`\n${problems === 0 ? '全部通过' : `${problems} 个问题`}`);
process.exit(problems === 0 ? 0 : 1);
