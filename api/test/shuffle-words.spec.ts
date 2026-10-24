import { describe, expect, it } from 'vitest';
import { normalizeAnswer, shuffleWords } from '../src/modules/client/questions/questions.service.js';

/**
 * 拼词模式的词块拆分（shuffleWords）。
 * 两条硬约束：① 只打乱顺序，不丢词不增词（否则拼对的答案会被判错）；
 * ② 结果不能与原文同序（否则等于把答案原样摆在用户面前）。
 */
describe('shuffleWords', () => {
  const sentence = "I'm running a bit late—could you give me five more minutes?";

  it('词块不丢词、不增词、保留原标点', () => {
    const words = shuffleWords(sentence);
    expect(words).toHaveLength(sentence.split(' ').length);
    expect([...words].sort()).toEqual(sentence.split(' ').sort());
  });

  it('按原文顺序选词拼回后，与原文同口径（判分不受词块影响）', () => {
    const pool = shuffleWords(sentence);
    const picked = sentence.split(' ').map((word) => {
      const at = pool.indexOf(word);
      expect(at).toBeGreaterThanOrEqual(0);
      return pool.splice(at, 1)[0];
    });
    expect(normalizeAnswer(picked.join(' '))).toBe(normalizeAnswer(sentence));
  });

  it('多词句子不会原样返回（多次抽样）', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(shuffleWords(sentence).join(' ')).not.toBe(sentence);
    }
  });

  it('两词短句也不会原样返回', () => {
    for (let i = 0; i < 10; i += 1) {
      expect(shuffleWords('Thank you').join(' ')).not.toBe('Thank you');
    }
  });

  it('单词句子原样返回（无可打乱）', () => {
    expect(shuffleWords('Hello')).toEqual(['Hello']);
  });

  it('压缩多余空白，空串返回空数组', () => {
    expect(shuffleWords('  a  b  ')).toHaveLength(2);
    expect(shuffleWords('   ')).toEqual([]);
  });
});
