import { describe, expect, it } from 'vitest';
import { QuestionsService } from '../src/modules/client/questions/questions.service.js';

/**
 * 节日题库封面选取。
 *
 * 用户端题库页的节日卡片要显示「好看的封面」，实现上复用该节日题库里
 * 已生成的一张插画（`coverUrl`）。这里要守住三条：
 * 1. **封面必须来自该节日自己的题**——串到别的节日的图就穿帮了；
 * 2. **必须是就绪且未退场的题**——已下架 / 已退场的题图不该再当封面；
 * 3. **选取是确定的**——同一节日每次都取同一张（取 id 最小的就绪题），
 *    否则用户刷新一次换一张封面，页面看起来在乱跳。
 * 另外：没有可用配图时 `coverUrl` 为 null（前端回退到渐变底色，不能是空串）。
 */

/** 一个节日的一行汇总（对齐 groupBy 返回结构）。 */
interface FestivalRow {
  festivalName: string | null;
  _count: { _all: number };
  _max: { festivalDate: string | null };
}

/** 某个节日下的一条候选题（最小字段集：只需 id 与 imageFileId）。 */
interface CoverRow {
  id: bigint;
  imageFileId: bigint;
}

/**
 * 假 prisma：groupBy 返回给定的节日汇总；
 * findFirst 按 where.festivalName 在候选题里找「id 最小且有配图」的那条；
 * sentenceCategory.findMany 返回各节日的专属封面文件 id（0 = 无专属封面）。
 */
function fakePrisma(
  rows: FestivalRow[],
  covers: Record<string, CoverRow[]>,
  categoryCovers: Record<string, number> = {},
) {
  const findFirstCalls: Array<{ where: Record<string, unknown> }> = [];
  return {
    findFirstCalls,
    client: {
      sentence: {
        groupBy: async () => rows,
        findFirst: async (args: { where: Record<string, unknown>; orderBy?: unknown }) => {
          findFirstCalls.push({ where: args.where });
          const name = args.where.festivalName as string;
          const list = covers[name] ?? [];
          // 模拟 Prisma 的 where 过滤：只取有配图的
          return list.filter((row) => row.imageFileId > 0n).sort((a, b) => (a.id < b.id ? -1 : 1))[0] ?? null;
        },
      },
      sentenceCategory: {
        findMany: async (args: { where: { name: { in: string[] } } }) =>
          args.where.name.in
            .filter((name) => categoryCovers[name] !== undefined)
            .map((name) => ({ name, coverFileId: BigInt(categoryCovers[name]) })),
      },
    },
  };
}

/** 假 fileService：按 id 返回 fileUrl。 */
function fakeFileService(files: Record<number, string>) {
  return {
    findById: async (id: number) => {
      const url = files[id];
      return url === undefined ? null : { id, fileUrl: url };
    },
  };
}

/** 装配被测服务（checkin / gamify 与封面逻辑无关，传空对象即可）。 */
function buildService(prisma: unknown, fileService: unknown): QuestionsService {
  return new QuestionsService(prisma as never, fileService as never, {} as never, {} as never);
}

describe('QuestionsService.listFestivals（节日题库封面）', () => {
  it('为每个节日取该节日自己的一张就绪题配图当封面', async () => {
    const prisma = fakePrisma(
      [
        { festivalName: '元旦', _count: { _all: 30 }, _max: { festivalDate: '2026-01-01' } },
        { festivalName: '春节', _count: { _all: 28 }, _max: { festivalDate: '2026-02-17' } },
      ],
      {
        元旦: [{ id: 11n, imageFileId: 101n }],
        春节: [{ id: 21n, imageFileId: 202n }],
      },
    );
    const service = buildService(
      prisma.client,
      fakeFileService({ 101: '/uploads/webp/a.webp', 202: '/uploads/webp/b.webp' }),
    );

    const banks = await service.listFestivals();

    expect(banks.map((item) => item.coverUrl)).toEqual(['/uploads/webp/a.webp', '/uploads/webp/b.webp']);
  });

  it('封面选取是确定的：同一个节日每次都取 id 最小的就绪题', async () => {
    const prisma = fakePrisma(
      [{ festivalName: '情人节', _count: { _all: 29 }, _max: { festivalDate: '2026-02-14' } }],
      {
        情人节: [
          { id: 30n, imageFileId: 300n },
          { id: 12n, imageFileId: 120n },
          { id: 20n, imageFileId: 200n },
        ],
      },
    );
    const service = buildService(prisma.client, fakeFileService({ 120: '/uploads/webp/min.webp' }));

    const banks = await service.listFestivals();
    expect(banks[0].coverUrl).toBe('/uploads/webp/min.webp');
  });

  it('查封面时只认就绪且未退场的题（不会拿已下架/已退场的图当封面）', async () => {
    const prisma = fakePrisma([{ festivalName: '元旦', _count: { _all: 30 }, _max: { festivalDate: '2026-01-01' } }], {
      元旦: [{ id: 11n, imageFileId: 101n }],
    });
    const service = buildService(prisma.client, fakeFileService({ 101: '/uploads/webp/a.webp' }));

    await service.listFestivals();

    const where = prisma.findFirstCalls[0].where;
    expect(where.status).toBe('ready');
    expect(where.retiredAt).toBeNull();
    expect(where.festivalName).toBe('元旦');
  });

  it('没有可用配图时 coverUrl 为 null（不是空串，前端要据此回退到底色）', async () => {
    const prisma = fakePrisma(
      [{ festivalName: '元旦', _count: { _all: 30 }, _max: { festivalDate: '2026-01-01' } }],
      // 该节日下所有题都还没出图
      { 元旦: [{ id: 11n, imageFileId: 0n }] },
    );
    const service = buildService(prisma.client, fakeFileService({}));

    const banks = await service.listFestivals();
    expect(banks[0].coverUrl).toBeNull();
  });

  it('文件记录缺失时 coverUrl 为 null（不返回指向 404 的链接）', async () => {
    const prisma = fakePrisma([{ festivalName: '元旦', _count: { _all: 30 }, _max: { festivalDate: '2026-01-01' } }], {
      元旦: [{ id: 11n, imageFileId: 101n }],
    });
    const service = buildService(prisma.client, fakeFileService({}));

    const banks = await service.listFestivals();
    expect(banks[0].coverUrl).toBeNull();
  });

  it('有专属封面时优先用它，而不是从题库里挑一张', async () => {
    const prisma = fakePrisma(
      [{ festivalName: '元旦', _count: { _all: 30 }, _max: { festivalDate: '2026-01-01' } }],
      { 元旦: [{ id: 11n, imageFileId: 101n }] },
      // 节日分类上挂了专属封面（文件 id 900）
      { 元旦: 900 },
    );
    const service = buildService(
      prisma.client,
      fakeFileService({ 101: '/static/webp/from-sentence.webp', 900: '/static/webp/dedicated-cover.webp' }),
    );

    const banks = await service.listFestivals();
    expect(banks[0].coverUrl).toBe('/static/webp/dedicated-cover.webp');
  });

  it('专属封面文件缺失时回退到题库配图（不返回空封面）', async () => {
    const prisma = fakePrisma(
      [{ festivalName: '元旦', _count: { _all: 30 }, _max: { festivalDate: '2026-01-01' } }],
      { 元旦: [{ id: 11n, imageFileId: 101n }] },
      { 元旦: 900 },
    );
    // 文件表里没有 900（记录被删了）→ 回退
    const service = buildService(prisma.client, fakeFileService({ 101: '/static/webp/from-sentence.webp' }));

    const banks = await service.listFestivals();
    expect(banks[0].coverUrl).toBe('/static/webp/from-sentence.webp');
  });

  it('节日列表仍按日期升序、题数与日期不变（封面只是新增字段）', async () => {
    const prisma = fakePrisma(
      [
        { festivalName: '跨年夜', _count: { _all: 30 }, _max: { festivalDate: '2026-12-31' } },
        { festivalName: '元旦', _count: { _all: 30 }, _max: { festivalDate: '2026-01-01' } },
      ],
      {
        跨年夜: [{ id: 2n, imageFileId: 20n }],
        元旦: [{ id: 1n, imageFileId: 10n }],
      },
    );
    const service = buildService(
      prisma.client,
      fakeFileService({ 10: '/uploads/webp/newyear.webp', 20: '/uploads/webp/nye.webp' }),
    );

    const banks = await service.listFestivals();
    expect(banks.map((item) => item.name)).toEqual(['元旦', '跨年夜']);
    expect(banks[0]).toMatchObject({ name: '元旦', count: 30, date: '2026-01-01' });
    expect(banks[1]).toMatchObject({ name: '跨年夜', count: 30, date: '2026-12-31' });
  });
});
