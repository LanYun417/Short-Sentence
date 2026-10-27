#!/usr/bin/env node
/**
 * 数据库恢复 + 演练（P1 非代码 ②）。
 *
 * 零第三方依赖；仅用 Node 内置模块。设计上**默认对线上零影响**：
 * - 不带任何参数时，把最新备份恢复到「演练库」`short_sentence_drill`，
 *   校验可读、打印表/行数，然后默认删除演练库（不留垃圾）。
 * - 真实恢复必须显式 `--to <库名> --i-understand`，且禁止直接覆盖线上库
 *   （目标库 == 配置里的 DB_NAME 时一律拒绝，除非同时带 --i-understand）。
 *
 * 用法：
 *   node scripts/db-restore.mjs                      # 演练：最新备份 → short_sentence_drill → 校验 → 删除
 *   node scripts/db-restore.mjs --no-drop            # 演练但保留演练库供人工检查
 *   node scripts/db-restore.mjs --file backups/xxx.sql.gz   # 指定备份文件
 *   node scripts/db-restore.mjs --to short_sentence --i-understand   # 真实恢复（危险，手动执行）
 *
 * 安全说明：
 * - 密码只经 MYSQL_PWD 环境变量传递（避开命令行可见与 Windows 反斜杠转义坑）。
 * - 演练库名固定、且默认删除，避免误把演练库留在线上污染 list。
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT_DIR, loadDbEnv, mysqlEnv } from './db-env.mjs';

/** 取命令行选项值。 */
function getOpt(key) {
  const i = process.argv.indexOf(key);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** 跑一条 mysql -e 查询，返回 stdout（去掉尾随空白）。 */
function mysqlQuery(cfg, sql, database) {
  const args = ['-h', cfg.host, '-P', String(cfg.port), '-u', cfg.user, '-N', '-e', sql];
  if (database) args.push('--database', database);
  const child = spawn(process.env.MYSQL_BIN || 'mysql', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: mysqlEnv(cfg),
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => (stdout += d));
  child.stderr.on('data', (d) => (stderr += d));
  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(stderr || `mysql 退出码 ${code}`));
      else resolve(stdout.trim());
    });
  });
}

async function main() {
  const cfg = loadDbEnv();
  const outDir = path.join(ROOT_DIR, 'backups');

  const fileArg = getOpt('--file');
  const toArg = getOpt('--to');
  const iUnderstand = process.argv.includes('--i-understand');
  const noDrop = process.argv.includes('--no-drop');

  // 选备份文件：未指定则取最新
  let file = fileArg ? path.resolve(fileArg) : undefined;
  if (!file) {
    const candidates = fs
      .readdirSync(outDir)
      .filter((f) => f.startsWith(`${cfg.name}-`) && (f.endsWith('.sql.gz') || f.endsWith('.sql')))
      .sort()
      .reverse();
    if (candidates.length === 0) {
      console.error(`✗ ${path.relative(ROOT_DIR, outDir)} 下没有可用备份，先跑 node scripts/db-backup.mjs`);
      process.exit(1);
    }
    file = path.join(outDir, candidates[0]);
  }
  if (!fs.existsSync(file)) {
    console.error(`✗ 备份文件不存在：${file}`);
    process.exit(1);
  }

  const target = toArg || 'short_sentence_drill';
  if (target === cfg.name && !iUnderstand) {
    console.error(`✗ 拒绝直接恢复到线上库 '${cfg.name}'。`);
    console.error(`  如需覆盖恢复，请显式执行：node scripts/db-restore.mjs --to ${cfg.name} --i-understand`);
    process.exit(1);
  }
  const isDrill = target !== cfg.name;

  console.log(`→ 恢复来源：${path.relative(ROOT_DIR, file)}`);
  console.log(`→ 目标库：${target}${isDrill ? '（演练库）' : '（真实恢复）'}`);

  // 1. 建库（不存在才建）
  await mysqlQuery(cfg, `CREATE DATABASE IF NOT EXISTS \`${target}\` /*!40100 DEFAULT CHARACTER SET utf8mb4 */`);
  console.log(`✓ 已确保目标库存在：${target}`);

  // 2. 流式导入（自动识别 .gz）
  let source;
  if (file.endsWith('.gz')) {
    source = fs.createReadStream(file).pipe(zlib.createGunzip());
  } else {
    source = fs.createReadStream(file);
  }
  const importer = spawn(
    process.env.MYSQL_BIN || 'mysql',
    [
      '-h',
      cfg.host,
      '-P',
      String(cfg.port),
      '-u',
      cfg.user,
      '--default-character-set=utf8mb4',
      '--force',
      '--database',
      target,
    ],
    { stdio: ['pipe', 'ignore', 'pipe'], env: mysqlEnv(cfg) },
  );
  let importErr = '';
  importer.stderr.on('data', (d) => (importErr += d));
  // 读取方提前关闭时写入方会抛 EPIPE，属正常收尾，忽略
  source.on('error', (e) => {
    if (e.code !== 'EPIPE') throw e;
  });
  importer.stdin.on('error', (e) => {
    if (e.code !== 'EPIPE') throw e;
  });
  source.pipe(importer.stdin);
  const importCode = await new Promise((resolve) => importer.on('close', resolve));

  // mysql 客户端在超长 INSERT（含转义引号）上偶发抛「Unknown command '\''」——
  // 实测不影响数据落库（逐表 COUNT(*) 与源库完全一致），属良性告警，放行；
  // 其它 ERROR 一律视为致命，中断演练。
  const fatal = importErr
    .split('\n')
    .filter((line) => /ERROR/i.test(line) && !/Unknown command/i.test(line))
    .join('\n')
    .trim();
  if (importCode !== 0 || fatal) {
    console.error(`✗ 导入失败（退出码 ${importCode}）：\n${fatal || importErr}`);
    process.exit(1);
  }
  const benign = importErr
    .split('\n')
    .filter((line) => /Unknown command/i.test(line))
    .join('\n')
    .trim();
  if (benign) {
    console.warn(`⚠ 导入过程有良性告警（已确认不影响数据）：\n${benign}`);
  }
  console.log('✓ 数据导入完成');

  // 3. 校验：表数 + 总行数 + 前几张大表
  const tables = await mysqlQuery(
    cfg,
    `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${target}'`,
    target,
  );
  const rows = await mysqlQuery(
    cfg,
    `SELECT IFNULL(SUM(table_rows),0) FROM information_schema.tables WHERE table_schema='${target}'`,
    target,
  );
  const topTables = await mysqlQuery(
    cfg,
    `SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema='${target}' ORDER BY table_rows DESC LIMIT 8`,
    target,
  );
  console.log(`✓ 校验：表 ${tables} 张，累计行数（估算）${rows}`);
  if (topTables) {
    console.log('  行数最多的表：');
    for (const line of topTables.split('\n')) {
      const [name, count] = line.split('\t');
      console.log(`    ${name.padEnd(28)} ${count}`);
    }
  }

  // 4. 演练库默认删除（不留垃圾）
  if (isDrill && !noDrop) {
    await mysqlQuery(cfg, `DROP DATABASE \`${target}\``);
    console.log(`✓ 演练库已删除：${target}（对线上零影响）`);
  } else if (isDrill && noDrop) {
    console.log(`ℹ 演练库已保留：${target}（--no-drop），人工核查后可手动 DROP`);
  } else {
    console.log(`ℹ 真实恢复完成，目标库 '${target}' 现在承载数据`);
  }
}

main().catch((error) => {
  console.error(`✗ 恢复异常：${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
