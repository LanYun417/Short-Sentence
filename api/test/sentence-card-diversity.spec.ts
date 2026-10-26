/**
 * 句签主题生成的「多样性」约束测试。
 *
 * 背景：句签曾连续 4 天都是「静」主题（Quiet Garden / Autumn Stillness /
 * Cozy Reading Hour / Quiet October），用户反馈「每天都一样」。
 *
 * 根因不是模型不行，而是 prompt 只写了「每天要不同」却**没把历史主题告诉它**——
 * 模型看不到昨天做了什么，只能凭运气避开，于是收敛到最安全的情感区。
 *
 * 这组测试守的是：
 * 1. 历史主题必须真的进入 prompt（否则模型还是瞎猜）；
 * 2. prompt 必须包含「不得同义重复」与「维度轮换」的硬约束；
 * 3. 历史为空时不能崩、不能拼出 undefined。
 */
import { describe, expect, it, vi } from 'vitest';

import type { SentenceCardTheme } from '../../src/common/ai/ai.types.js';

/** 构造一个最小 provider，只测 prompt 拼装（不真的调 AI）。 */
async function buildPromptWith(recent: SentenceCardTheme[]): Promise<string> {
  const mod = await import('../../src/common/ai/agnes-sentence.provider.js');
  const Provider = (mod as unknown as { AgnesSentenceProvider: new (...args: never[]) => unknown })
    .AgnesSentenceProvider;

  const provider = Object.create(Provider.prototype) as {
    enabled: boolean;
    chat: (callType: string, system: string, user: string, temp: number) => Promise<string>;
    generateSentenceCardTheme: (day: string, recent?: SentenceCardTheme[]) => Promise<SentenceCardTheme>;
  };

  // enabled 是只读 getter（依赖 config.ai.agnes.apiKey），
  // 测试里用 defineProperty 覆盖，避免污染全局 config。
  Object.defineProperty(provider, 'enabled', { value: true, configurable: true });
  let captured = '';
  provider.chat = vi.fn(async (_callType: string, system: string) => {
    captured = system;
    return JSON.stringify({
      title: 'Night Bus',
      titleZh: '夜班车',
      sentenceEn: 'The last bus hums through the sleeping streets.',
      translationZh: '末班车低鸣着穿过沉睡的街道。',
      scenePrompt: 'a night bus interior, neon reflections',
      blessing: '愿你在回家的路上，一直有灯',
    });
  });

  await provider.generateSentenceCardTheme('2026-10-27', recent);
  return captured;
}

function theme(title: string, titleZh: string, sentenceEn: string): SentenceCardTheme {
  return {
    title,
    titleZh,
    sentenceEn,
    translationZh: '译文',
    scenePrompt: 'prompt',
    blessing: '寄语',
  };
}

describe('句签主题多样性', () => {
  const recent: SentenceCardTheme[] = [
    theme('Quiet Garden', '静谧庭院', 'Sunlight paints the garden walls with golden warmth.'),
    theme('Autumn Stillness', '秋之静谧', 'Golden leaves fall with a gentle, quiet grace.'),
    theme('Cozy Reading Hour', '暖灯夜读', 'A book opens, and the world grows quiet.'),
    theme('Quiet October', '静谧十月', 'Stillness is a gentle kind of magic.'),
  ];

  it('历史主题必须进入 prompt（否则模型无法避开）', async () => {
    const prompt = await buildPromptWith(recent);

    // 每一条历史都要能被模型看见
    for (const item of recent) {
      expect(prompt).toContain(item.title);
      expect(prompt).toContain(item.titleZh);
    }
  });

  it('包含「不得同义重复」的硬约束', async () => {
    const prompt = await buildPromptWith(recent);

    expect(prompt).toContain('DIVERSITY RULES');
    expect(prompt).toContain('MUST NOT');
    // 明确点出「同情绪换名字也算重复」——这是上一轮翻车的具体形态
    expect(prompt.toLowerCase()).toContain('synonym');
    expect(prompt.toLowerCase()).toContain('stillness');
  });

  it('包含维度轮换清单与配色轮换要求', async () => {
    const prompt = await buildPromptWith(recent);

    expect(prompt).toContain('DIFFERENT dimension');
    // 至少覆盖几个具体维度，避免模型又回到「情绪」这一个维度
    expect(prompt.toLowerCase()).toContain('object');
    expect(prompt.toLowerCase()).toContain('sound');
    expect(prompt.toLowerCase()).toContain('palette');
  });

  it('历史为空时不崩、不出现 undefined', async () => {
    const prompt = await buildPromptWith([]);

    expect(prompt).toContain('DIVERSITY RULES');
    expect(prompt).not.toContain('undefined');
    expect(prompt).toContain('(no previous cards)');
  });

  it('限制条目数不会无限膨胀（最多 7 条）', async () => {
    // 调用方 take: 7，这里验证 7 条都能塞进去且不报错
    const many = Array.from({ length: 7 }, (_, i) => theme(`T${i}`, `题${i}`, `Sentence ${i}.`));
    const prompt = await buildPromptWith(many);

    expect(prompt).toContain('T0');
    expect(prompt).toContain('T6');
  });
});
