import { describe, expect, it } from 'vitest';
import { normalizeExpandResult, normalizeWordRootResult, parseAiJson, toWordRootItem } from '../app/utils/ai-result';
import type { AiWordRootResult } from '../app/types';

/**
 * AI 输出的结构化解析。
 *
 * 红线：**解析不了一律返回 null**，由调用方回退成原文展示——绝不能让来路不明的
 * 数据渲染成结构化卡片。AI 输出退化（带围栏、夹解释文字、字段缺斤少两）是常态，
 * 这里把这些退化形态逐个钉住。
 */
describe('parseAiJson', () => {
  it('剥掉 ```json 围栏', () => {
    expect(parseAiJson<{ a: number }>('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('模型前后夹带解释文字时，取首个完整对象', () => {
    expect(parseAiJson<{ a: number }>('好的，结果如下：{"a":1} 希望有帮助')).toEqual({ a: 1 });
  });

  it('不是 JSON / 空串一律返回 null（不抛异常）', () => {
    expect(parseAiJson('抱歉，我无法回答')).toBeNull();
    expect(parseAiJson('')).toBeNull();
    expect(parseAiJson('{不合法}')).toBeNull();
  });

  it('只有左括号没有右括号时返回 null（避免半截 JSON 被当成功）', () => {
    expect(parseAiJson('{"a": 1')).toBeNull();
  });
});

describe('normalizeExpandResult', () => {
  it('sentence 为空视为失败', () => {
    expect(normalizeExpandResult({ sentence: '   ' })).toBeNull();
    expect(normalizeExpandResult({ phonetic: '/hi/' })).toBeNull();
    expect(normalizeExpandResult(null)).toBeNull();
  });

  it('可选字段缺失时保留为 null', () => {
    expect(normalizeExpandResult({ sentence: 'Hello there.' })).toEqual({
      sentence: 'Hello there.',
      phonetic: null,
      note: null,
    });
  });

  it('超长字段按上限截断', () => {
    const result = normalizeExpandResult({ sentence: 'a'.repeat(400) });
    expect(result?.sentence).toHaveLength(300);
  });
});

describe('normalizeWordRootResult', () => {
  it('构件类型白名单：非法类型回落 root，缺 text 的脏项直接丢弃', () => {
    const result = normalizeWordRootResult({
      parts: [
        { type: 'prefix', text: 'un-', meaning: '否定' },
        { type: '瞎写', text: 'happy', meaning: '高兴' },
        { type: 'root', meaning: '缺 text' },
        'not-an-object',
      ],
    });
    expect(result?.parts).toEqual([
      { type: 'prefix', text: 'un-', meaning: '否定' },
      { type: 'root', text: 'happy', meaning: '高兴' },
    ]);
  });

  it('构件数量与同根词都有上限（防 AI 抽风刷屏）', () => {
    const parts = Array.from({ length: 30 }, (_, i) => ({ type: 'root', text: `p${i}` }));
    const related = Array.from({ length: 30 }, (_, i) => `w${i}`);
    const result = normalizeWordRootResult({ parts, related });
    expect(result?.parts).toHaveLength(12);
    expect(result?.related).toHaveLength(12);
  });

  it('同根词去空、去重', () => {
    const result = normalizeWordRootResult({ related: ['act', ' act ', '', '   ', 'action', 'act'] });
    expect(result?.related).toEqual(['act', 'action']);
  });

  it('非对象入参返回 null（调用方回退原文展示）', () => {
    expect(normalizeWordRootResult('字符串')).toBeNull();
    expect(normalizeWordRootResult(undefined)).toBeNull();
  });
});

describe('toWordRootItem', () => {
  it('装配成词条卡所需形状，来源标记为 ai', () => {
    const result: AiWordRootResult = {
      phonetic: '/ˈækt/',
      meaning: '行动',
      parts: [{ type: 'root', text: 'act', meaning: '做' }],
      explanation: '表示「做」的词根',
      related: ['action'],
    };
    expect(toWordRootItem('act', result)).toMatchObject({
      word: 'act',
      source: 'ai',
      searchCount: 0,
      related: ['action'],
    });
  });
});
