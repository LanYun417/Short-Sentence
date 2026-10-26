/**
 * 答题「防重放」单测。
 *
 * 回归点：XP 的幂等键是「作答记录 id」，而记录**每次都新生成**，
 * 所以单靠幂等挡不住脚本拿已知答案反复提交同一句（能同时刷经验、刷今日完成数，
 * 还会把复习等级一路顶到最高）。
 *
 * 口径：上一轮**答对**且复习期未到 → 只判分，不落记录、不发经验、不计打卡；
 * 「答错」的 nextReviewAt 恒为 now（当天立即复现），因此错题回路不受影响。
 */
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { CheckinService } from '../src/modules/client/checkin/checkin.service.js';
import type { GamifyService } from '../src/modules/client/gamify/gamify.service.js';
import type { FileService } from '../src/common/file/file.service.js';
import { QuestionsService } from '../src/modules/client/questions/questions.service.js';

/** 造一个只实现本用例用到方法的假 Prisma。 */
function fakePrisma(options: { nextReviewAt: Date | null; hasRecord: boolean }) {
  return {
    sentence: {
      findFirst: vi.fn().mockResolvedValue({
        id: 1117n,
        sentenceEn: 'I will call you as soon as I arrive.',
        alternateAnswers: null,
        translationZh: '我一到就会给你打电话。',
        ipa: null,
        imageFileId: 0n,
      }),
    },
    sentenceRecord: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options.hasRecord ? { reviewLevel: 2, nextReviewAt: options.nextReviewAt } : null),
      create: vi.fn().mockResolvedValue({ id: 900n }),
    },
    sentenceFavorite: { findUnique: vi.fn().mockResolvedValue(null) },
  } as unknown as PrismaService;
}

/** 组装被测服务（只注入本用例用到的方法）。 */
function buildService(prisma: PrismaService) {
  const checkin = {
    getToday: vi.fn().mockResolvedValue({ doneCount: 5, completed: false, date: '2026-10-26' }),
    recordAnswer: vi.fn().mockResolvedValue(undefined),
  } as unknown as CheckinService;
  const gamify = {
    awardXp: vi.fn().mockResolvedValue(true),
    checkAchievements: vi.fn().mockResolvedValue([]),
  } as unknown as GamifyService;
  const fileService = { findById: vi.fn().mockResolvedValue(null) } as unknown as FileService;
  return { service: new QuestionsService(prisma, fileService, checkin, gamify), checkin, gamify };
}

const ANSWER = { userAnswer: 'I will call you as soon as I arrive.', elapsedMs: 1000, mode: 'input' } as never;

describe('QuestionsService.answer 防重放', () => {
  it('复习期未到的重复作答：只判分，不落记录 / 不发经验 / 不计打卡', async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const prisma = fakePrisma({ hasRecord: true, nextReviewAt: future });
    const { service, checkin, gamify } = buildService(prisma);

    const result = await service.answer(21, 1117, ANSWER);

    expect(result.isCorrect).toBe(true);
    expect(result.repeated).toBe(true);
    expect(result.xpEarned).toBe(0);
    // 三条「不得发生」的副作用
    expect((prisma as unknown as { sentenceRecord: { create: unknown } }).sentenceRecord.create).not.toHaveBeenCalled();
    expect(checkin.recordAnswer).not.toHaveBeenCalled();
    expect(gamify.awardXp).not.toHaveBeenCalled();
  });

  it('复习期已到（正常复习）：照常落记录并发经验', async () => {
    const past = new Date(Date.now() - 60 * 1000);
    const prisma = fakePrisma({ hasRecord: true, nextReviewAt: past });
    const { service, checkin, gamify } = buildService(prisma);

    const result = await service.answer(21, 1117, ANSWER);

    expect(result.repeated).toBeUndefined();
    expect(result.xpEarned).toBe(5); // 复习答对
    expect((prisma as unknown as { sentenceRecord: { create: unknown } }).sentenceRecord.create).toHaveBeenCalled();
    expect(checkin.recordAnswer).toHaveBeenCalled();
    expect(gamify.awardXp).toHaveBeenCalled();
  });

  it('首次作答（无历史记录）：不受防重放影响', async () => {
    const prisma = fakePrisma({ hasRecord: false, nextReviewAt: null });
    const { service, gamify } = buildService(prisma);

    const result = await service.answer(21, 1117, ANSWER);

    expect(result.repeated).toBeUndefined();
    expect(result.xpEarned).toBe(10); // 首次答对
    expect(gamify.awardXp).toHaveBeenCalled();
  });
});
