import { describe, expect, it } from 'vitest';
import { normalizeAnswer } from '../app/utils/answer-normalize';

/**
 * 答案归一化（用户端只用于输入期预校验，后端才是判定权威）。
 *
 * 这里钉住的是**口径本身**：只裁首尾非字母数字、压缩空白、统一小写，
 * 内部标点与撇号一律保留。口径一改，前端会先提示「看起来对」而后端判错
 * （或反之），用户看到的是自相矛盾的反馈——所以它必须有测试。
 */
describe('normalizeAnswer', () => {
  it('统一小写并去掉首尾标点与空白', () => {
    expect(normalizeAnswer('  Hello, World!  ')).toBe('hello, world');
    expect(normalizeAnswer('"Nice to meet you."')).toBe('nice to meet you');
  });

  it("保留词内标点与撇号（不能把 don't 洗成 dont）", () => {
    expect(normalizeAnswer("I don't know.")).toBe("i don't know");
    expect(normalizeAnswer('A well-known place')).toBe('a well-known place');
  });

  it('压缩连续空白（用户多打空格不该判错）', () => {
    expect(normalizeAnswer('how   are\t you')).toBe('how are you');
  });

  it('全角标点同样被裁掉（中文输入法常带）', () => {
    expect(normalizeAnswer('谢谢。')).toBe('');
    expect(normalizeAnswer('Hello。')).toBe('hello');
  });

  it('纯标点或空串归一化为空串', () => {
    expect(normalizeAnswer('')).toBe('');
    expect(normalizeAnswer('   ')).toBe('');
    expect(normalizeAnswer('...')).toBe('');
  });

  it('已是规范形式时保持不变（幂等）', () => {
    const once = normalizeAnswer("It's a deal!");
    expect(normalizeAnswer(once)).toBe(once);
  });
});
