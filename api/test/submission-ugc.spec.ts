/**
 * 用户投稿 UGC 校验。
 *
 * 投稿审核通过后会公开展示（精选），安全口径不能比接龙松：
 * 与接龙共用 client/ugc-content.ts 的 validateEntry / checkFreeText，
 * 只是长度放宽到 300（DTO 口径），内容规则完全一致。
 */
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { SubmissionService } from '../src/modules/client/submission/submission.service.js';
import { checkFreeText, validateEntry } from '../src/modules/client/ugc-content.js';

function makeService() {
  const submissions: Array<Record<string, unknown>> = [];
  const prisma = {
    userSubmission: {
      count: vi.fn(async () => submissions.filter((row) => row.status === 'pending').length),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        submissions.push({ id: BigInt(submissions.length + 1), status: 'pending', ...args.data });
        return { id: BigInt(submissions.length) };
      }),
    },
  };
  const service = new SubmissionService(prisma as unknown as PrismaService);
  return { service, submissions };
}

const GOOD = {
  sentenceEn: 'The early bird catches the worm.',
  translationZh: '早起的鸟儿有虫吃。',
  note: '很喜欢这句',
};

describe('validateEntry 长度可覆盖（投稿 300，接龙默认 200）', () => {
  it('接龙默认上限 200 不变', () => {
    const long = `word ${'a'.repeat(210)}`;
    expect(validateEntry(long).ok).toBe(false);
  });

  it('投稿口径放宽到 300 可过（接龙默认 200 仍拒同一条）', () => {
    const en = 'The quick brown fox jumps over the lazy dog. '.repeat(5); // 225 字符
    expect(en.length).toBeLessThanOrEqual(300);
    expect(validateEntry(en, '中文')).toBeDefined();
    expect(validateEntry(en, '中文').ok).toBe(false); // 默认 200 上限：拒
    expect(validateEntry(en, '中文', { maxEn: 300, maxZh: 300 }).ok).toBe(true); // 投稿口径：过
  });
});

describe('checkFreeText（附言）', () => {
  it('正常附言通过并折叠空格', () => {
    const result = checkFreeText('  出自某本书  ', 300, '附言');
    expect(result.ok).toBe(true);
    expect(result.value).toBe('出自某本书');
  });

  it('附言带链接/联系方式被拒', () => {
    expect(checkFreeText('加我微信 12345678', 300, '附言').ok).toBe(false);
    expect(checkFreeText('看 www.spam.com', 300, '附言').ok).toBe(false);
  });

  it('超长被拒', () => {
    expect(checkFreeText('x'.repeat(301), 300, '附言').ok).toBe(false);
  });
});

describe('SubmissionService.create 内容闸门', () => {
  it('合法投稿入库，且内容被规范化（折叠空格）', async () => {
    const { service, submissions } = makeService();
    const result = await service.create(1, {
      ...GOOD,
      sentenceEn: 'The  early   bird catches the worm.',
    } as never);
    expect(result.id).toBe(1);
    expect(submissions[0]?.sentenceEn).toBe('The early bird catches the worm.');
    expect(submissions[0]?.note).toBe('很喜欢这句');
  });

  it('英文里混中文被拒', async () => {
    const { service } = makeService();
    await expect(service.create(1, { ...GOOD, sentenceEn: 'I 记得 this sentence' } as never)).rejects.toThrow();
  });

  it('带链接/联系方式被拒', async () => {
    const { service } = makeService();
    await expect(
      service.create(1, { ...GOOD, sentenceEn: 'Contact me at www.x.com please' } as never),
    ).rejects.toThrow();
  });

  it('附言带联系方式被拒', async () => {
    const { service } = makeService();
    await expect(service.create(1, { ...GOOD, note: '加我 13800001111' } as never)).rejects.toThrow();
  });

  it('刷屏灌水被拒', async () => {
    const { service } = makeService();
    await expect(service.create(1, { ...GOOD, sentenceEn: 'aaaaaaaaaaaaaaaaaaaaaa' } as never)).rejects.toThrow();
  });

  it('待审上限仍然生效（5 条后拒新投稿）', async () => {
    const { service, submissions } = makeService();
    for (let i = 0; i < 5; i += 1) {
      await service.create(1, { ...GOOD, note: `第${i}条` } as never);
    }
    expect(submissions).toHaveLength(5);
    await expect(service.create(1, GOOD as never)).rejects.toThrow(/排队/);
  });
});
