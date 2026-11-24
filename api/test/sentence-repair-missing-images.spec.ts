import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_ADVANCED } from '../src/common/ai/ai-protocol.js';
import { SentenceGenService } from '../src/modules/sentence/sentence-gen.service.js';

/**
 * 后台「补全缺失配图」按钮背后的服务逻辑（repairMissingImages）。
 *
 * 要守住的四条：
 * 1. 只认「磁盘上真的没文件」的题——文件还在的绝不重复烧配额；
 * 2. 单次最多受理 50 张——一次性把上千张塞进队列会堆几小时并打爆 Agnes 按小时配额；
 * 3. 没有缺图时直接返回零，不进生图流程；
 * 4. SQL 口径限定 ready / 未退场 / image_file_id>0，这些由查询负责（此处验证结果映射）。
 */

/** 装配一个最小 service：只需要 $queryRaw、imageGen.enabled 与一个可 spy 的 regenerateImages。 */
function buildService(rows: Array<{ id: bigint; file_path: string | null }>) {
  const prisma = {
    $queryRaw: vi.fn().mockResolvedValue(rows),
  };
  const imageGen = { enabled: true };
  const aiSettings = {
    current: {
      models: [
        {
          id: 'image-1',
          purpose: 'image',
          enabled: true,
          format: 'openai_chat',
          fullUrl: false,
          baseUrl: 'https://example.com/v1',
          modelId: 'agnes-image',
          modelLabel: '',
          apiKey: 'k',
          advanced: { ...DEFAULT_ADVANCED },
        },
      ],
    },
  } as never;
  const service = new SentenceGenService(
    prisma as never,
    {} as never,
    imageGen as never,
    {} as never,
    {} as never,
    aiSettings,
  );
  return { service, prisma };
}

describe('SentenceGenService.repairMissingImages', () => {
  it('只受理磁盘文件真正缺失的题，存在的跳过', async () => {
    // 用真实项目根下必然不存在 / 必然存在的路径来验证映射口径
    const rows = [
      { id: 1n, file_path: 'uploads/webp/__definitely_missing__.webp' },
      { id: 2n, file_path: 'uploads/.gitkeep' }, // 真实存在的文件
      { id: 3n, file_path: null },
    ];
    const { service, prisma } = buildService(rows);
    const spy = vi.spyOn(service, 'regenerateImages').mockResolvedValue({ accepted: [1, 3], skipped: [] });

    const result = await service.repairMissingImages();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toEqual([1, 3]); // 只把缺图题送进重生流程
    expect(result).toEqual({ scanned: 2, accepted: 2, skipped: 0, remaining: 0 });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    // 顺带确保 SQL 口径含三条件
    const sql = String(prisma.$queryRaw.mock.calls[0]?.[0]);
    expect(sql).toContain("status = 'ready'");
    expect(sql).toContain('retired_at IS NULL');
    expect(sql).toContain('image_file_id > 0');
  });

  it('单次最多受理 50 张，剩余数量如实回给前端', async () => {
    const rows = Array.from({ length: 120 }, (_, i) => ({
      id: BigInt(i + 1),
      file_path: `uploads/webp/__missing_${i}__.webp`,
    }));
    const { service } = buildService(rows);
    const spy = vi
      .spyOn(service, 'regenerateImages')
      .mockImplementation(async (ids) => ({ accepted: ids, skipped: [] }));

    const result = await service.repairMissingImages();

    expect(spy.mock.calls[0]?.[0]).toHaveLength(50);
    expect(result.scanned).toBe(120);
    expect(result.accepted).toBe(50);
    expect(result.remaining).toBe(70);
  });

  it('没有缺图时不进生图流程', async () => {
    const { service } = buildService([{ id: 1n, file_path: 'uploads/.gitkeep' }]);
    const spy = vi.spyOn(service, 'regenerateImages');

    const result = await service.repairMissingImages();

    expect(spy).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 0, accepted: 0, skipped: 0, remaining: 0 });
  });
});
