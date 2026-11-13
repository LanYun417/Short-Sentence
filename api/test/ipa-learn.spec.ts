import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { IpaService } from '../src/modules/client/ipa/ipa.service.js';
import type { GamifyService } from '../src/modules/client/gamify/gamify.service.js';

/**
 * 音标学习的核心不变量：
 * 1. 「学会了」每音标只发一次 XP（幂等），重复标记不再发；
 * 2. 不存在的音标 → 404，绝不静默发奖；
 * 3. 斜杠包裹的 symbol（/æ/）与裸 symbol（æ）视为同一个，避免重复计行。
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
  it('「学会了」每音标只发一次 XP，重复标记不再发', async () => {
    const { service, xpCalls, records } = makeService();
    const first = await service.markLearned(7, { symbol: '/æ/' });
    const second = await service.markLearned(7, { symbol: 'æ' });
    expect(first.firstTime).toBe(true);
    expect(first.xpAwarded).toBe(true);
    expect(second.firstTime).toBe(false);
    expect(second.xpAwarded).toBe(false);
    expect(xpCalls).toHaveLength(1);
    // /æ/ 与 æ 视为同一音标，只落一行
    expect(records).toHaveLength(1);
  });

  it('不存在的音标：404，而不是静默发奖', async () => {
    const { service, xpCalls } = makeService();
    await expect(service.markLearned(7, { symbol: 'zz' })).rejects.toThrow('音标不存在');
    expect(xpCalls).toHaveLength(0);
  });

  it('标记后进度 learnedCount 反映已学会数', async () => {
    const { service } = makeService();
    const res = await service.markLearned(7, { symbol: 'æ' });
    expect(res.learnedCount).toBe(1);
  });
});
