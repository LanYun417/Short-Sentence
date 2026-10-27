/**
 * 日志归档单测（真实临时目录 + 真实 tar，不 mock 子进程）。
 *
 * 为什么要测：归档是「跑完就删源文件」的破坏性操作，且是定时任务正规化后
 * 唯一依赖外部二进制的任务；Windows 上 GNU tar 曾因「盘符路径被当成主机:路径」
 * 直接失败（退出码 2，源文件还差点被删）。这些边界必须由测试钉住：
 * 打包是否成功、源文件是否在删除后才删、空跑是否零副作用。
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import dayjs from 'dayjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { config } from '../src/common/config/config.js';
import { FileLoggerService } from '../src/common/log/file-logger.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

type LogConfig = {
  dir: string;
  archiveDir: string;
  keepSourceAfterArchive: boolean;
  tarBin: string;
};

const original: LogConfig = {
  dir: config.log.dir,
  archiveDir: config.log.archiveDir,
  keepSourceAfterArchive: config.log.keepSourceAfterArchive,
  tarBin: config.log.tarBin,
};

/** 昨日日期串（被归档的目标）。 */
const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');

let rootDir: string;
let logDir: string;
let archiveDir: string;
/** 各用例自建的服务实例，afterEach 统一销毁（关写流，避免 rmSync 后流才异步打开报 ENOENT） */
let service: FileLoggerService;

/** 造一个昨天的日志文件。 */
function writeYesterdayLog(kind: string): string {
  const file = join(logDir, `${kind}-${yesterday}.log`);
  writeFileSync(file, `${kind} line\n`);
  return file;
}

beforeEach(() => {
  rootDir = mkdtempSync(join(tmpdir(), 'ly-log-archive-'));
  logDir = join(rootDir, 'logs');
  archiveDir = join(rootDir, 'logs', 'archive');
  mkdirSync(logDir, { recursive: true });
  const mutable = config.log as unknown as LogConfig;
  mutable.dir = logDir;
  mutable.archiveDir = archiveDir;
  mutable.keepSourceAfterArchive = false;
  mutable.tarBin = 'tar';
});

afterEach(async () => {
  // 先关写流再删目录，否则流会在目录删除后异步打开，刷一串 ENOENT 噪音
  service?.onModuleDestroy();
  // 写流的 open 是异步的：测试的 await 恢复与 afterEach 同处一轮微任务，
  // rmSync 若抢先执行，会在用例已通过后刷一条误导性的 ENOENT。让出一个事件循环轮次。
  await new Promise((resolve) => setImmediate(resolve));
  // 但「让出一轮」并不足够：createWriteStream 的 open 排在 IO 线程池里，负载高时
  // （全量并发跑单测，26 个文件抢线程池）可能晚于 rmSync 才落地——文件被创建在
  // 正在删除的目录里，rmSync 直接抛 ENOTEMPTY 让**已通过的用例变成失败**（实测约 1/5 概率）。
  // 归档后服务只会再写一条「日志归档完成」就静止，所以按 Node 官方建议给 rmSync
  // 重试退避即可（maxRetries 对 ENOTEMPTY/EBUSY/EPERM 生效），不掩盖真实错误。
  rmSync(rootDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  const mutable = config.log as unknown as LogConfig;
  mutable.dir = original.dir;
  mutable.archiveDir = original.archiveDir;
  mutable.keepSourceAfterArchive = original.keepSourceAfterArchive;
  mutable.tarBin = original.tarBin;
});

describe('FileLoggerService 日志归档', () => {
  it('打包昨日日志为 tar.gz，且默认删除源文件', async () => {
    writeYesterdayLog('app');
    writeYesterdayLog('error');
    service = new FileLoggerService({} as unknown as PrismaService);

    await service.archiveYesterday();

    const tarPath = join(archiveDir, yesterday, `${yesterday}.tar.gz`);
    expect(existsSync(tarPath)).toBe(true);
    expect(existsSync(join(logDir, `app-${yesterday}.log`))).toBe(false);
    expect(existsSync(join(logDir, `error-${yesterday}.log`))).toBe(false);
  });

  it('LOG_ARCHIVE_KEEP_SOURCE=true 时保留源文件', async () => {
    (config.log as unknown as LogConfig).keepSourceAfterArchive = true;
    writeYesterdayLog('access');
    service = new FileLoggerService({} as unknown as PrismaService);

    await service.archiveYesterday();

    expect(existsSync(join(archiveDir, yesterday, `${yesterday}.tar.gz`))).toBe(true);
    expect(existsSync(join(logDir, `access-${yesterday}.log`))).toBe(true);
  });

  it('只打包昨天的文件，不动当天与更早的日志', async () => {
    writeYesterdayLog('app');
    writeFileSync(join(logDir, `app-${dayjs().format('YYYY-MM-DD')}.log`), 'today\n');
    writeFileSync(join(logDir, `app-${dayjs().subtract(3, 'day').format('YYYY-MM-DD')}.log`), 'old\n');
    service = new FileLoggerService({} as unknown as PrismaService);

    await service.archiveYesterday();

    expect(existsSync(join(archiveDir, yesterday, `${yesterday}.tar.gz`))).toBe(true);
    expect(existsSync(join(logDir, `app-${dayjs().format('YYYY-MM-DD')}.log`))).toBe(true);
    expect(existsSync(join(logDir, `app-${dayjs().subtract(3, 'day').format('YYYY-MM-DD')}.log`))).toBe(true);
  });

  it('没有昨日日志时空跑返回，且不产生任何目录', async () => {
    service = new FileLoggerService({} as unknown as PrismaService);

    await service.archiveYesterday();

    expect(existsSync(archiveDir)).toBe(false);
    expect(readdirSync(rootDir)).toEqual(['logs']);
  });
});
