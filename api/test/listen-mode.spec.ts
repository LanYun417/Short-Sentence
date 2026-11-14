// DTO 用了 class-validator 装饰器，模块加载即求值——需 reflect-metadata 兜底
// （与 src/main.ts 同一引导；单测不启 Nest 容器，必须自己引入）。
import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { ANSWER_MODES } from '../src/modules/client/questions/dto.js';
import { QuestionsService } from '../src/modules/client/questions/questions.service.js';

/**
 * 盲听模式（P2 第一块：听力）的后端口径。
 *
 * 两条硬约束：
 * 1. 题面模型**不含英文原句**（防偷看答案），盲听靠后端额外下发的 ttsText 朗读，
 *    且该字段只许进 TTS、不进渲染——这里守住「恒定下发」；
 * 2. mode 必须出现在 ANSWER_MODES 白名单里，否则全局 ValidationPipe 会把它
 *    静默剥离，用户切到「盲听」其实还在默写（且毫无提示）。
 */

/** 与 review-source-pool.spec.ts 同构的最小 prisma 桩（只覆盖 next() 读取路径）。 */
function makeService() {
  const prisma: any = {
    sentence: {
      findUnique: vi.fn(async (args: { where: { id: bigint } }) => ({
        id: args.where.id,
        sentenceEn: 'go',
        alternateAnswers: null,
        translationZh: '走',
        ipa: null,
        explanation: null,
        imageFileId: 5n,
        categoryId: 4n,
        difficulty: 1,
        festivalName: null,
        festivalDate: null,
        wordMeanings: null,
        category: { name: '餐饮美食' },
      })),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => [{ sentenceId: 7n }]),
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => []),
    },
    sentenceRecord: {
      findUnique: vi.fn(async () => null),
      count: vi.fn(async () => 0),
      // 首次 = 防重窗口；之后 select 含 nextReviewAt 的归 listReview，其余归 pickDueReview
      findMany: vi.fn(async (args: any) => {
        const select = (args.select ?? {}) as Record<string, unknown>;
        if ('nextReviewAt' in select) {
          return []; // 复习池空：listReview 不参与本组断言
        }
        return [{ sentenceId: 7n }];
      }),
      create: vi.fn(async () => ({ id: 1 })),
      groupBy: vi.fn(async () => []),
    },
    sentenceFavorite: { findUnique: vi.fn(async () => null) },
  };

  const service = new QuestionsService(
    prisma as unknown as PrismaService,
    { findById: vi.fn(async () => ({ fileUrl: 'http://x/y.webp' })) } as never,
    { getToday: vi.fn(async () => null), recordAnswer: vi.fn(async () => {}) } as never,
    {
      awardXp: vi.fn(async () => 0),
      checkAchievements: vi.fn(async () => []),
      awardBadge: vi.fn(async () => {}),
    } as never,
    { recordAnswer: vi.fn(async () => {}) } as never,
  );
  return { service };
}

describe('盲听模式（listen）', () => {
  it('ANSWER_MODES 含 listen，否则模式参数会被 ValidationPipe 静默剥离', () => {
    expect(ANSWER_MODES).toContain('listen');
  });

  it('next() 恒定下发 ttsText（盲听题面的唯一信息源，= 英文原句）', async () => {
    const { service } = makeService();
    const question = await service.next(1);

    expect(question.ttsText).toBe('go');
    // 题面本体不泄露英文：ttsText 之外的任何字段都不该等于答案原句
    expect(question.translationZh).not.toBe(question.ttsText);
  });

  it('ttsText 不依赖 mode：切到盲听沿用当前题即可，无需重抽', async () => {
    const { service } = makeService();
    const question = await service.next(1);

    expect(question.ttsText.length).toBeGreaterThan(0);
  });
});
