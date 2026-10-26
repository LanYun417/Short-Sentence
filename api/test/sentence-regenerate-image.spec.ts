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
