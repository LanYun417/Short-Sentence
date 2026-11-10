/**
 * 情景闯关「剧本封面 AI 生图」单测。
 *
 * 钉住：
 * 1. 生成链路：imageGen 生图（4:3）→ sharp 转 webp → file 落盘 → 回写 stage_script.cover_file_id；
 *    prompt 由「场景名 + 剧本名 + 统一风格后缀」拼成（含 no text 约束）；
 * 2. 幂等：已有封面且 regenerate=false 直接返回已有 URL，不重复生图；
 * 3. regenerate=true 强制重生成；
 * 4. 补生成任务只补缺失封面，单个失败不影响其他；
 * 5. adminScripts / getStages 正确下发剧本封面。
 */
import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { GamifyService } from '../src/modules/client/gamify/gamify.service.js';
import type { AgnesSentenceProvider } from '../src/common/ai/agnes-sentence.provider.js';
import type { AgnesImageProvider } from '../src/common/ai/agnes-image.provider.js';
import type { FileService } from '../src/common/file/file.service.js';
import { StageService } from '../src/modules/client/stage/stage.service.js';
import { STAGE_COVER_STYLE_SUFFIX } from '../src/modules/client/stage/stage-stories.js';
import { makeStageScriptMock, makeStageStoryMock, seedScriptRows, seedStoryRows } from './helpers/stage-story-mock.js';

/** 生成一张最小的合法 PNG（避开 sharp 读坏图抛错，专注状态流转）。 */
async function tinyPng(): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: '#ffffff' } })
    .png()
    .toBuffer();
}

function makeService(opts?: { failOnScriptIds?: number[] }) {
  const scripts = seedScriptRows();
  const stories = seedStoryRows(scripts);
  const stageScript = makeStageScriptMock(scripts);
  const stageStory = makeStageStoryMock(stories);
  const categories = scripts.map((row, index) => ({
    id: row.categoryId,
    name: row.name.replace(' · 默认剧本', ''),
    nameEn: null,
    icon: null,
    status: 1,
    sort: index,
  }));
  const files = new Map<bigint, { fileUrl: string }>();
  let fileSeq = 500n;

  const prisma: any = {
    sentenceCategory: {
      findMany: vi.fn(async () => categories),
      findUnique: vi.fn(async (args: any) => categories.find((c) => c.id === args.where.id) ?? null),
      findFirst: vi.fn(async (args: any) => categories.find((c) => c.name === args.where.name) ?? null),
    },
    stageScript,
    stageStory,
    studyStageProgress: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      groupBy: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    stageDialogueSession: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      groupBy: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    clientXpLog: { findMany: vi.fn(async () => []), findUnique: vi.fn(async () => null) },
    clientUser: { findUnique: vi.fn(async () => ({ xp: 0 })) },
    sentence: { groupBy: vi.fn(async () => []) },
    $queryRaw: vi.fn(async () => []),
    $transaction: async (arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg)),
  };

  const gamify = { awardXp: vi.fn(), checkAchievements: vi.fn() };
  const ai = { stageDialogueTurn: vi.fn(), stageDialogueSummary: vi.fn(), generateStageStory: vi.fn() };
  const imageGen = {
    generate: vi.fn(async (_prompt: string, _options: { size: string; ratio: string }) => {
      const scriptId = Number(_prompt.match(/story #?(\d+)/)?.[1] ?? 0);
      if (opts?.failOnScriptIds?.includes(scriptId)) throw new Error('生图接口炸了');
      // 用剧本名反查 id 不可靠，改成按调用顺序失败：这里由测试用 failOnScriptIds 控制
      return { buffer: await tinyPng(), mimeType: 'image/png' };
    }),
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

  const service = new StageService(
    prisma as unknown as PrismaService,
    gamify as unknown as GamifyService,
    ai as unknown as AgnesSentenceProvider,
    imageGen as unknown as AgnesImageProvider,
    fileService as unknown as FileService,
  );
  return { service, prisma, scripts, stories, stageScript, stageStory, imageGen, fileService, files };
}

describe('generateScriptCover：AI 生图链路与幂等', () => {
  it('生成封面：prompt 含剧本名与风格后缀，落盘后回写 coverFileId 并返回 URL', async () => {
    const { service, scripts, stageScript, imageGen, fileService } = makeService();
    const script = scripts[0];

    const result = await service.generateScriptCover(Number(script.id));

    expect(imageGen.generate).toHaveBeenCalledTimes(1);
    const prompt = imageGen.generate.mock.calls[0][0] as string;
    expect(prompt).toContain(script.name);
    expect(prompt).toContain(STAGE_COVER_STYLE_SUFFIX);
    expect(prompt).toContain('no text');
    expect(imageGen.generate.mock.calls[0][1]).toMatchObject({ ratio: '4:3' });
    expect(fileService.save).toHaveBeenCalledTimes(1);
    expect(fileService.save.mock.calls[0][0]).toBe(`stage-script-cover-${script.id}.webp`);

    const row = stageScript.rows.find((item) => item.id === script.id)!;
    expect(row.coverFileId).toBeGreaterThan(0n);
    expect(result.coverUrl).toBe(`/uploads/stage-script-cover-${script.id}.webp`);
  });

  it('已有封面且 regenerate=false：直接返回已有 URL，不重复生图', async () => {
    const { service, scripts, imageGen } = makeService();
    const first = await service.generateScriptCover(Number(scripts[0].id));
    imageGen.generate.mockClear();
    const second = await service.generateScriptCover(Number(scripts[0].id));
    expect(imageGen.generate).not.toHaveBeenCalled();
    expect(second.coverUrl).toBe(first.coverUrl);
  });

  it('regenerate=true 强制重生成', async () => {
    const { service, scripts, imageGen } = makeService();
    await service.generateScriptCover(Number(scripts[0].id));
    imageGen.generate.mockClear();
    await service.generateScriptCover(Number(scripts[0].id), true);
    expect(imageGen.generate).toHaveBeenCalledTimes(1);
  });

  it('剧本不存在 → 404', async () => {
    const { service } = makeService();
    await expect(service.generateScriptCover(9999)).rejects.toMatchObject({ code: 404 });
  });
});

describe('generateMissingScriptCovers：只补缺失', () => {
  it('已有封面的跳过，缺失的生成，失败的记入 failed', async () => {
    const { service, scripts, stageScript, imageGen } = makeService();
    // 先给第一个剧本生成封面
    await service.generateScriptCover(Number(scripts[0].id));
    imageGen.generate.mockClear();
    // 让第二个剧本生图失败：按调用次数抛错（第一次调用对应第二个剧本）
    let calls = 0;
    imageGen.generate.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) throw new Error('生图接口炸了');
      return { buffer: await tinyPng(), mimeType: 'image/png' };
    });

    const result = await service.generateMissingScriptCovers();
    expect(result.skipped).toContain(Number(scripts[0].id));
    expect(result.failed).toHaveLength(1);
    expect(result.generated.length).toBe(scripts.length - 2);
    // 第一个剧本的封面没有被重新生成
    expect(stageScript.rows[0].coverFileId).toBeGreaterThan(0n);
  });
});

describe('adminScripts / getStages 下发剧本封面', () => {
  it('adminScripts 带 coverUrl 与关卡数；getStages 的章节封面同步', async () => {
    const { service, scripts } = makeService();
    await service.generateScriptCover(Number(scripts[0].id));

    const list = await service.adminScripts();
    const hit = list.find((item) => item.id === Number(scripts[0].id))!;
    expect(hit.coverUrl).toBe(`/uploads/stage-script-cover-${scripts[0].id}.webp`);
    expect(hit.stageCount).toBeGreaterThan(0);
    expect(hit.enabledStageCount).toBe(hit.stageCount);

    const overview = await service.getStages(1);
    const chapter = overview.chapters.find((c) => c.key === `script-${scripts[0].id}`)!;
    expect(chapter.coverUrl).toBe(`/uploads/stage-script-cover-${scripts[0].id}.webp`);
    // 场景卡封面取第一个有封面的剧本
    const scene = overview.scenes.find((s) => s.id === Number(scripts[0].categoryId))!;
    expect(scene.coverUrl).toBe(chapter.coverUrl);
  });
});
