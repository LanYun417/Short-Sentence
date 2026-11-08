/**
 * 句子接龙：内容闸门 + 互动规则。
 *
 * 重点钉住的是「UGC 不能只靠举报」这条线：
 * - 入库前必须挡掉链接/联系方式/非英文/纯符号灌水；
 * - 每人每天 3 条、同主题同内容去重（挡脚本刷屏）；
 * - 点赞幂等（重复点 = 取消）、举报一人一次、满 3 次自动隐藏。
 */
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { aliasOf, validateEntry } from '../src/modules/client/chain/chain-content.js';
import { CHAIN_DAILY_LIMIT, CHAIN_REPORT_HIDE_AT, ChainService } from '../src/modules/client/chain/chain.service.js';

describe('接龙内容校验', () => {
  it('正常英文可过，并折叠多余空格', () => {
    const result = validateEntry('  I   still remember   that night.  ', '我还记得那一晚。');
    expect(result.ok).toBe(true);
    expect(result.contentEn).toBe('I still remember that night.');
    expect(result.contentZh).toBe('我还记得那一晚。');
  });

  it('英文里混中文直接拒（中文应写进翻译栏）', () => {
    const result = validateEntry('I 记得 that night');
    expect(result.ok).toBe(false);
  });

  it('少于两个单词拒', () => {
    expect(validateEntry('Okay').ok).toBe(false);
  });

  it('链接与联系方式拒', () => {
    expect(validateEntry('Visit my site www.abc.com now').ok).toBe(false);
    expect(validateEntry('Add me on wechat 123456789').ok).toBe(false);
    expect(validateEntry('Mail me at hello@test.com').ok).toBe(false);
  });

  it('连续重复字符拒（刷屏灌水）', () => {
    expect(validateEntry('aaaaaaaaaaaaaaa').ok).toBe(false);
  });

  it('中文翻译超长拒', () => {
    const result = validateEntry('I still remember that night.', '很'.repeat(200));
    expect(result.ok).toBe(false);
  });

  it('空翻译归一为空串（由 service 落库时转 null）', () => {
    const result = validateEntry('I still remember that night.');
    expect(result.ok).toBe(true);
    expect(result.contentZh).toBe('');
  });
});

describe('匿名化名', () => {
  it('同一用户在同一主题下名字恒定（刷新不换人）', () => {
    expect(aliasOf(7, 3)).toBe(aliasOf(7, 3));
  });

  it('不同主题下名字通常不同（读起来像不同的人在接）', () => {
    const names = new Set([aliasOf(7, 1), aliasOf(7, 2), aliasOf(7, 3), aliasOf(7, 4)]);
    expect(names.size).toBeGreaterThan(1);
  });
});

/** 只实现被测方法所需的假 Prisma。 */
function makePrisma() {
  const topic = { id: 1n, title: '凌晨三点', starterEn: 'At three.', promptZh: '接着写。', status: 1 };
  const entries: Array<{
    id: bigint;
    topicId: bigint;
    userId: bigint;
    contentEn: string;
    contentZh: string | null;
    likeCount: number;
    reportCount: number;
    status: string;
    createdAt: Date;
    topic?: { title: string };
  }> = [];
  const likes = new Set<string>();
  const reports = new Set<string>();

  const prisma = {
    chainTopic: {
      findUnique: vi.fn(async (args: { where: { id: bigint } }) => (args.where.id === topic.id ? topic : null)),
      findMany: vi.fn(async () => [topic]),
    },
    chainEntry: {
      count: vi.fn(
        async (args: { where: { userId?: bigint } }) =>
          entries.filter((row) => (args.where.userId ? row.userId === args.where.userId : true)).length,
      ),
      findFirst: vi.fn(
        async (args: { where: { contentEn: string } }) =>
          entries.find((row) => row.contentEn === args.where.contentEn) ?? null,
      ),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const row = {
          id: BigInt(entries.length + 1),
          topicId: args.data.topicId as bigint,
          userId: args.data.userId as bigint,
          contentEn: args.data.contentEn as string,
          contentZh: (args.data.contentZh as string | null) ?? null,
          likeCount: 0,
          reportCount: 0,
          status: 'visible',
          createdAt: new Date('2026-11-08T00:00:00Z'),
        };
        entries.push(row);
        return row;
      }),
      findUnique: vi.fn(async (args: { where: { id: bigint } }) => {
        const row = entries.find((item) => item.id === args.where.id);
        return row ? { id: row.id, status: row.status, likeCount: row.likeCount } : null;
      }),
      update: vi.fn(
        async (args: {
          where: { id: bigint };
          data: {
            likeCount?: { increment?: number; decrement?: number };
            reportCount?: { increment: number };
            status?: string;
          };
        }) => {
          const row = entries.find((item) => item.id === args.where.id)!;
          if (args.data.likeCount?.increment) row.likeCount += args.data.likeCount.increment;
          if (args.data.likeCount?.decrement) row.likeCount -= args.data.likeCount.decrement;
          if (args.data.reportCount?.increment) row.reportCount += args.data.reportCount.increment;
          if (args.data.status) row.status = args.data.status;
          return { likeCount: row.likeCount, reportCount: row.reportCount, status: row.status };
        },
      ),
      delete: vi.fn(async () => undefined),
      groupBy: vi.fn(async () => []),
      findMany: vi.fn(async () => []),
    },
    chainEntryLike: {
      create: vi.fn(async (args: { data: { entryId: bigint; userId: bigint } }) => {
        const key = `${args.data.entryId}:${args.data.userId}`;
        if (likes.has(key)) {
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        }
        likes.add(key);
        return { id: 1n };
      }),
      delete: vi.fn(async (args: { where: { entryId_userId: { entryId: bigint; userId: bigint } } }) => {
        likes.delete(`${args.where.entryId_userId.entryId}:${args.where.entryId_userId.userId}`);
        return { id: 1n };
      }),
      findMany: vi.fn(async () => []),
    },
    chainEntryReport: {
      create: vi.fn(async (args: { data: { entryId: bigint; userId: bigint } }) => {
        const key = `${args.data.entryId}:${args.data.userId}`;
        if (reports.has(key)) {
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        }
        reports.add(key);
        return { id: 1n };
      }),
    },
  };

  const service = new ChainService(prisma as unknown as PrismaService);
  return { service, entries, likes };
}

const ENTRY = { contentEn: 'I still remember the sound of that train.' };

describe('接龙互动', () => {
  it('提交成功后可读到，且作者是自己', async () => {
    const { service } = makePrisma();
    const view = await service.createEntry(1, 1, ENTRY);
    expect(view.contentEn).toBe(ENTRY.contentEn);
    expect(view.mine).toBe(true);
    expect(view.likeCount).toBe(0);
  });

  it(`每人每天最多 ${CHAIN_DAILY_LIMIT} 条`, async () => {
    const { service } = makePrisma();
    for (let i = 0; i < CHAIN_DAILY_LIMIT; i += 1) {
      await service.createEntry(1, 1, { contentEn: `This is my sentence number ${'x'.repeat(i)}.` });
    }
    await expect(service.createEntry(1, 1, { contentEn: 'One more sentence for today.' })).rejects.toThrow();
  });

  it('同主题同内容不能重复提交', async () => {
    const { service } = makePrisma();
    await service.createEntry(1, 1, ENTRY);
    await expect(service.createEntry(1, 1, ENTRY)).rejects.toThrow();
  });

  it('点赞幂等：第二次是取消', async () => {
    const { service } = makePrisma();
    const created = await service.createEntry(1, 1, ENTRY);

    const first = await service.toggleLike(2, created.id);
    expect(first.liked).toBe(true);
    expect(first.likeCount).toBe(1);

    const second = await service.toggleLike(2, created.id);
    expect(second.liked).toBe(false);
    expect(second.likeCount).toBe(0);
  });

  it(`举报满 ${CHAIN_REPORT_HIDE_AT} 次自动隐藏，且同一人不能重复举报`, async () => {
    const { service, entries } = makePrisma();
    const created = await service.createEntry(1, 1, ENTRY);

    const first = await service.report(2, created.id, 'spam');
    expect(first.hidden).toBe(false);

    await expect(service.report(2, created.id, 'spam')).rejects.toThrow();

    await service.report(3, created.id, 'spam');
    const third = await service.report(4, created.id, 'spam');
    expect(third.hidden).toBe(true);
    expect(entries[0]?.status).toBe('hidden');
  });

  it('已隐藏的条目不能再点赞', async () => {
    const { service, entries } = makePrisma();
    const created = await service.createEntry(1, 1, ENTRY);
    entries[0]!.status = 'hidden';
    await expect(service.toggleLike(2, created.id)).rejects.toThrow();
  });
});
