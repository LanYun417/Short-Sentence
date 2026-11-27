/**
 * 今日复习计划 / 弱点词根聚合：
 * 1. 复习计划按「到期题」去重、逾期优先，今日已完成数按题去重；
 * 2. 弱点词根按错词归类（不是按整句），过滤功能词，附释义与词根解析；
 * 3. 只统计有配图的就绪题，与一键开刷的抽题池同口径。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionsService } from '../src/modules/client/questions/questions.service.js';

const HOUR = 60 * 60 * 1000;

function makeService(options: {
  dueRows?: unknown[];
  todayRows?: unknown[];
  weaknessRows?: unknown[];
  dictionary?: Array<{ word: string; analysis: unknown }>;
}) {
  const findMany = vi.fn(async (args: { where: Record<string, unknown>; select?: Record<string, unknown> }) => {
    if (args.where.nextReviewAt) {
      return options.dueRows ?? [];
    }
    // 弱点查询也按 createdAt 过滤，用 select 区分（它要 isCorrect / sentenceEn）
    if (args.where.createdAt && args.select?.isCorrect) {
      return options.weaknessRows ?? [];
    }
    return options.todayRows ?? [];
  });
  const prisma = {
    sentenceRecord: { findMany },
    wordRoot: { findMany: vi.fn(async () => options.dictionary ?? []) },
  };
  const fileService = { findById: vi.fn(async () => ({ fileUrl: '/static/sentence.webp' })) };
  const service = new QuestionsService(prisma as never, fileService as never, {} as never, {} as never, {} as never);
  return { service, findMany, fileService };
}

function sentence(overrides: Record<string, unknown> = {}) {
  return {
    translationZh: '中文',
    imageFileId: 5n,
    category: { name: '餐饮美食' },
    ...overrides,
  };
}

describe('QuestionsService.getReviewPlan', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 固定到 2026-11-27 周五 12:00（东八区）
    vi.setSystemTime(new Date('2026-11-27T12:00:00+08:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('同题多条到期记录只算一次，逾期排前，今日复习按题去重', async () => {
    const yesterday = new Date(Date.now() - 26 * HOUR);
    const today = new Date(Date.now() - HOUR);
    const { service, findMany } = makeService({
      dueRows: [
        // 同一题两条到期记录：排序按 nextReviewAt desc，取最新那一条
        {
          sentenceId: 1n,
          isCorrect: 1,
          reviewLevel: 2,
          nextReviewAt: today,
          sentence: sentence({ translationZh: '新排期' }),
        },
        {
          sentenceId: 1n,
          isCorrect: 0,
          reviewLevel: 0,
          nextReviewAt: yesterday,
          sentence: sentence({ translationZh: '旧排期' }),
        },
        {
          sentenceId: 2n,
          isCorrect: 0,
          reviewLevel: 0,
          nextReviewAt: yesterday,
          sentence: sentence({ category: { name: '旅行出行' } }),
        },
      ],
      todayRows: [{ sentenceId: 1n }, { sentenceId: 1n }, { sentenceId: 3n }],
    });

    const plan = await service.getReviewPlan(7, 10);

    expect(plan.total).toBe(2);
    expect(plan.overdue).toBe(1);
    expect(plan.completedToday).toBe(2);
    expect(plan.items.map((item) => item.sentenceId)).toEqual([2, 1]);
    expect(plan.items[1]!.translationZh).toBe('新排期');
    expect(plan.items[0]!.overdue).toBe(true);
    expect(plan.byCategory).toEqual([
      { name: '餐饮美食', count: 1 },
      { name: '旅行出行', count: 1 },
    ]);
    // 与 next(source=review) 同口径：就绪 + 未退场 + 有配图
    const dueWhere = findMany.mock.calls[0]![0].where as Record<string, unknown>;
    expect(dueWhere.sentence).toEqual({ status: 'ready', retiredAt: null, imageFileId: { gt: 0n } });
  });

  it('没有到期题时返回空计划而不是报错', async () => {
    const { service } = makeService({});
    const plan = await service.getReviewPlan(7);
    expect(plan.total).toBe(0);
    expect(plan.items).toEqual([]);
    expect(plan.suggestedLimit).toBe(20);
  });
});

describe('QuestionsService.getWeakness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-27T12:00:00+08:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('按错词归类，过滤功能词，附释义与词根解析', async () => {
    const now = Date.now();
    const { service } = makeService({
      weaknessRows: [
        {
          isCorrect: 0,
          userAnswer: 'It is avoidable',
          createdAt: new Date(now - 2 * HOUR),
          sentence: sentence({
            id: 1n,
            sentenceEn: 'It is unavoidable.',
            translationZh: '这是不可避免的。',
            wordMeanings: JSON.stringify({ unavoidable: '不可避免的' }),
          }),
        },
        {
          isCorrect: 0,
          userAnswer: 'prevent',
          createdAt: new Date(now - HOUR),
          sentence: sentence({
            id: 2n,
            sentenceEn: 'unavoidable delay',
            translationZh: '不可避免的延误。',
            wordMeanings: null,
          }),
        },
        {
          isCorrect: 1,
          userAnswer: 'unavoidable delay',
          createdAt: new Date(now),
          sentence: sentence({ id: 3n, sentenceEn: 'unavoidable delay', wordMeanings: null }),
        },
        {
          isCorrect: 0,
          userAnswer: 'skip',
          createdAt: new Date(now - 3 * HOUR),
          sentence: sentence({ id: 4n, sentenceEn: 'It is so', wordMeanings: null }),
        },
      ],
      dictionary: [{ word: 'unavoidable', analysis: { explanation: 'un- 不 + avoid 避开 + -able 能…的' } }],
    });

    const report = await service.getWeakness(7);

    expect(report.windowDays).toBe(30);
    expect(report.totalWrong).toBe(3);
    // unavoidable 错 2 次；delay 错 1 次——都按词独立成条
    expect(report.items).toHaveLength(2);
    const item = report.items[0]!;
    expect(item.word).toBe('unavoidable');
    expect(item.wrongCount).toBe(2);
    expect(item.totalCount).toBe(3);
    expect(item.meaning).toBe('不可避免的');
    expect(item.rootAnalysis).toContain('un- 不');
    expect(item.examples).toHaveLength(2);
    expect(item.examples[0]!.imageUrl).toBe('/static/sentence.webp');
    // it / is / so 是功能词，不应进入弱点词根
    expect(report.items.some((entry) => ['it', 'is', 'so'].includes(entry.word))).toBe(false);
  });

  it('没有错题时返回空列表', async () => {
    const { service } = makeService({ weaknessRows: [] });
    const report = await service.getWeakness(7);
    expect(report.totalWrong).toBe(0);
    expect(report.items).toEqual([]);
  });
});
