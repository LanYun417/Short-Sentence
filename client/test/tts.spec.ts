import { describe, expect, it } from 'vitest';

import { pickVoice, useTts } from '~/composables/useTts';

const voice = (lang: string): SpeechSynthesisVoice =>
  ({ lang, name: `test-${lang}`, default: false, localService: true, voiceURI: '' }) as SpeechSynthesisVoice;

/** 云端嗓音（Chrome 的 Google 系列）：localService=false，受限网络下会静默失败。 */
const remoteVoice = (lang: string): SpeechSynthesisVoice =>
  ({ lang, name: `remote-${lang}`, default: false, localService: false, voiceURI: '' }) as SpeechSynthesisVoice;

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

  it('本地嗓音优先于同语言云端嗓音', () => {
    expect(pickVoice([remoteVoice('en-US'), voice('en-US')], 'en-US')?.name).toBe('test-en-US');
  });

  it('本地同语种优先于云端精确匹配（避开受限网络下的静默失败）', () => {
    expect(pickVoice([remoteVoice('en-US'), voice('en-GB')], 'en-US')?.lang).toBe('en-GB');
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
