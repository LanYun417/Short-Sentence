/**
 * 接龙「AI 每周主题」链路单测：
 * 1. parseChainTopicBatch / normalizeChainText（纯函数，导出可测）；
 * 2. cronOf 支持 weekly 调度；
 * 3. ChainService.generateWeeklyTopics：幂等（本周已有则跳过）、新批入库 + 旧 AI 主题停用、周一日期计算。
 */
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { TextChatProvider } from '../src/common/ai/text-chat.provider.js';
import type { ChainTopicDraft } from '../src/common/ai/ai.types.js';
import { normalizeChainText, parseChainTopicBatch } from '../src/common/ai/text-chat.provider.js';
import { ChainService } from '../src/modules/client/chain/chain.service.js';
import { cronOf } from '../src/modules/task/task.registry.js';

describe('parseChainTopicBatch', () => {
  it('解析合法批量，过滤缺字段/纯中文 starter/词数越界的条目', () => {
    const raw = JSON.stringify([
      {
        title: '雨夜出租车的后座',
        starterEn: 'The taxi door closed with a soft thud at midnight.',
        promptZh: '写司机问你要去哪。',
      },
      { title: '缺提示' /* 没有 promptZh */, starterEn: 'The key turned but the door stayed shut.' },
      { title: '纯中文starter', starterEn: '这是中文不是英文', promptZh: 'x' },
      { title: '太短', starterEn: 'Hi there.', promptZh: 'x' }, // 2 词 < 5
      { title: '太长', starterEn: 'a '.repeat(40).trim(), promptZh: 'x' }, // > 30 词
      {
        title: '错拿的伞',
        starterEn: 'I grabbed the umbrella by the door and only noticed later.',
        promptZh: '伞上印着别人的名字。',
      },
      'not-an-object',
    ]);
    const out = parseChainTopicBatch(raw);
    expect(out.map((d) => d.title)).toEqual(['雨夜出租车的后座', '错拿的伞']);
  });

  it('容忍 ```json 围栏与前后夹带文字', () => {
    const raw =
      '好的，这是本周主题：\n```json\n[{"title":"雨夜出租车","starterEn":"The taxi door closed softly at midnight.","promptZh":"写司机问你去哪。"}]\n```\n以上。';
    const out = parseChainTopicBatch(raw);
    expect(out).toHaveLength(1);
    expect(out[0].starterEn).toContain('taxi');
  });

  it('非法 JSON / 非数组返回空', () => {
    expect(parseChainTopicBatch('not json')).toEqual([]);
    expect(parseChainTopicBatch('{"a":1}')).toEqual([]);
    expect(parseChainTopicBatch('')).toEqual([]);
  });
});

describe('normalizeChainText', () => {
  it('小写并去掉标点空白，用于判重', () => {
    expect(normalizeChainText(' Hello, World! ')).toBe('helloworld');
    expect(normalizeChainText('雨夜 出租车')).toBe('雨夜出租车');
  });
});

describe('cronOf weekly', () => {
  it('weekly 推导 6 位 cron（秒 分 时 日 月 周）', () => {
    expect(cronOf({ kind: 'weekly', dayOfWeek: 1, hour: 9, minute: 0 })).toBe('0 0 9 * * 1');
    expect(cronOf({ kind: 'weekly', dayOfWeek: 0, hour: 20, minute: 30 })).toBe('0 30 20 * * 0');
  });
});

function makeService(drafts: ChainTopicDraft[]) {
  const topics: Array<Record<string, unknown>> = [
    // 一条旧的 AI 主题（上周）和一条种子
    {
      id: 1n,
      title: '旧AI主题',
      starterEn: 'Old starter sentence here.',
      promptZh: '旧提示',
      status: 1,
      source: 'ai',
      weekStart: '2026-11-02',
      sort: 100,
      createdAt: new Date('2026-11-02'),
    },
    {
      id: 2n,
      title: '种子主题',
      starterEn: 'A seed starter sentence.',
      promptZh: '种子提示',
      status: 1,
      source: 'seed',
      weekStart: null,
      sort: 1,
      createdAt: new Date('2026-11-01'),
    },
  ];
  let seq = 10n;
  const prisma: any = {
    chainTopic: {
      count: vi.fn(
        async ({ where }: any) =>
          topics.filter((t) => {
            if (where?.source && t.source !== where.source) return false;
            if (where?.weekStart && t.weekStart !== where.weekStart) return false;
            return true;
          }).length,
      ),
      findMany: vi.fn(async ({ where, take }: any) => {
        let rows = topics;
        if (where?.status !== undefined) rows = rows.filter((t) => t.status === where.status);
        return rows.slice(0, take ?? 40);
      }),
      findUnique: vi.fn(
        async ({ where }: { where: { id: bigint } }) => topics.find((t) => String(t.id) === String(where.id)) ?? null,
      ),
      aggregate: vi.fn(async () => ({ _max: { sort: 100 } })),
      update: vi.fn(async ({ where, data }: any) => {
        const row = topics.find((t) => String(t.id) === String(where.id));
        if (row) Object.assign(row, data);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let n = 0;
        for (const t of topics) {
          if (t.source !== 'ai') continue;
          if (where?.weekStart?.not && t.weekStart === where.weekStart.not) continue;
          t.status = data.status;
          n += 1;
        }
        return { count: n };
      }),
      createMany: vi.fn(async ({ data }: any) => {
        for (const d of data) {
          topics.push({ id: seq++, ...d, createdAt: new Date() });
        }
        return { count: data.length };
      }),
    },
    chainEntry: {
      groupBy: vi.fn(async () => []),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  const moderator = {
    generateChainTopics: vi.fn(async () => drafts),
  };
  const service = new ChainService(prisma as unknown as PrismaService, moderator as unknown as TextChatProvider);
  return { service, prisma, moderator, topics };
}

describe('ChainService.generateWeeklyTopics', () => {
  const drafts: ChainTopicDraft[] = [
    { title: '雨夜出租车', starterEn: 'The taxi door closed softly at midnight.', promptZh: '写司机问你去哪。' },
    {
      title: '错拿的伞',
      starterEn: 'I grabbed the umbrella and noticed the name later.',
      promptZh: '伞上有别人的名字。',
    },
  ];

  it('本周首次生成：新主题入库（source=ai、weekStart=本周一），旧 AI 主题被停用，种子不动', async () => {
    const { service, topics } = makeService(drafts);
    const result = await service.generateWeeklyTopics(5);
    expect(result.created).toBe(2);
    expect(result.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const newAi = topics.filter((t) => t.source === 'ai' && t.status === 1 && t.weekStart === result.weekStart);
    expect(newAi).toHaveLength(2);
    expect(newAi[0].title).toBe('雨夜出租车');

    const oldAi = topics.find((t) => t.id === 1n)!;
    expect(oldAi.status).toBe(0); // 旧 AI 主题被停用
    const seed = topics.find((t) => t.id === 2n)!;
    expect(seed.status).toBe(1); // 种子不受影响
  });

  it('幂等：本周已有 AI 主题则直接跳过，不调用 AI、不改库', async () => {
    const { service, prisma, moderator, topics } = makeService(drafts);
    // 预置一条「本周」AI 主题
    const monday = (() => {
      const d = new Date();
      const diff = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - diff);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    topics.push({
      id: 99n,
      title: '本周已有的',
      starterEn: 'Already this week starter.',
      promptZh: 'x',
      status: 1,
      source: 'ai',
      weekStart: monday,
      sort: 200,
      createdAt: new Date(),
    });

    const result = await service.generateWeeklyTopics(5);
    expect(result.created).toBe(0);
    expect(moderator.generateChainTopics).not.toHaveBeenCalled();
    expect(prisma.chainTopic.createMany).not.toHaveBeenCalled();
  });

  it('AI 返回空批时抛错，不写库', async () => {
    const { service, prisma } = makeService([]);
    // 让 count 查不到本周已有（首次生成路径），但 AI 返回空
    await expect(service.generateWeeklyTopics(5)).rejects.toThrow();
    expect(prisma.chainTopic.createMany).not.toHaveBeenCalled();
  });
});

describe('listTopics：有本周 AI 批则只展示 AI 主题，种子隐藏；无 AI 批时种子兜底', () => {
  it('存在启用的 AI 主题时，返回列表不含种子', async () => {
    const { service } = makeService([
      { title: '新主题', starterEn: 'A brand new starter sentence here.', promptZh: '写吧。' },
    ]);
    await service.generateWeeklyTopics(5); // 生成一批 AI 主题（停用旧 AI，种子 status 仍 1）
    const list = await service.listTopics(1);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((t) => t.source === 'ai')).toBe(true);
    expect(list.some((t) => t.source === 'seed')).toBe(false);
  });

  it('没有任何 AI 主题时，回落到种子主题', async () => {
    const { service } = makeService([]);
    const list = await service.listTopics(1);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((t) => t.source === 'seed')).toBe(true);
  });
});

describe('后台主题管理：全部可见 + 手动停启', () => {
  it('adminTopicsAll 返回全部主题（含已停用的往期 AI 批次）', async () => {
    const { service } = makeService([
      { title: '新主题', starterEn: 'A brand new starter sentence here.', promptZh: '写吧。' },
    ]);
    await service.generateWeeklyTopics(5); // 旧 AI 主题被停用
    const all = await service.adminTopicsAll();
    // 旧 AI（停用）+ 种子 + 新 AI 批次 都在
    expect(all.some((t) => t.source === 'ai' && t.status === 0)).toBe(true);
    expect(all.some((t) => t.source === 'seed')).toBe(true);
    expect(all.some((t) => t.source === 'ai' && t.status === 1)).toBe(true);
    expect(all[0]).toHaveProperty('weekStart');
    expect(all[0]).toHaveProperty('entryCount');
  });

  it('adminSetTopicStatus：停用后 status=0，不存在时报错', async () => {
    const { service, topics } = makeService([]);
    await service.adminSetTopicStatus(2, 0); // 停用种子主题
    expect(topics.find((t) => t.id === 2n)?.status).toBe(0);
    await expect(service.adminSetTopicStatus(999, 1)).rejects.toThrow(/不存在/);
  });
});
