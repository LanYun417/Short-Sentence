/**
 * 接龙 AI 审核结论解析（纯函数）。
 *
 * 重点钉住 fail-safe 口径：只有模型明确给出 approve / reject 才照办，
 * 其余（未知结论、乱码、空理由）一律 review 转人工——绝不把「模型胡说」当放行。
 */
import { describe, expect, it } from 'vitest';
import { parseChainModeration } from '../src/common/ai/agnes-sentence.provider.js';

describe('parseChainModeration', () => {
  it('approve 原样透传', () => {
    expect(parseChainModeration('{"decision":"approve","reason":"正常创作"}')).toEqual({
      decision: 'approve',
      reason: '正常创作',
    });
  });

  it('reject 原样透传', () => {
    expect(parseChainModeration('{"decision":"reject","reason":"含联系方式"}')).toEqual({
      decision: 'reject',
      reason: '含联系方式',
    });
  });

  it('review 原样透传', () => {
    expect(parseChainModeration('{"decision":"review","reason":"含义不明确"}')).toEqual({
      decision: 'review',
      reason: '含义不明确',
    });
  });

  it('未知结论 / 缺 decision → 转人工', () => {
    for (const raw of ['{"decision":"maybe","reason":"?"}', '{"reason":"没有结论"}', '{"decision":true}']) {
      expect(parseChainModeration(raw).decision).toBe('review');
    }
  });

  it('非法 JSON → 转人工（不抛错）', () => {
    expect(parseChainModeration('not json at all').decision).toBe('review');
    expect(parseChainModeration('').decision).toBe('review');
  });

  it('兼容 ```json 围栏与前后解释文字', () => {
    const fenced = '```json\n{"decision":"approve","reason":"ok"}\n```';
    expect(parseChainModeration(fenced).decision).toBe('approve');
    const noisy = '审核结果如下：{"decision":"reject","reason":"广告"} 以上。';
    expect(parseChainModeration(noisy)).toEqual({ decision: 'reject', reason: '广告' });
  });

  it('理由缺失时给默认文案，过长截断到 40 字', () => {
    expect(parseChainModeration('{"decision":"approve"}').reason).toBe('AI 审核通过');
    expect(parseChainModeration('{"decision":"review"}').reason).toBe('AI 无法确定，转人工审核');
    const long = parseChainModeration(`{"decision":"reject","reason":"${'很'.repeat(80)}"}`);
    expect(long.reason.length).toBe(40);
  });
});
