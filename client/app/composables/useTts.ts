/**
 * 端上文本朗读（TTS）。
 *
 * 用浏览器 / 系统自带的 SpeechSynthesis 引擎，**零依赖、零用量成本**：
 * 不调任何云接口、不按字数计费、不过 AI 预算闸门、不新增任何 npm 包。
 *
 * ⚠️ 仅客户端可用：SSR 阶段 `window` 不存在，`supported` 恒为 false，
 * 组件据此隐藏按钮，避免水合不一致。
 *
 * 设计：模块级单例状态（reactive）在多个 TtsButton 间共享——
 * 全局只有一个 speechSynthesis 实例，朗读态必须同步，否则多个按钮会各说各话。
 */

import { reactive, toRef } from 'vue';

/** 共享状态（所有组件读同一份）。 */
const state = reactive({
  /** 当前环境是否具备 speechSynthesis 能力 */
  supported: false,
  /** 是否正在朗读 */
  speaking: false,
  /** 已加载的可用嗓音（异步，可能为空直到 onvoiceschanged 触发） */
  voices: [] as SpeechSynthesisVoice[],
});

let initialized = false;

function ensureInit(): void {
  if (initialized) {
    return;
  }
  if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') {
    initialized = true; // 标为已探测：环境不支持，无需再试
    return;
  }
  initialized = true;
  state.supported = true;

  const loadVoices = (): void => {
    state.voices = window.speechSynthesis.getVoices();
  };
  loadVoices();
  // 多数浏览器首批 voices 为空，需等这个事件补发
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

/**
 * 按语言挑一个嗓音：精确匹配（如 'en-US'）优先，其次同语种前缀匹配（如 'en'）。
 * 纯函数，便于单测。
 */
export function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const target = lang.toLowerCase();
  const base = target.split('-')[0] ?? '';
  return (
    voices.find((voice) => voice.lang?.toLowerCase() === target) ??
    voices.find((voice) => (voice.lang?.toLowerCase() ?? '').startsWith(base))
  );
}

export function useTts() {
  ensureInit();

  function speak(text: string, opts: { lang?: string; rate?: number } = {}): void {
    if (!state.supported || !text) {
      return;
    }
    stop();
    const utterance = new SpeechSynthesisUtterance(text);
    const lang = opts.lang ?? 'en-US';
    utterance.lang = lang;
    const voice = pickVoice(state.voices, lang);
    if (voice) {
      utterance.voice = voice;
    }
    if (opts.rate) {
      utterance.rate = opts.rate;
    }
    utterance.onstart = () => {
      state.speaking = true;
    };
    utterance.onend = () => {
      state.speaking = false;
    };
    utterance.onerror = () => {
      state.speaking = false;
    };
    window.speechSynthesis.speak(utterance);
  }

  function stop(): void {
    if (!state.supported) {
      return;
    }
    window.speechSynthesis.cancel();
    state.speaking = false;
  }

  return {
    isSupported: toRef(state, 'supported'),
    isSpeaking: toRef(state, 'speaking'),
    voices: toRef(state, 'voices'),
    speak,
    stop,
  };
}
