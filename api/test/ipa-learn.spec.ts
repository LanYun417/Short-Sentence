import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { IpaService } from '../src/modules/client/ipa/ipa.service.js';
import type { GamifyService } from '../src/modules/client/gamify/gamify.service.js';

/**
 * 音标学习的核心不变量：
 * 1. 测验判分**只看示例词关系**：看词选音标、看音标选词两个方向都得由服务端判，
 *    客户端上报什么（哪怕是「我全对」）都不能凭空拿到 XP；
 * 2. 题干/答案不在音标库里的（前端乱造），一律判错、不崩；
 * 3. 「学会了」每音标只发一次 XP（幂等），重复标记不再发；
 * 4. 测验 XP 按「音标+日期」幂等，同一天同一音标重复答对只发一次。
 */

const PHONEMES = [
  { id: 1n, symbol: 'iː', type: 'consonant_voiceless', exampleWords: '["see","tree","meat"]', tips: '' },
  { id: 2n, symbol: 'æ', type: 'vowel', exampleWords: '["cat","apple","hand"]', tips: '' },
];

function makeService() {
  const records: Array<Record<string, unknown>> = [];
  const xpCalls: Array<{ userId: number; eventType: string; key: string; amount: number }> = [];

  const prisma = {
    ipaPhoneme: {
      findMany: vi.fn(async () => PHONEMES),
      findUnique: vi.fn(
        async ({ where }: { where: { symbol: string } }) => PHONEMES.find((p) => p.symbol === where.symbol) ?? null,
      ),
      count: vi.fn(async () => PHONEMES.length),
    },
    ipaLearningRecord: {
      findMany: vi.fn(async () => records),
      findUnique: vi.fn(
        async ({ where }: { where: { userId_phonemeId: { userId: bigint; phonemeId: bigint } } }) =>
          records.find(
            (r) =>
              String(r.userId) === String(where.userId_phonemeId.userId) &&
              String(r.phonemeId) === String(where.userId_phonemeId.phonemeId),
          ) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: BigInt(records.length + 1), ...data };
        records.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: bigint }; data: Record<string, unknown> }) => {
        const row = records.find((r) => r.id === where.id);
        if (!row) throw new Error('record not found');
        Object.assign(row, data);
        return row;
      }),
      upsert: vi.fn(
        async ({
          where,
          create,
        }: {
          where: { userId_phonemeId: { userId: bigint; phonemeId: bigint } };
          create: Record<string, unknown>;
        }) => {
          const existed = records.find(
            (r) =>
              String(r.userId) === String(where.userId_phonemeId.userId) &&
              String(r.phonemeId) === String(where.userId_phonemeId.phonemeId),
          );
          if (existed) return existed;
          const row = { id: BigInt(records.length + 1), ...create };
          records.push(row);
          return row;
        },
      ),
      count: vi.fn(async () => records.filter((r) => r.learnedAt).length),
    },
  };
  const gamify = {
    awardXp: vi.fn(async (userId: number, eventType: string, key: string, amount: number) => {
      xpCalls.push({ userId, eventType, key, amount });
      return true;
    }),
  } as unknown as GamifyService;
  return { service: new IpaService(prisma as unknown as PrismaService, gamify), records, xpCalls };
}

describe('音标学习', () => {
  it('看词选音标：选对才判对', async () => {
    const { service } = makeService();
    const result = await service.submitQuiz(7, {
      answers: [
        { type: 'word_to_phoneme', prompt: 'cat', answer: 'æ' },
        { type: 'word_to_phoneme', prompt: 'cat', answer: 'iː' }, // 反了：cat 不是 iː 的示例词
      ],
    });
    expect(result.correctCount).toBe(1);
    expect(result.wrong).toHaveLength(1);
    expect(result.wrong[0]).toMatchObject({ type: 'word_to_phoneme', prompt: 'cat', correct: 'iː' });
  });

  it('看音标选词：选对才判对', async () => {
    const { service } = makeService();
    const result = await service.submitQuiz(7, {
      answers: [
        { type: 'phoneme_to_word', prompt: 'æ', answer: 'apple' },
        { type: 'phoneme_to_word', prompt: 'æ', answer: 'see' },
      ],
    });
    expect(result.correctCount).toBe(1);
    expect(result.wrong[0]).toMatchObject({ type: 'phoneme_to_word', prompt: 'æ', correct: 'cat' });
  });

  it('题干/答案不在库里：判错但不崩，也不发 XP', async () => {
    const { service, xpCalls } = makeService();
    const result = await service.submitQuiz(7, {
      answers: [
        { type: 'word_to_phoneme', prompt: '不存在的词', answer: 'zz' },
        { type: 'phoneme_to_word', prompt: 'zz', answer: '不存在的词' },
      ],
    });
    expect(result.correctCount).toBe(0);
    expect(result.wrong).toHaveLength(2);
    expect(xpCalls).toHaveLength(0);
  });

  it('答对发 XP（每题一发，event_key 带音标+日期）', async () => {
    const { service, xpCalls } = makeService();
    const result = await service.submitQuiz(7, {
      answers: [{ type: 'word_to_phoneme', prompt: 'cat', answer: 'æ' }],
    });
    expect(result.xpAwarded).toBe(3);
    expect(xpCalls[0].eventType).toBe('ipa_quiz_correct');
    expect(xpCalls[0].key).toMatch(/^ipa-quiz:7:æ:\d{4}-\d{2}-\d{2}$/);
  });

  it('「学会了」每音标只发一次 XP，重复标记不再发', async () => {
    const { service, xpCalls, records } = makeService();
    const first = await service.markLearned(7, { symbol: '/æ/' });
    const second = await service.markLearned(7, { symbol: 'æ' });
    expect(first.firstTime).toBe(true);
    expect(first.xpAwarded).toBe(true);
    expect(second.firstTime).toBe(false);
    expect(second.xpAwarded).toBe(false);
    expect(xpCalls).toHaveLength(1);
    expect(records).toHaveLength(1);
  });

  it('不存在的音标：404，而不是静默发奖', async () => {
    const { service, xpCalls } = makeService();
    await expect(service.markLearned(7, { symbol: 'zz' })).rejects.toThrow('音标不存在');
    expect(xpCalls).toHaveLength(0);
  });

  it('测验统计写入记录（对错分别计数）', async () => {
    const { service, records } = makeService();
    await service.submitQuiz(7, {
      answers: [
        { type: 'word_to_phoneme', prompt: 'cat', answer: 'æ' },
        { type: 'word_to_phoneme', prompt: 'cat', answer: 'iː' },
      ],
    });
    // æ 一条记录（1 对 0 错），iː 一条记录（0 对 1 错）
    expect(records).toHaveLength(2);
    const ae = records.find((r) => String(r.phonemeId) === '2');
    expect(ae).toMatchObject({ quizCorrect: 1, quizWrong: 0 });
    const ee = records.find((r) => String(r.phonemeId) === '1');
    expect(ee).toMatchObject({ quizCorrect: 0, quizWrong: 1 });
  });

  it('空答案数组：400', async () => {
    const { service } = makeService();
    await expect(service.submitQuiz(7, { answers: [] })).rejects.toThrow('答案不能为空');
  });
});
