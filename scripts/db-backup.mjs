#!/usr/bin/env node
/**
 * 数据库备份（P1 非代码 ②：唯一不可挽回点的兜底）。
 *
 * 零第三方依赖；仅用 Node 内置模块。备份产物为 gzip 压缩的逻辑备份
 * （`mysqldump` 输出 → zlib 压缩），落盘到仓库根 `backups/` 目录。
 * 配合 `db-restore.mjs` 的演练即可验证「真出事能恢复」。
 *
 * 用法：
 *   node scripts/db-backup.mjs            # 备份 DB_NAME 到 backups/（保留最近 14 份）
 *   node scripts/db-backup.mjs --keep 30  # 保留最近 30 份
 *   MYSQLDUMP_BIN=/path/mysqldump node scripts/db-backup.mjs
 *
 * 安全说明：
 * - 密码只经 MYSQL_PWD 环境变量传递，不进命令行参数（避开 ps 可见与 Windows 反斜杠转义坑）。
 * - 备份只含数据，迁移历史（schema 演进）在仓库 `api/prisma/migrations/`，
 *   二者配合即可在新库上完整重建（先 migrate deploy 再导入数据）。
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT_DIR, loadDbEnv, mysqlEnv } from './db-env.mjs';

/** 解析命令行 --keep N。 */
function parseKeep() {
  const i = process.argv.indexOf('--keep');
  if (i >= 0 && process.argv[i + 1]) {
    const n = Number(process.argv[i + 1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 14;
}

async function main() {
  const keep = parseKeep();
  const cfg = loadDbEnv();
  const bin = process.env.MYSQLDUMP_BIN || 'mysqldump';
  const outDir = path.join(ROOT_DIR, 'backups');
  fs.mkdirSync(outDir, { recursive: true });

  // 时间戳用固定宽度格式（14 位），文件名即可按字典序排序（= 时间序）
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
  const outFile = path.join(outDir, `${cfg.name}-${ts}.sql.gz`);

  // 密码走 MYSQL_PWD 环境变量：host/port/user/db 仍可显式传参（无歧义、无反斜杠坑）
  const args = [
    '-h',
    cfg.host,
    '-P',
    String(cfg.port),
    '-u',
    cfg.user,
    '--single-transaction',
    '--no-tablespaces',
    '--default-character-set=utf8mb4',
    cfg.name,
  ];
  const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], env: mysqlEnv(cfg) });
  const gz = zlib.createGzip();
  const out = fs.createWriteStream(outFile);

  let stderr = '';
  child.stderr.on('data', (d) => (stderr += d));
  // 管道末端（gzip / 文件）在读取方提前关闭时可能抛 EPIPE，属正常收尾，忽略
  gz.on('error', (e) => {
    if (e.code !== 'EPIPE') throw e;
  });

  // 关键：把 mysqldump 的 stdout 接上 gzip 再落盘；漏掉这行会导致管道缓冲区塞满、
  // mysqldump 因写不进 stdout 而卡死（表现为备份命令长时间无输出）
  child.stdout.pipe(gz).pipe(out);

  let exitCode = 0;
  await new Promise((resolve) => {
    child.on('close', (code) => {
      exitCode = code ?? 0;
    });
    out.on('close', resolve);
  });

  if (exitCode !== 0) {
    try {
      fs.unlinkSync(outFile);
    } catch {
      /* 失败产物删除失败也无所谓 */
    }
    console.error(`✗ mysqldump 失败（退出码 ${exitCode}）：\n${stderr}`);
    process.exit(1);
  }

  const sizeMb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(2);
  console.log(`✓ 备份完成：${path.relative(ROOT_DIR, outFile)}（${sizeMb} MB）`);

  // 保留策略：同名库的最新 N 份，其余删除
  const files = fs
    .readdirSync(outDir)
    .filter((f) => f.startsWith(`${cfg.name}-`) && f.endsWith('.sql.gz'))
    .sort()
    .reverse();
  const excess = files.slice(keep);
  for (const f of excess) {
    fs.unlinkSync(path.join(outDir, f));
    console.log(`  清理旧备份：${f}`);
  }
  console.log(`  当前保留 ${files.length - excess.length} 份（上限 ${keep}）`);
}

main().catch((error) => {
  console.error(`✗ 备份异常：${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
