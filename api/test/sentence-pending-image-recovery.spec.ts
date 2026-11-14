import { describe, expect, it, vi } from 'vitest';
import { SentenceGenService } from '../src/modules/sentence/sentence-gen.service.js';

/**
 * 启动补偿：`onModuleInit` 把「配图已入库、却卡在 pending_image」的节日批次题恢复 ready。
 *
 * 背景见 sentence-gen.service.ts 的方法注释——进程在生图批次中途被关机时，
 * 图片已落库但状态没推进，用户端节日题库会出现题数缩水甚至整节消失。
 *
 * 这里守住四条：
 * 1. 只捞有图（imageFileId>0）、未退场、仍是 pending_image 的题，不碰无图题；
 * 2. 限定节日题库且非手工题（genTaskId>0），不改写运营日常题；
 * 3. 有 10 分钟陈旧阈值，避开刚发起的「重新生图」；
 * 4. 补偿失败绝不阻断应用启动，且方法幂等（返回 0 时不打扰动日志）。
 */

type UpdateManyArgs = { where: Record<string, unknown>; data: Record<string, unknown> };

function buildService(count: number, error?: Error) {
  const calls: UpdateManyArgs[] = [];
  const prisma = {
    sentence: {
      updateMany: async (args: UpdateManyArgs) => {
        calls.push(args);
        if (error) throw error;
        return { count };
      },
    },
    // onModuleInit 会连带跑僵尸批次回收，给一个返回 0 的假实现，避免无关注释噪音
    sentenceGenTask: {
      updateMany: async () => ({ count: 0 }),
    },
  };
  const service = new SentenceGenService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, calls };
}

describe('SentenceGenService.recoverStalePendingImages', () => {
  it('按四重条件筛选，并把命中题置为 ready', async () => {
    const { service, calls } = buildService(131);

    const recovered = await service.recoverStalePendingImages();

    expect(recovered).toBe(131);
    expect(calls).toHaveLength(1);
    const { where, data } = calls[0]!;
    expect(data).toEqual({ status: 'ready' });
    expect(where.status).toBe('pending_image');
    // 没有配图的题仍在等待生图，强行置 ready 会下发无图题卡
    expect(where.imageFileId).toEqual({ gt: 0n });
    expect(where.retiredAt).toBeNull();
    // 排除手工题，避免运营手工创建的题被批量改写
    expect(where.genTaskId).toEqual({ gt: 0n });
    // 限定节日题库：非空且非空白串
    expect(where.festivalName).toEqual({ not: null });
    expect(where.NOT).toEqual({ festivalName: '' });
    // 10 分钟陈旧阈值：避开运营刚点「重新生图」的短窗口
    expect(where.updatedAt).toMatchObject({ lt: expect.any(Date) });
    const staleBefore = (where.updatedAt as { lt: Date }).lt;
    expect(Date.now() - staleBefore.getTime()).toBeGreaterThanOrEqual(10 * 60 * 1000 - 1000);
    expect(Date.now() - staleBefore.getTime()).toBeLessThan(10 * 60 * 1000 + 1000);
  });

  it('没有孤儿题时返回 0（幂等，重复执行无副作用）', async () => {
    const { service, calls } = buildService(0);
    expect(await service.recoverStalePendingImages()).toBe(0);
    expect(await service.recoverStalePendingImages()).toBe(0);
    expect(calls).toHaveLength(2);
  });

  it('数据库异常时不阻断启动，且仍可安全重试', async () => {
    const { service } = buildService(0, new Error('db down'));
    const warn = vi
      .spyOn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).logger,
        'warn',
      )
      .mockImplementation(() => undefined);

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('启动补偿失败'));
    warn.mockRestore();
  });

  it('恢复数量大于 0 时记录一条启动日志', async () => {
    const { service } = buildService(3);
    const log = vi
      .spyOn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).logger,
        'log',
      )
      .mockImplementation(() => undefined);

    await service.onModuleInit();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('3 题已有配图'));
    log.mockRestore();
  });
});

describe('SentenceGenService.recoverStaleBatches', () => {
  /** 构造带 sentenceGenTask.updateMany 的最小 prisma 假对象。 */
  function buildBatchService(count: number, error?: Error) {
    const calls: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];
    const prisma = {
      sentence: { updateMany: async () => ({ count: 0 }) },
      sentenceGenTask: {
        updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          calls.push(args);
          if (error) throw error;
          return { count };
        },
      },
    };
    const service = new SentenceGenService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, calls };
  }

  it('只回收 running/pending 且心跳超时的批次，并写明失败原因', async () => {
    const { service, calls } = buildBatchService(9);

    const recovered = await service.recoverStaleBatches();

    expect(recovered).toBe(9);
    expect(calls).toHaveLength(1);
    const { where, data } = calls[0]!;
    // 只碰运行中/待处理，已终态（success/failed/cancelled/paused）绝不动
    expect(where.status).toEqual({ in: ['running', 'pending'] });
    // 心跳超时；从未有心跳的按 createdAt 兜底，避免漏掉创建后就没起来的批次
    const conditions = where.OR as Array<Record<string, any>>;
    expect(conditions).toHaveLength(2);
    expect(conditions[0]).toMatchObject({ lastHeartbeatAt: { lt: expect.any(Date) } });
    expect(conditions[1]).toMatchObject({ lastHeartbeatAt: null, createdAt: { lt: expect.any(Date) } });
    expect(data.status).toBe('failed');
    expect(data.errorMessage).toContain('心跳超时');
    expect(data.finishedAt).toBeInstanceOf(Date);
  });

  it('心跳阈值约 30 分钟', async () => {
    const { service, calls } = buildBatchService(0);
    await service.recoverStaleBatches();
    const stale = (calls[0]!.where.OR as Array<Record<string, any>>)[0].lastHeartbeatAt.lt as Date;
    const elapsed = Date.now() - stale.getTime();
    expect(elapsed).toBeGreaterThanOrEqual(30 * 60 * 1000 - 1000);
    expect(elapsed).toBeLessThan(30 * 60 * 1000 + 1000);
  });

  it('没有僵尸批次时返回 0', async () => {
    const { service } = buildBatchService(0);
    expect(await service.recoverStaleBatches()).toBe(0);
  });

  it('数据库异常不阻断应用启动', async () => {
    const { service } = buildBatchService(0, new Error('db down'));
    await expect(service.recoverStaleBatches()).resolves.toBe(0);
  });
});
