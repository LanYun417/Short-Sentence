/**
 * tar 归档参数构造单测（纯函数，无 IO）。
 *
 * 归档统一走「spawn cwd=日志目录 + 相对路径」方案：绝对路径里的 Windows 盘符
 * （C:\...）会被 GNU tar 当成远程主机（需 --force-local），而 node 进程 PATH 命中的
 * 往往是 System32 自带 bsdtar，不认 --force-local 直接退出码 1——
 * 相对路径对 GNU tar / bsdtar 都安全，这里钉住参数形态。
 */
import { describe, expect, it } from 'vitest';
import { buildArchiveArgs } from '../src/common/log/file-logger.service.js';

const base = {
  tarPath: 'C:/logs/archive/2026-10-20/2026-10-20.tar.gz',
  workDir: 'C:/logs',
  names: ['app-2026-10-20.log', 'error-2026-10-20.log'],
};

describe('buildArchiveArgs', () => {
  it('产物路径转成相对 workDir 的路径，分隔符统一为 /', () => {
    expect(buildArchiveArgs(base)).toEqual(['-czf', 'archive/2026-10-20/2026-10-20.tar.gz', ...base.names]);
  });

  it('不含任何 -- 长选项，也不再用 -C（cwd 已由 spawn 指定）', () => {
    const args = buildArchiveArgs(base);
    expect(args.some((a) => a.startsWith('--'))).toBe(false);
    expect(args).not.toContain('-C');
  });

  it('names 原样追加在产物路径之后', () => {
    expect(buildArchiveArgs(base).slice(2)).toEqual(base.names);
  });

  it('Unix 风格路径下同样产出相对路径', () => {
    expect(
      buildArchiveArgs({
        tarPath: '/var/log/app/archive/2026-10-20/2026-10-20.tar.gz',
        workDir: '/var/log/app',
        names: ['app-2026-10-20.log'],
      }),
    ).toEqual(['-czf', 'archive/2026-10-20/2026-10-20.tar.gz', 'app-2026-10-20.log']);
  });
});
