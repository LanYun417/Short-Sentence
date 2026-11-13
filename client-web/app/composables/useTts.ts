/**
 * 端上文本朗读（TTS）。
 *
 * 用浏览器 / 系统自带的 SpeechSynthesis 引擎，**零依赖、零用量成本**：
 * 不调任何云接口、不按字数计费、不过 AI 预算闸门、不新增任何 npm 包。
 *
 * ⚠️ 仅客户端可用：SSR 阶段 `window` 不存在，`supported` 恒为 false，
 * 组件据此隐藏按钮，避免水合不一致。
 *
 * 嗓音选择（2026-10-28 实测补充）：
 * Chrome 的 `Google US English` 等云端嗓音 `localService=false`，在受限网络下
 * 会「`speaking=true` 但 onstart/onend 永不触发」——表现为点了没声、按钮也不变。
 * 因此优先用**本地嗓音**；只有云端嗓音可用时，若 700ms 内没真正开始，自动换成
 * 任意本地嗓音兜底（中文嗓音读英文，至少能出声），并把 `isFallback` 暴露给 UI 提示。
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
  /** 是否退化为「用本地非英文嗓音」朗读（提示用户装英文语音包） */
  fallback: false,
  /** 已加载的可用嗓音（异步，可能为空直到 onvoiceschanged 触发） */
  voices: [] as SpeechSynthesisVoice[],
});

let initialized = false;

/** 朗读代次：每次 speak/stop 自增，旧 utterance 的回调不再影响新状态。 */
let generation = 0;

/** 云端嗓音的兜底计时器。 */
let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

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

/** 是否本地嗓音（云端嗓音在受限网络下可能静默失败）。 */
function isLocalVoice(voice: SpeechSynthesisVoice | undefined): boolean {
  return voice?.localService === true;
}

/**
 * 按语言挑一个嗓音：
 * 1. 本地 + 精确语言（如 en-US）
 * 2. 本地 + 同语种（如 en-GB）
 * 3. 云端 + 精确语言
 * 4. 云端 + 同语种
 *
 * 纯函数，便于单测。
 */
export function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const target = lang.toLowerCase();
  const base = target.split('-')[0] ?? '';
  const langOf = (voice: SpeechSynthesisVoice): string => (voice.lang ?? '').toLowerCase();
  return (
    voices.find((voice) => voice.localService && langOf(voice) === target) ??
    voices.find((voice) => voice.localService && langOf(voice).startsWith(base)) ??
    voices.find((voice) => langOf(voice) === target) ??
    voices.find((voice) => langOf(voice).startsWith(base))
  );
}

export function useTts() {
  ensureInit();

  function clearFallback(): void {
    if (fallbackTimer !== null) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
  }

  /** 播放一次；token 保证旧 utterance 的回调不会污染新状态。 */
  function play(
    text: string,
    voice: SpeechSynthesisVoice | undefined,
    lang: string,
    rate: number,
    token: number,
  ): void {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    // 兜底用中文嗓音时，lang 跟随嗓音，避免引擎按 en-US 找不到音素又静默
    utterance.lang = voice?.lang ?? lang;
    if (voice) {
      utterance.voice = voice;
    }
    if (rate) {
      utterance.rate = rate;
    }
    utterance.onstart = () => {
      if (token !== generation) {
        return;
      }
      state.speaking = true;
      clearFallback();
    };
    utterance.onend = () => {
      if (token !== generation) {
        return;
      }
      state.speaking = false;
      clearFallback();
    };
    utterance.onerror = () => {
      if (token !== generation) {
        return;
      }
      state.speaking = false;
      clearFallback();
    };
    // 有些浏览器会停在 paused：先 resume 再 speak
    synth.resume();
    synth.speak(utterance);
  }

  function speak(text: string, opts: { lang?: string; rate?: number } = {}): void {
    if (!state.supported || !text) {
      return;
    }
    const synth = window.speechSynthesis;
    const lang = opts.lang ?? 'en-US';
    const rate = opts.rate ?? 1;
    // 只有真的在朗读时才 cancel：无谓的 cancel 在 Chrome 里可能把新 utterance 吞掉
    const wasActive = state.speaking || synth.speaking || synth.pending;

    generation += 1;
    const token = generation;
    clearFallback();
    if (wasActive) {
      synth.cancel();
    }
    state.speaking = false;
    state.fallback = false;

    const picked = pickVoice(state.voices, lang);

    const begin = (): void => {
      if (token !== generation) {
        return;
      }
      play(text, picked, lang, rate, token);

      // 云端嗓音静默失败兜底：700ms 内 onstart 没触发，就换任意本地嗓音重试
      if (!isLocalVoice(picked) && state.voices.some((voice) => voice.localService)) {
        fallbackTimer = setTimeout(() => {
          if (token !== generation || state.speaking) {
            return;
          }
          synth.cancel();
          const local = state.voices.find((voice) => voice.localService);
          if (!local) {
            return;
          }
          state.fallback = true;
          // 新开一代：让旧云端 utterance 迟到的 onstart/onend 不再影响新状态
          generation += 1;
          const retryToken = generation;
          // cancel 后留一帧再 speak，避开 Chrome 的竞态
          setTimeout(() => {
            if (retryToken === generation) {
              play(text, local, local.lang, rate, retryToken);
            }
          }, 60);
        }, 700);
      }
    };

    // cancel 与 speak 之间留一帧，避开 Chrome「紧挨着调用会吞掉」的已知问题
    if (wasActive) {
      setTimeout(begin, 60);
    } else {
      begin();
    }
  }

  function stop(): void {
    if (!state.supported) {
      return;
    }
    generation += 1;
    clearFallback();
    window.speechSynthesis.cancel();
    state.speaking = false;
    state.fallback = false;
  }

  return {
    isSupported: toRef(state, 'supported'),
    isSpeaking: toRef(state, 'speaking'),
    isFallback: toRef(state, 'fallback'),
    voices: toRef(state, 'voices'),
    speak,
    stop,
  };
}
