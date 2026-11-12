import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ADVANCED } from '../src/common/ai/ai-protocol.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { ClientCoachService } from '../src/modules/client/ai/coach.service.js';

/**
 * AI 私教的核心不变量：
 * 1. 画像纯计算：按场景正确率 / 易错题 / 到期复习去重都能正确聚合；
 * 2. 空数据给引导而不是空白；
 * 3. AI 不可用（密钥缺失）时点评降级为规则文案，且不扣用户额度；
 * 4. 上游失败同样降级，并返回 source=rule，绝不让异常冒到客户端。
 */

const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);

/** 造一批记录：句子 1(场景 A) 答对 2 错 2，句子 2(场景 B) 答对 4，句子 3(场景 A) 错 1。 */
function makeRecords() {
  const s1 = { id: 1n, categoryId: 10n, translationZh: '我想点一杯咖啡' };
  const s2 = { id: 2n, categoryId: 20n, translationZh: '请问登机口在哪' };
  const s3 = { id: 3n, categoryId: 10n, translationZh: '能刷卡吗' };
  const mk = (isCorrect: number, sentence: typeof s1, createdAt: Date, nextReviewAt: Date | null = null) => ({
    isCorrect,
    createdAt,
    nextReviewAt,
    sentence,
  });
  const future = new Date(Date.now() + 5 * 86400000);
  const past = new Date(Date.now() - 86400000);
  return [
    mk(1, s1, new Date(), future),
    mk(1, s1, new Date(), future),
    mk(0, s1, new Date(), past),
    mk(0, s1, new Date(), past),
    mk(1, s2, new Date(), future),
    mk(1, s2, new Date(), future),
    mk(1, s2, new Date(), future),
    mk(1, s2, new Date(), future),
    mk(0, s3, new Date(), past),
  ];
}

function makeService(opts: { records?: ReturnType<typeof makeRecords>; apiKey?: string } = {}) {
  const records = opts.records ?? makeRecords();
  const prisma: any = {
    sentenceRecord: {
      findMany: vi.fn(async (args: { where: Record<string, unknown> }) => {
        // profile 查询带 createdAt gte（30 天窗口），due 查询带 nextReviewAt lte
        if ('nextReviewAt' in args.where) {
          return records
            .filter((r) => r.isCorrect === 1 && r.nextReviewAt)
            .map((r, i) => ({ sentenceId: BigInt(1 + (i % 3)), nextReviewAt: r.nextReviewAt }));
        }
        return records;
      }),
    },
    sentenceCategory: {
      findMany: vi.fn(async () => [
        { id: 10n, name: '咖啡店点单', sort: 1 },
        { id: 20n, name: '机场通关', sort: 2 },
      ]),
    },
    userCheckin: { findFirst: vi.fn(async () => ({ streak: 6 })) },
  };
  const aiQuota = {
    consume: vi.fn(async () => undefined),
    refund: vi.fn(async () => undefined),
  };
  const aiBudget = { assertWithinBudget: vi.fn(async () => undefined) };
  const aiCallLog = { record: vi.fn(async () => undefined) };
  const aiSettings = {
    current: {
      models: [
        {
          id: 'text-1',
          purpose: 'text',
          enabled: true,
          format: 'openai_chat',
          fullUrl: false,
          baseUrl: 'https://ai.example/v1',
          modelId: 'test-model',
          modelLabel: '',
          apiKey: opts.apiKey ?? '',
          advanced: { ...DEFAULT_ADVANCED },
        },
      ],
    },
  };
  const service = new ClientCoachService(
    prisma as unknown as PrismaService,
    aiQuota as never,
    aiBudget as never,
    aiCallLog as never,
    aiSettings as never,
  );
  return { service, aiQuota, aiBudget, aiCallLog };
}

/**
 * 只恢复本文件创建的 spy：刻意不调用 vi.unstubAllGlobals()——
 * 同 worker 里另有 sentence-word-meanings / tencent-ses 两个测试文件用 stubGlobal，
 * 全局 unstub 会连带清掉它们的桩，造成偶发的跨文件失败。
 */
afterEach(() => {
  vi.restoreAllMocks();
});

describe('AI 私教画像', () => {
  it('按场景聚合正确率、易错题与到期数', async () => {
    const { service } = makeService();
    const p = await service.profile(1);

    expect(p.totalAnswers).toBe(9);
    expect(p.correctAnswers).toBe(6);
    expect(p.accuracy).toBeCloseTo(6 / 9, 2);
    expect(p.streak).toBe(6);
    // 场景 A：4 答 1 对（s1 2对2错 + s3 1错）→ 正确率 0.25，样本 5 达标，判薄弱
    expect(p.weakCategories[0].name).toBe('咖啡店点单');
    expect(p.weakCategories[0].accuracy).toBeLessThan(0.5);
    // 易错题榜首是错 2 次的 s1
    expect(p.toughSentences[0].translationZh).toBe('我想点一杯咖啡');
    expect(p.toughSentences[0].wrongCount).toBe(2);
    expect(p.plan.length).toBeGreaterThan(0);
    expect(p.aiAvailable).toBe(false); // 默认无密钥
  });

  it('没有任何练习记录时给出引导而非空白', async () => {
    const { service } = makeService({ records: [] });
    const p = await service.profile(1);
    expect(p.totalAnswers).toBe(0);
    expect(p.accuracy).toBe(0);
    expect(p.plan.join('')).toContain('5 题');
    expect(p.focus).toContain('第一句');
  });
});

describe('AI 私教点评降级', () => {
  it('密钥缺失时直接降级为规则文案，且不消耗额度', async () => {
    const { service, aiQuota } = makeService();
    const advice = await service.advice(1);
    expect(advice.source).toBe('rule');
    expect(advice.text.length).toBeGreaterThan(0);
    expect(aiQuota.consume).not.toHaveBeenCalled();
  });

  it('密钥存在但上游失败时降级，退还已扣额度', async () => {
    const { service, aiQuota, aiCallLog } = makeService({ apiKey: 'sk-test' });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('上游连接超时'));
    const advice = await service.advice(1);
    expect(advice.source).toBe('rule');
    expect(aiQuota.consume).toHaveBeenCalledTimes(1);
    expect(aiQuota.refund).toHaveBeenCalledTimes(1);
    expect(aiCallLog.record).toHaveBeenCalled(); // 失败留痕
  });

  it('上游成功时返回 AI 文案并记 success 日志', async () => {
    const { service, aiCallLog, aiQuota } = makeService({ apiKey: 'sk-test' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '这几天下功夫了，机场场景稳得很。今天补 5 道咖啡店点单吧。' } }],
        usage: { prompt_tokens: 80, completion_tokens: 40 },
      }),
    } as unknown as Response);
    const advice = await service.advice(1);
    expect(advice.source).toBe('ai');
    expect(advice.text).toContain('机场场景');
    expect(aiQuota.refund).not.toHaveBeenCalled();
    expect(aiCallLog.record).toHaveBeenCalledWith(expect.objectContaining({ type: 'coach_advice', status: 'success' }));
  });

  it('reasoning 模型把正文放 reasoning_content 时也能取到', async () => {
    const { service } = makeService({ apiKey: 'sk-test' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: null, reasoning_content: '继续保持这个节奏。' } }] }),
    } as unknown as Response);
    const advice = await service.advice(1);
    expect(advice.source).toBe('ai');
    expect(advice.text).toContain('节奏');
  });
});
