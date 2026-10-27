#!/usr/bin/env node
/**
 * DB 工具共用的环境变量解析（零第三方依赖）。
 *
 * 设计要点：
 * - 优先用 process.env 里已存在的变量；缺失时再从 `api/.env` 补（不覆盖），
 *   这样在 CI / 容器里可以直接注入环境变量，本地开发则无需手动 export。
 * - 密码**只**通过 `MYSQL_PWD` 环境变量传给 mysql/mysqldump，
 *   不进命令行参数（避免 ps 可见），也**不用** `--defaults-extra-file`
 *   （Windows 上该参数值里的反斜杠会被 mysql 的选项解析当成转义符，
 *   导致路径被吃掉、文件打不开甚至进程卡死）。
 *
 * 用法：被 db-backup.mjs / db-restore.mjs 内部 import，不直接执行。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** 项目根目录（scripts/ 的上一级）。 */
export const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * 加载数据库连接配置。
 * @returns {{ host: string; port: number; name: string; user: string; password: string }}
 */
export function loadDbEnv() {
  const envPath = path.join(ROOT_DIR, 'api', '.env');
  if (fs.existsSync(envPath)) {
    const text = fs.readFileSync(envPath, 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = val;
      }
    }
  }
  const cfg = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
  };
  if (!cfg.name) {
    throw new Error('缺少 DB_NAME（请在 api/.env 或环境变量中配置数据库名）');
  }
  if (!cfg.user) {
    throw new Error('缺少 DB_USER（请在 api/.env 或环境变量中配置数据库用户）');
  }
  return cfg;
}

/**
 * 构造传给 mysql/mysqldump 的子进程环境变量：
 * 继承当前环境，并补上 MYSQL_PWD（密码只走这里，不进命令行参数）。
 * @param {{ password: string }} cfg
 * @returns {NodeJS.ProcessEnv}
 */
export function mysqlEnv(cfg) {
  return { ...process.env, MYSQL_PWD: cfg.password };
}
