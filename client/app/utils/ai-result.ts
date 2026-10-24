/**
 * AI 输出的结构化解析（场景造句 / 词根拆解）。
 *
 * 后端提示词已要求「单行紧凑 JSON」，这里再兜一层：
 * - `parseAiJson`：剥 ```json 围栏、截取首个完整 JSON 对象；
 * - 各 normalize：字段截断、构件类型白名单、数组限量、丢弃脏项。
 *
 * 设计红线：**解析不了一律返回 null**，由调用方回退为原文展示——
 * 绝不把来路不明的数据渲染成结构化卡片（那是比纯文本更糟的体验）。
 */
import type { AiExpandResult, AiWordRootResult, WordRootItem, WordRootPart } from '~/types';

/** 构件类型白名单（与后端 sanitizeAnalysis 一致）。 */
const PART_TYPES = new Set(['prefix', 'root', 'suffix']);

/** 构件数组上限（防 AI 抽风时刷屏）。 */
const MAX_PARTS = 12;
/** 同根词数组上限。 */
const MAX_RELATED = 12;

/** 容错解析 AI 输出的 JSON 对象（失败返回 null）。 */
export function parseAiJson<T>(raw: string): T | null {
  const cleaned = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** 字符串字段：非空串才保留，并按上限截断。 */
function textOrNull(raw: unknown, len: number): string | null {
  return typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, len) : null;
}

/** 清洗构件数组。 */
function normalizeParts(raw: unknown): WordRootPart[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: WordRootPart[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const { type, text, meaning } = item as Record<string, unknown>;
    if (typeof text !== 'string' || !text.trim()) {
      continue;
    }
    out.push({
      type: typeof type === 'string' && PART_TYPES.has(type) ? type : 'root',
      text: text.trim().slice(0, 60),
      meaning: typeof meaning === 'string' ? meaning.trim().slice(0, 120) : '',
    });
    if (out.length >= MAX_PARTS) {
      break;
    }
  }
  return out;
}

/** 清洗字符串数组（去空、去重、限量）。 */
function normalizeStrings(raw: unknown, len: number): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') {
      continue;
    }
    const text = item.trim();
    if (!text || out.includes(text)) {
      continue;
    }
    out.push(text.slice(0, len));
    if (out.length >= MAX_RELATED) {
      break;
    }
  }
  return out;
}

/** 场景造句结果清洗（sentence 为空视为失败）。 */
export function normalizeExpandResult(raw: unknown): AiExpandResult | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const sentence = textOrNull(obj.sentence, 300);
  if (!sentence) {
    return null;
  }
  return {
    sentence,
    phonetic: textOrNull(obj.phonetic, 120),
    note: textOrNull(obj.note, 300),
  };
}

/** 词根拆解结果清洗（与词根词典同构）。 */
export function normalizeWordRootResult(raw: unknown): AiWordRootResult | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  return {
    phonetic: textOrNull(obj.phonetic, 120),
    meaning: textOrNull(obj.meaning, 300),
    parts: normalizeParts(obj.parts),
    explanation: textOrNull(obj.explanation, 500) ?? '',
    related: normalizeStrings(obj.related, 60),
  };
}

/** 把 AI 拆解结果装配成词条卡所需的 WordRootItem 形状（供收录与渲染复用）。 */
export function toWordRootItem(word: string, result: AiWordRootResult): WordRootItem {
  return {
    word,
    phonetic: result.phonetic,
    meaning: result.meaning,
    parts: result.parts,
    explanation: result.explanation,
    related: result.related,
    source: 'ai',
    searchCount: 0,
  };
}
