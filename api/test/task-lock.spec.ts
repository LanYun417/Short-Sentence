/**
 * 定时任务分布式锁。
 *
 * 多副本部署时同一 cron 会在每个实例上触发：Redis SETNX 保证只有一个实例真正执行，
 * 其他实例记一条 SKIPPED(3) 执行记录后跳过。Redis 未配置（单实例）时退化为直接执行。
 */
import { describe, expect, it, vi } from 'vitest';
import { TaskRunStatus, TaskTrigger } from '../src/common/config/constants.js';
import { TaskService } from '../src/modules/task/task.service.js';

interface FakeRedis {
  ready: boolean;
  setNx: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  isReady: () => boolean;
}

function makeService(redis: FakeRedis, handler: ReturnType<typeof vi.fn>) {
  const prisma = {
    taskLog: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        (prisma as unknown as { rows: unknown[] }).rows.push(args.data);
        return { id: BigInt((prisma as unknown as { rows: unknown[] }).rows.length) };
      }),
      update: vi.fn(async () => undefined),
    },
    rows: [] as unknown[],
  };
  const service = new TaskService(
    prisma as never,
    { doesExist: () => false } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    redis as never,
    {} as never,
  );
  (service as unknown as { definitions: Map<string, unknown> }).definitions.set('demo', {
    name: 'demo',
    title: '演示任务',
    enabled: true,
    handler,
  });
  return { service, prisma };
}

function redisWith(ready: boolean, setNxResult: boolean): FakeRedis {
  return {
    ready,
    setNx: vi.fn(async () => setNxResult),
    get: vi.fn(async () => 'some-instance'),
    del: vi.fn(async () => true),
    isReady() {
      return this.ready;
    },
  };
}

describe('runTask 分布式锁', () => {
  it('拿到锁：正常执行，结束后释放自己持有的锁', async () => {
    const redis = redisWith(true, true);
    redis.get.mockResolvedValue('whatever-instance-id');
    const handler = vi.fn(async () => undefined);
    const { service } = makeService(redis, handler);

    const result = await service.runTask('demo', TaskTrigger.AUTO, null);

    expect(result.status).toBe(TaskRunStatus.SUCCESS);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(redis.setNx).toHaveBeenCalledWith('task:lock:demo', expect.any(String), expect.any(Number));
    // get 返回的值不是本实例 id → 不误删
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('锁被别人持有（AUTO）：不执行 handler，记 SKIPPED 并返回 SKIPPED', async () => {
    const redis = redisWith(true, false);
    const handler = vi.fn(async () => undefined);
    const { service, prisma } = makeService(redis, handler);

    const result = await service.runTask('demo', TaskTrigger.AUTO, null);

    expect(result.status).toBe(TaskRunStatus.SKIPPED);
    expect(handler).not.toHaveBeenCalled();
    expect((prisma.rows[0] as { status: number }).status).toBe(TaskRunStatus.SKIPPED);
  });

  it('锁被别人持有（MANUAL）：抛 conflict 告诉操作员去看执行记录', async () => {
    const redis = redisWith(true, false);
    const handler = vi.fn(async () => undefined);
    const { service } = makeService(redis, handler);

    await expect(service.runTask('demo', TaskTrigger.MANUAL, 'admin')).rejects.toThrow(/其他实例/);
    expect(handler).not.toHaveBeenCalled();
  });

  it('Redis 未配置（单实例）：不加锁直接执行，行为与改前一致', async () => {
    const redis = redisWith(false, false);
    const handler = vi.fn(async () => undefined);
    const { service } = makeService(redis, handler);

    const result = await service.runTask('demo', TaskTrigger.AUTO, null);

    expect(result.status).toBe(TaskRunStatus.SUCCESS);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(redis.setNx).not.toHaveBeenCalled();
  });
});
