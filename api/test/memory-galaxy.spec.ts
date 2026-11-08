import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { QuestionsService } from '../src/modules/client/questions/questions.service.js';

/**
 * 记忆星系的核心不变量：
 * 1. 坐标确定性——同一批题目两次调用结果完全一致（刷新不跳、Web/App 一致）；
 * 2. 色彩语义——未到期的毕业星为金色，到期该复习的为暖橙，其余为稳固蓝；
 * 3. 星座聚合——按场景分组统计点亮数/毕业数/到期数；
 * 4. 句子被物理删除时不画孤儿星。
 */
const DAY = 24 * 60 * 60 * 1000;

function makeService() {
  const categories = [
    { id: 1n, name: '咖啡店点单', nameEn: 'At the cafe', sort: 1 },
    { id: 2n, name: '机场通关', nameEn: 'At the airport', sort: 2 },
    { id: 3n, name: '未探索场景', nameEn: null, sort: 3 },
  ];
  // 句子 1/2 属于场景 1，句子 3 属于场景 2；句子 4 已被删除（不返回）
  const sentences = [
    { id: 1n, categoryId: 1n },
    { id: 2n, categoryId: 1n },
    { id: 3n, categoryId: 2n },
  ];
  // 句子 1：答对 25 次（毕业）+ 未来排期 → gold
  // 句子 2：答对 3 次 + 未来排期 → stable
  // 句子 3：答对 5 次 + 已过期 10 天 → faded
  // 句子 4：答对 2 次但题已删除 → 忽略
  const grouped = [
    { sentenceId: 1n, _count: { _all: 25 }, _max: { nextReviewAt: new Date(Date.now() + 20 * DAY) } },
    { sentenceId: 2n, _count: { _all: 3 }, _max: { nextReviewAt: new Date(Date.now() + 5 * DAY) } },
    { sentenceId: 3n, _count: { _all: 5 }, _max: { nextReviewAt: new Date(Date.now() - 10 * DAY) } },
    { sentenceId: 4n, _count: { _all: 2 }, _max: { nextReviewAt: new Date(Date.now() + 2 * DAY) } },
  ];
  const prisma: any = {
    sentenceRecord: { groupBy: vi.fn(async () => grouped) },
    sentence: { findMany: vi.fn(async () => sentences) },
    sentenceCategory: { findMany: vi.fn(async () => categories) },
  };
  const service = new QuestionsService(prisma as unknown as PrismaService, {} as never, {} as never, {} as never);
  return { service, prisma };
}

describe('记忆星系 getMemoryGalaxy', () => {
  it('生成 3 颗星、跳过已删除题，坐标全部落在 0..1 且可复现', async () => {
    const { service } = makeService();
    const a = await service.getMemoryGalaxy(1);
    const b = await service.getMemoryGalaxy(1);

    expect(a.stars).toHaveLength(3);
    expect(a.totalLearned).toBe(3);
    expect(JSON.stringify(a.stars)).toBe(JSON.stringify(b.stars));
    for (const s of a.stars) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(1);
      expect(s.brightness).toBeGreaterThan(0);
      expect(s.radius).toBeGreaterThan(0);
    }
  });

  it('色彩语义：毕业金色 / 稳固蓝色 / 到期暖橙，且到期星亮度衰减', async () => {
    const { service } = makeService();
    const galaxy = await service.getMemoryGalaxy(1);
    const byCategoryAndOrder = galaxy.stars;
    // 组装顺序：按 categoryId 升序、组内按 groupBy 返回顺序（1,2 属场景1；3 属场景2）
    const gold = byCategoryAndOrder.find((s) => s.categoryId === 1 && s.tone === 'gold');
    const stable = byCategoryAndOrder.find((s) => s.tone === 'stable');
    const faded = byCategoryAndOrder.find((s) => s.tone === 'faded');

    expect(gold).toBeDefined();
    expect(stable).toBeDefined();
    expect(faded).toBeDefined();
    expect(gold!.radius).toBeGreaterThan(stable!.radius); // 毕业星更大
    expect(faded!.brightness).toBeLessThan(1); // 超期后变暗，但仍可见
  });

  it('星座聚合：3 个场景中 2 个点亮，毕业 1 颗、到期 1 颗', async () => {
    const { service } = makeService();
    const galaxy = await service.getMemoryGalaxy(1);

    expect(galaxy.totalClusters).toBe(3);
    expect(galaxy.litClusters).toBe(2);
    expect(galaxy.graduated).toBe(1);
    expect(galaxy.dueCount).toBe(1);
    const cafe = galaxy.clusters.find((c) => c.categoryId === 1)!;
    expect(cafe.name).toBe('咖啡店点单');
    expect(cafe.starCount).toBe(2);
    expect(cafe.graduated).toBe(1);
    expect(cafe.avgStrength).toBeGreaterThan(0);
    const untouched = galaxy.clusters.find((c) => c.categoryId === 3)!;
    expect(untouched.starCount).toBe(0);
    expect(untouched.avgStrength).toBe(0);
  });
});
