/**
 * 情景对话模型输出解析（纯函数）。
 *
 * 钉住 fail-safe 口径：模型多角色回复要保序、speaker 与台词缺一不可，
 * 坏结构返回空 replies 由服务层兜底，绝不把脏数据写进消息表。
 */
import { describe, expect, it } from 'vitest';
import { parseStageDialogueSummary, parseStageDialogueTurn } from '../src/common/ai/agnes-sentence.provider.js';

describe('parseStageDialogueTurn', () => {
  it('解析多角色回复，保序并带中文翻译', () => {
    const raw = JSON.stringify({
      replies: [
        { speaker: 'Maya', contentEn: 'Here you go.', contentZh: '给你。' },
        { speaker: 'Leo', contentEn: 'Need a bag?', contentZh: '要袋子吗？' },
      ],
      goalReached: true,
      ended: true,
    });
    expect(parseStageDialogueTurn(raw)).toEqual({
      replies: [
        { speaker: 'Maya', contentEn: 'Here you go.', contentZh: '给你。' },
        { speaker: 'Leo', contentEn: 'Need a bag?', contentZh: '要袋子吗？' },
      ],
      goalReached: true,
      ended: true,
      hints: [],
    });
  });

  it('解析动态候选短句 hints：最多 3 条、过滤纯中文/超长/非字符串', () => {
    const raw = JSON.stringify({
      replies: [],
      hints: ['One coffee, please.', '', '好的', 'x'.repeat(100), 'How much is it?', 42],
    });
    const result = parseStageDialogueTurn(raw);
    expect(result.hints).toEqual(['One coffee, please.', 'x'.repeat(80), 'How much is it?']);
  });

  it('最多只收 3 个角色，且丢掉缺 speaker / 缺英文的脏项', () => {
    const raw = JSON.stringify({
      replies: [
        { speaker: 'A', contentEn: 'one' },
        { speaker: '', contentEn: 'two' },
        { speaker: 'B' },
        { speaker: 'C', contentEn: 'three' },
        { speaker: 'D', contentEn: 'four' },
      ],
    });
    const result = parseStageDialogueTurn(raw);
    expect(result.replies.map((item) => item.speaker)).toEqual(['A', 'C', 'D']);
    expect(result.goalReached).toBe(false);
  });

  it('非法 / 空输出返回空 replies，不抛错', () => {
    expect(parseStageDialogueTurn('not json').replies).toEqual([]);
    expect(parseStageDialogueTurn('{}').replies).toEqual([]);
    expect(parseStageDialogueTurn('').replies).toEqual([]);
  });

  it('兼容 ```json 围栏与前后解释文字', () => {
    const fenced = '```json\n{"replies":[{"speaker":"Maya","contentEn":"Hi"}],"goalReached":false,"ended":false}\n```';
    expect(parseStageDialogueTurn(fenced).replies).toHaveLength(1);
    const noisy = '结论：{"replies":[{"speaker":"Maya","contentEn":"Hi"}],"goalReached":true,"ended":false} 以上';
    expect(parseStageDialogueTurn(noisy).goalReached).toBe(true);
  });

  it('布尔字段只认真 true，字符串不算', () => {
    expect(parseStageDialogueTurn('{"goalReached":"true","ended":1}').goalReached).toBe(false);
    expect(parseStageDialogueTurn('{"goalReached":"true","ended":1}').ended).toBe(false);
  });
});

describe('parseStageDialogueSummary', () => {
  it('解析复盘三件套', () => {
    const raw = JSON.stringify({
      summary: '你把需求说清楚了。',
      highlights: ['用了 Could you'],
      improvements: ['可以再展开一点'],
    });
    expect(parseStageDialogueSummary(raw)).toEqual({
      summary: '你把需求说清楚了。',
      highlights: ['用了 Could you'],
      improvements: ['可以再展开一点'],
    });
  });

  it('坏数据 / 空对象回落通用文案', () => {
    for (const raw of ['', 'oops', '{}']) {
      const result = parseStageDialogueSummary(raw);
      expect(result.summary.length).toBeGreaterThan(0);
      expect(result.highlights.length).toBeGreaterThan(0);
      expect(result.improvements.length).toBeGreaterThan(0);
    }
  });

  it('数组项最多 2 条并过滤非字符串', () => {
    const raw = JSON.stringify({ summary: 'ok', highlights: ['a', 1, 'b', 'c'], improvements: ['x'] });
    const result = parseStageDialogueSummary(raw);
    expect(result.highlights).toEqual(['a', 'b']);
    expect(result.improvements).toEqual(['x']);
  });
});
