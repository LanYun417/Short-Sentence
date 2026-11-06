/**
 * 逐词释义（生成流水线第四阶段）。
 *
 * 守住三件事：
 * 1. 正常解析：句子 token → 中文含义；
 * 2. 标点容错：模型把 "coffee." 写成 "coffee" 也能映射回原 token；
 * 3. 只收真实存在的 token / 含汉字的含义，臆造项丢弃。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgnesSentenceProvider } from '../src/common/ai/agnes-sentence.provider.js';
import type { SentenceDraft } from '../src/common/ai/ai.types.js';

/** 构造最小可用草稿。 */
function draft(sentenceEn: string): SentenceDraft {
  return {
    sentenceEn,
    translationZh: '测试',
    ipa: '',
    scenePrompt: 'test',
    difficulty: 1,
    categoryName: '测试',
  };
}

/** 构造 Provider，并把上游 fetch 替换成固定 JSON 输出。 */
function buildProvider(content: unknown) {
  const record = vi.fn(async () => undefined);
  const provider = new AgnesSentenceProvider(
    { record } as never,
    { assertWithinBudget: vi.fn(async () => undefined) } as never,
    { current: { apiKey: 'test-key', baseUrl: 'http://test.local', textModel: 'test-model' } } as never,
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(content) } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
    })),
  );
  return { provider, record };
}

describe('AgnesSentenceProvider.annotateBatch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('按句子 token 生成中文含义，并容错模型去掉的标点', async () => {
    const { provider, record } = buildProvider({
      items: [
        {
          index: 0,
          words: [
            { word: 'I', meaning: '我' },
            { word: 'want', meaning: '想要' },
            { word: 'coffee', meaning: '咖啡' }, // 原句是 "coffee."
          ],
        },
      ],
    });

    const [out] = await provider.annotateBatch([draft('I want coffee.')]);

    expect(out.wordMeanings).toEqual({ I: '我', want: '想要', 'coffee.': '咖啡' });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ type: 'word_meanings' }));
  });

  it('丢弃句子中不存在的词与不含汉字的含义', async () => {
    const { provider } = buildProvider({
      items: [
        {
          index: 0,
          words: [
            { word: 'I', meaning: '我' },
            { word: 'banana', meaning: '香蕉' }, // 原句没有
            { word: 'want', meaning: 'want' }, // 非中文
          ],
        },
      ],
    });

    const [out] = await provider.annotateBatch([draft('I want coffee.')]);

    expect(out.wordMeanings).toEqual({ I: '我' });
  });

  it('解析不出任何可用释义时抛可重试错误（由流水线降级）', async () => {
    const { provider } = buildProvider({ items: [] });

    await expect(provider.annotateBatch([draft('I want coffee.')])).rejects.toThrow('逐词释义接口未返回可用结果');
  });
});
