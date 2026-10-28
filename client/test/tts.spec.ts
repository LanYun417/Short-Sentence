import { describe, expect, it } from 'vitest';

import { pickVoice, useTts } from '~/composables/useTts';

const voice = (lang: string): SpeechSynthesisVoice =>
  ({ lang, name: `test-${lang}`, default: false, localService: true, voiceURI: '' }) as SpeechSynthesisVoice;

describe('pickVoice', () => {
  const voices = [voice('en-US'), voice('zh-CN'), voice('en-GB')];

  it('精确匹配优先', () => {
    expect(pickVoice(voices, 'en-US')?.lang).toBe('en-US');
  });

  it('无精确匹配时回退到同语种前缀', () => {
    // 系统只有 en-GB，请求 en-US → 取 en-GB
    expect(pickVoice([voice('en-GB'), voice('zh-CN')], 'en-US')?.lang).toBe('en-GB');
  });

  it('完全无同语种时返回 undefined', () => {
    expect(pickVoice([voice('zh-CN')], 'fr-FR')).toBeUndefined();
  });

  it('大小写不敏感', () => {
    expect(pickVoice(voices, 'EN-us')?.lang).toBe('en-US');
  });
});

describe('useTts（node 环境）', () => {
  it('无 window 时标记为不支持，且不抛错', () => {
    const tts = useTts();
    expect(tts.isSupported.value).toBe(false);
    expect(() => tts.speak('hello')).not.toThrow();
    expect(() => tts.stop()).not.toThrow();
  });
});
