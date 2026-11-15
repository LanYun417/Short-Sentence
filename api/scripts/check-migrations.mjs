#!/usr/bin/env node
/**
 * 迁移完整性门禁（本地版 CI 门禁）：
 * 建一个临时影子库 → 只重放 prisma/migrations → 与 prisma/schema 做 diff，必须为空。
 *
 * 专治「改了 schema 忘了写 migration」：这种改动本地 `db push` 跑着没感觉，
 * 但全新服务器 `migrate deploy` 后表/列不存在，服务启动或首次访问直接 P2021。
 * （仓库主远端是 Gitee，.github/workflows/ci.yml 里的 diff 门禁在 Gitee 上不生效，
 *   所以把这道门禁下沉到 pre-push，本地 push 前自己拦住。）
 *
 * 用法：api/ 下 `npm run prisma:migrations:check`，或根目录 `npm run guard:migrations`
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prismaBin = path.join(apiDir, 'node_modules', 'prisma', 'build', 'index.js');
const scratch = `ss_mig_check_${randomBytes(4).toString('hex')}`;

/** 调 prisma CLI（直接用 node 起 bin，跨平台不用担心 npx.cmd）。 */
function prisma(args, options = {}) {
  return execFileSync(process.execPath, [prismaBin, ...args], {
    cwd: apiDir,
    input: options.input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...(options.env ?? {}) },
  });
}

/** 在主库连接上执行库级 SQL（CREATE/DROP DATABASE 不需要先连到目标库；v7 用 cwd 下的 prisma.config.ts，不用传 --schema）。 */
function sql(script) {
  prisma(['db', 'execute', '--stdin'], { input: script });
}

console.log(`[MigrationsGuard] 影子库 ${scratch}：重放 migrations 后与 schema diff…`);
sql(
  `DROP DATABASE IF EXISTS \`${scratch}\`;\nCREATE DATABASE \`${scratch}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
);

try {
  const scratchEnv = { DB_NAME: scratch };
  prisma(['migrate', 'deploy'], { env: scratchEnv });
  const diff = prisma(['migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema', '--script'], {
    env: scratchEnv,
  });
  const meaningful = diff
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && line !== '-- This is an empty migration.');

  if (meaningful.length > 0) {
    console.error('[MigrationsGuard] ❌ migrations 落后于 schema，缺下面这部分 DDL：');
    console.error('           请补写成新的 migration（别只 db push，影子库重放不到它）后再 push。');
    console.error(diff);
    process.exitCode = 1;
  } else {
    console.log('[MigrationsGuard] ✅ migrations 与 schema 完全一致');
  }
} catch (error) {
  console.error('[MigrationsGuard] ❌ 执行失败（本地 MySQL 没开？影子库建不出来？）：');
  console.error(String(error?.stderr ?? error?.message ?? error));
  process.exitCode = 1;
} finally {
  try {
    sql(`DROP DATABASE IF EXISTS \`${scratch}\`;`);
  } catch {
    console.warn(`[MigrationsGuard] 影子库 ${scratch} 清理失败，请手动 DROP DATABASE \`${scratch}\`;`);
  }
}
