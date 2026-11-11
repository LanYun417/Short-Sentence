/**
 * 场景封面 AI 生成单测（SentenceGenService.generateCategoryCover / generateMissingCategoryCovers）。
 *
 * 钉住：
 * 1. 生成链路：生图（4:3 config.stage）→ 视觉审核 → webp 落盘 → 回写 sentence_category.cover_file_id；
 * 2. 已有封面且 regenerate=false 直接返回已有 URL，不重复生图；
 * 3. regenerate=true 强制重生成；审核不通过 → 400 且不回写；
 * 4. 分类不存在 404 / 停用 400；
 * 5. 补生成任务只补缺失封面，单个失败不影响其他。
 */
import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { FileService } from '../src/common/file/file.service.js';
import type { AgnesSentenceProvider } from '../src/common/ai/agnes-sentence.provider.js';
import type { AgnesImageProvider } from '../src/common/ai/agnes-image.provider.js';
import { SentenceGenService } from '../src/modules/sentence/sentence-gen.service.js';

/** 生成一张最小的合法 PNG。 */
async function tinyPng(): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: '#ffffff' } })
    .png()
    .toBuffer();
}

function makeService(opts?: { reviewPass?: boolean }) {
  const categories: Array<Record<string, any>> = [
    { id: 1n, name: '日常生活', nameEn: 'Daily Life', status: 1, coverFileId: 0n },
    { id: 2n, name: '职场办公', nameEn: 'Work', status: 1, coverFileId: 0n },
    { id: 3n, name: '旅行出行', nameEn: 'Travel', status: 0, coverFileId: 0n },
  ];
  const files = new Map<bigint, { fileUrl: string }>();
  let fileSeq = 700n;
  /** 封面生成业务日志（recordCoverLog 写入 ai_call_log 的 data） */
  const logs: Array<Record<string, any>> = [];

  const prisma: any = {
    aiCallLog: {
      create: vi.fn(async (args: any) => {
        logs.push(args.data);
        return { id: 1n };
      }),
    },
    sentenceCategory: {
      findUnique: vi.fn(async (args: any) => categories.find((row) => row.id === args.where.id) ?? null),
      findMany: vi.fn(async (args?: any) =>
        (args?.where?.status !== undefined
          ? categories.filter((c) => c.status === args.where.status)
          : categories
        ).filter((row) => args?.where?.coverFileId === undefined || row.coverFileId === args.where.coverFileId),
      ),
      update: vi.fn(async (args: any) => {
        const row = categories.find((item) => item.id === args.where.id);
        Object.assign(row!, args.data);
        return row;
      }),
    },
  };

  const sentenceGen = {
    reviewImage: vi.fn(async () => ({ pass: opts?.reviewPass ?? true, reason: '' })),
  };
  const imageGen = {
    generate: vi.fn(async (_prompt: string, _options: { size: string; ratio: string }) => ({
      buffer: await tinyPng(),
      mimeType: 'image/png',
    })),
  };
  const fileService = {
    save: vi.fn(async (name: string) => {
      const id = fileSeq++;
      const fileUrl = `/uploads/${name}`;
      files.set(id, { fileUrl });
      return { duplicated: false, file: { id, fileUrl } };
    }),
    findById: vi.fn(async (id: number) => {
      const hit = files.get(BigInt(id));
      return hit ? { id: BigInt(id), fileUrl: hit.fileUrl } : null;
    }),
  };

  const service = new SentenceGenService(
    prisma as unknown as PrismaService,
    sentenceGen as unknown as AgnesSentenceProvider,
    imageGen as unknown as AgnesImageProvider,
    fileService as unknown as FileService,
    {} as never,
    { current: { imageModel: 'agnes-image-2.5-flash' } } as never,
  );
  return { service, prisma, categories, sentenceGen, imageGen, fileService, files, logs };
}

describe('generateCategoryCover：AI 生图链路与幂等', () => {
  it('生成封面：审核通过后落盘并回写分类封面，返回 URL', async () => {
    const { service, categories, sentenceGen, imageGen, fileService } = makeService();
    const result = await service.generateCategoryCover(1);

    expect(imageGen.generate).toHaveBeenCalledTimes(1);
    const prompt = imageGen.generate.mock.calls[0][0] as string;
    expect(prompt).toContain('日常生活');
    expect(prompt).toContain('Daily Life');
    expect(imageGen.generate.mock.calls[0][1]).toMatchObject({ ratio: '4:3' });
    expect(sentenceGen.reviewImage).toHaveBeenCalledTimes(1);
    expect(fileService.save).toHaveBeenCalledTimes(1);
    expect(fileService.save.mock.calls[0][0]).toBe('stage-scene-cover-1.webp');
    expect(categories[0].coverFileId).toBeGreaterThan(0n);
    expect(result.coverUrl).toBe(`/uploads/stage-scene-cover-1.webp`);
  });

  it('已有封面且 regenerate=false：直接返回已有 URL，不重复生图', async () => {
    const { service, imageGen } = makeService();
    const first = await service.generateCategoryCover(1);
    imageGen.generate.mockClear();
    const second = await service.generateCategoryCover(1);
    expect(imageGen.generate).not.toHaveBeenCalled();
    expect(second.coverUrl).toBe(first.coverUrl);
  });

  it('regenerate=true 强制重生成', async () => {
    const { service, imageGen } = makeService();
    await service.generateCategoryCover(1);
    imageGen.generate.mockClear();
    await service.generateCategoryCover(1, true);
    expect(imageGen.generate).toHaveBeenCalledTimes(1);
  });

  it('审核不通过 → 400，且不回写封面字段', async () => {
    const { service, categories } = makeService({ reviewPass: false });
    await expect(service.generateCategoryCover(1)).rejects.toMatchObject({ code: 400 });
    expect(categories[0].coverFileId).toBe(0n);
  });

  it('分类不存在 404；分类停用 400', async () => {
    const { service } = makeService();
    await expect(service.generateCategoryCover(999)).rejects.toMatchObject({ code: 404 });
    await expect(service.generateCategoryCover(3)).rejects.toMatchObject({ code: 400 });
  });
});

describe('generateMissingCategoryCovers：只补缺失', () => {
  it('跳过往有封面的，生成缺失的；失败的计入 failed', async () => {
    const { service, categories, imageGen } = makeService();
    // 第一个分类先生成封面
    await service.generateCategoryCover(1);
    imageGen.generate.mockClear();
    // 第三个分类让生图失败（调用顺序里第一次调用对应旅行出行——但它已停用，
    // 所以改为：第二次调用（职场办公）失败）
    let calls = 0;
    imageGen.generate.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) throw new Error('生图接口炸了');
      return { buffer: await tinyPng(), mimeType: 'image/png' };
    });

    const result = await service.generateMissingCategoryCovers();
    // 启用的只有 1/2 两个分类；1 已有封面跳过；2 失败
    expect(result.generated).toEqual([]);
    expect(result.failed).toEqual([2]);
    expect(categories[0].coverFileId).toBeGreaterThan(0n);
  });

  it('全部缺失时全部生成', async () => {
    const { service } = makeService();
    const result = await service.generateMissingCategoryCovers();
    expect(result.generated).toEqual([1, 2]);
    expect(result.failed).toEqual([]);
  });
});

describe('封面视觉审核不通过：自动重新生成并落业务日志', () => {
  it('首次审核不通过自动重抽，第二次通过则成功，日志含审核原因', async () => {
    const { service, sentenceGen, imageGen, logs } = makeService();
    let reviews = 0;
    sentenceGen.reviewImage.mockImplementation(async () => {
      reviews += 1;
      return reviews === 1 ? { pass: false, reason: 'illegible gibberish characters' } : { pass: true, reason: '' };
    });

    const result = await service.generateCategoryCover(1);
    expect(result.coverUrl).toContain('stage-scene-cover-1.webp');
    expect(imageGen.generate).toHaveBeenCalledTimes(2);
    const rejected = logs.filter((row) => row.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0].type).toBe('cover_gen');
    expect(rejected[0].errorMessage).toContain('illegible gibberish characters');
    expect(rejected[0].errorMessage).toContain('场景分类·日常生活');
    expect(logs.filter((row) => row.status === 'success')).toHaveLength(1);
  });

  it('连续 3 次审核不通过才判失败，生成异常不叠加外层重试', async () => {
    const { service, imageGen, logs } = makeService({ reviewPass: false });
    await expect(service.generateCategoryCover(1)).rejects.toMatchObject({ code: 400 });
    expect(imageGen.generate).toHaveBeenCalledTimes(3);
    expect(logs.filter((row) => row.status === 'rejected')).toHaveLength(3);
    expect(logs.filter((row) => row.status === 'failed')).toHaveLength(1);
  });

  it('上游生图异常直接抛出，不重复烧配额', async () => {
    const { service, imageGen, logs } = makeService();
    imageGen.generate.mockImplementation(async () => {
      throw new Error('生图接口炸了');
    });
    await expect(service.generateCategoryCover(1)).rejects.toThrow('生图接口炸了');
    expect(imageGen.generate).toHaveBeenCalledTimes(1);
    expect(logs.filter((row) => row.status === 'failed')).toHaveLength(1);
  });
});

describe('regenerateAllCategoryCovers：强制重生成启用分类', () => {
  it('已有封面也覆盖，停用的不处理，单个失败不影响其他', async () => {
    const { service, imageGen } = makeService();
    // 先让分类 1 有封面，验证 force=true 仍会重生成
    await service.generateCategoryCover(1);
    imageGen.generate.mockClear();

    const result = await service.regenerateAllCategoryCovers();
    expect(result.generated).toEqual([1, 2]);
    expect(result.failed).toEqual([]);
    expect(imageGen.generate).toHaveBeenCalledTimes(2);
  });

  it('单个生图失败只计入 failed，其余继续', async () => {
    const { service, imageGen } = makeService();
    imageGen.generate.mockImplementation(async () => {
      throw new Error('生图接口炸了');
    });

    const result = await service.regenerateAllCategoryCovers();
    expect(result.generated).toEqual([]);
    expect(result.failed).toEqual([1, 2]);
  });
});
