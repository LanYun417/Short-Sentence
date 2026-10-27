import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { SentenceGenService } from '../src/modules/sentence/sentence-gen.service.js';
import { AiProviderError } from '../src/common/ai/ai.types.js';

/**
 * 单题重新生图（后台「题库管理」按钮背后的服务逻辑）。
 *
 * 要守住的三条：
 * 1. 题目不存在 → 404；同一题并发点两次 → 409（白烧 Agnes 配额）。
 * 2. **失败必须回滚状态**：置 pending_image 后如果生图挂了，题目不能一直卡在
 *    「待生成」——那等于把它从题库里悄悄下线了。
 * 3. **下架题重新生图后仍是下架**：出图不能被顺手上架。
 */

/** 构造一个只关心 sentence 表的最小 prisma 假对象，并记录每次 update 的 data。 */
function fakePrisma(row: { id: bigint; scenePrompt: string; status: string } | null) {
  const updates: Array<Record<string, unknown>> = [];
  return {
    updates,
    client: {
      sentence: {
        findUnique: async () => row,
        update: async (args: { data: Record<string, unknown> }) => {
          updates.push(args.data);
          return {};
        },
      },
    },
  };
}

/** 生成一张最小的合法 PNG（避开 sharp 读坏图抛错，专注状态流转）。 */
async function tinyPng(): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: '#ffffff' } })
    .png()
    .toBuffer();
}

/** 批量版假 prisma：findMany 返回多行，updateMany 单独记录（含 where.id.in）。 */
function fakePrismaMany(rows: Array<{ id: bigint; scenePrompt: string; status: string }>) {
  const updates: Array<Record<string, unknown>> = [];
  const batchUpdates: Array<{ ids: bigint[]; data: Record<string, unknown> }> = [];
  return {
    updates,
    batchUpdates,
    client: {
      sentence: {
        findUnique: async (args: { where: { id: bigint } }) => rows.find((row) => row.id === args.where.id) ?? null,
        findMany: async () => rows,
        update: async (args: { data: Record<string, unknown> }) => {
          updates.push(args.data);
          return {};
        },
        updateMany: async (args: { where: { id: { in: bigint[] } }; data: Record<string, unknown> }) => {
          updates.push(args.data);
          batchUpdates.push({ ids: args.where.id.in, data: args.data });
          return { count: args.where.id.in.length };
        },
      },
    },
  };
}

/** 装配被测服务（sentenceGen provider 与批次逻辑无关，传空对象即可）。 */
function buildService(prisma: unknown, imageGen: unknown): SentenceGenService {
  const fileService = { save: async () => ({ file: { id: 7 } }) };
  return new SentenceGenService(prisma as never, {} as never, imageGen as never, fileService as never);
}

describe('SentenceGenService.regenerateImage', () => {
  it('题目不存在时抛 404', async () => {
    const prisma = fakePrisma(null);
    const service = buildService(prisma.client, { enabled: true, generate: async () => ({}) });
    await expect(service.regenerateImage(999)).rejects.toMatchObject({ code: 404 });
    expect(prisma.updates).toHaveLength(0);
  });

  it('同一题并发触发时第二次抛 409', async () => {
    const prisma = fakePrisma({ id: 1n, scenePrompt: 'a cafe', status: 'ready' });
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const service = buildService(prisma.client, {
      enabled: true,
      generate: async () => {
        await pending;
        return { buffer: await tinyPng(), mimeType: 'image/png' };
      },
    });

    await service.regenerateImage(1);
    await expect(service.regenerateImage(1)).rejects.toMatchObject({ code: 409 });
    release?.();
    // 让后台任务跑完，避免测试结束时还挂着未完成的 promise
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  it('生图失败时状态回滚为原值（不把题卡在待生成）', async () => {
    const prisma = fakePrisma({ id: 2n, scenePrompt: 'an office', status: 'ready' });
    const service = buildService(prisma.client, {
      enabled: true,
      // retryable=false：不退避，测试立刻走失败分支
      generate: async () => {
        throw new AiProviderError('上游 400', { retryable: false });
      },
    });

    await service.regenerateImage(2);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(prisma.updates.map((item) => item.status)).toEqual(['pending_image', 'ready']);
  });

  it('下架题重新生图成功后仍是下架（不会被顺手上架）', async () => {
    const prisma = fakePrisma({ id: 3n, scenePrompt: 'a shop', status: 'offline' });
    const service = buildService(prisma.client, {
      enabled: true,
      generate: async () => ({ buffer: await tinyPng(), mimeType: 'image/png' }),
    });

    await service.regenerateImage(3);
    await new Promise((resolve) => setTimeout(resolve, 200));
    // 依次：置待生成 → 写入新图（状态沿用 offline）
    expect(prisma.updates[0].status).toBe('pending_image');
    expect(prisma.updates.at(-1)).toMatchObject({ imageFileId: 7n, status: 'offline' });
  });
});

/**
 * 批量重新生图。
 *
 * 与单题版共用的性质不重复测（回滚 / 下架上架在单题 describe 里已钉住），
 * 这里只测批量特有的三件事：
 * 1. **跳过而非整批失败**：不存在的题、正在重新生成的题、已有生图任务在跑的题
 *    各自跳过，其余题照常受理——批量操作最怕「一个坏 id 让整批点不动」。
 * 2. 受理的题都会被置 pending_image，并真的开始生图（不是只改了状态没人跑）。
 * 3. 去重：同一个 id 传两次只受理一次（省配额）。
 */
describe('SentenceGenService.regenerateImages', () => {
  it('按序受理存在的题，跳过不存在 / 正在生成 / 已在出图的题', async () => {
    const prisma = fakePrismaMany([
      { id: 1n, scenePrompt: 'a cafe', status: 'ready' },
      { id: 2n, scenePrompt: 'an office', status: 'ready' },
      // 3n 故意不在 rows 里 = 不存在
      { id: 4n, scenePrompt: 'a gym', status: 'pending_image' },
      { id: 5n, scenePrompt: 'a shop', status: 'offline' },
    ]);
    const generated: string[] = [];
    const service = buildService(prisma.client, {
      enabled: true,
      generate: async (prompt: string) => {
        generated.push(prompt);
        return { buffer: await tinyPng(), mimeType: 'image/png' };
      },
    });

    // 先把 2n 占成「正在重新生图」，验证它会被跳过
    await service.regenerateImage(2);
    const result = await service.regenerateImages([1, 2, 3, 4, 5]);

    expect(result.accepted).toEqual([1, 5]);
    expect(result.skipped).toEqual([2, 3, 4]);
    // 受理的题一次性置 pending_image（单题那次是 2n；批量这次是 1 与 5）
    expect(prisma.batchUpdates).toEqual([{ ids: [1n, 5n], data: { status: 'pending_image' } }]);

    await new Promise((resolve) => setTimeout(resolve, 300));
    // 真的去生图了（1 与 5 各一次；2n 是单题接口那次受理的）
    expect(generated).toEqual(
      expect.arrayContaining([expect.stringContaining('a cafe'), expect.stringContaining('a shop')]),
    );
    // 出图写回：下架的 5n 状态沿用 offline，不会被顺手上架
    expect(prisma.updates.at(-1)).toMatchObject({ imageFileId: 7n, status: 'offline' });
  });

  it('id 去重后受理；全部跳过时不写任何状态', async () => {
    const prisma = fakePrismaMany([
      { id: 1n, scenePrompt: 'a cafe', status: 'ready' },
      { id: 9n, scenePrompt: 'a park', status: 'pending_image' },
    ]);
    const service = buildService(prisma.client, {
      enabled: true,
      generate: async () => ({ buffer: await tinyPng(), mimeType: 'image/png' }),
    });

    const result = await service.regenerateImages([1, 1, 1]);
    expect(result.accepted).toEqual([1]);
    expect(result.skipped).toEqual([]);

    const before = prisma.updates.length;
    const skippedOnly = await service.regenerateImages([9, 9]);
    expect(skippedOnly).toEqual({ accepted: [], skipped: [9] });
    expect(prisma.updates.length).toBe(before);
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  it('生图能力未配置时整体拒绝（503），不写任何状态', async () => {
    const prisma = fakePrismaMany([{ id: 1n, scenePrompt: 'a cafe', status: 'ready' }]);
    const service = buildService(prisma.client, { enabled: false, generate: async () => ({}) });
    await expect(service.regenerateImages([1])).rejects.toMatchObject({ code: 503 });
    expect(prisma.updates).toHaveLength(0);
  });

  it('空 id 列表拒绝（400）', async () => {
    const prisma = fakePrismaMany([]);
    const service = buildService(prisma.client, { enabled: true, generate: async () => ({}) });
    await expect(service.regenerateImages([])).rejects.toMatchObject({ code: 400 });
  });
});
