/**
 * AI 协议层：把「同一份对话参数」翻译成三种上游 API 格式的请求，并把响应解析回统一文本。
 *
 * 支持的格式（后台「API 格式」可选）：
 * - `openai_chat`      OpenAI Chat Completions（默认，兼容绝大多数中转）
 * - `openai_responses` OpenAI Responses API
 * - `anthropic`        Anthropic Messages API
 *
 * 生图（imageModel）不走本模块——图像生成始终走 Agnes 的 images 接口，不受 API 格式影响。
 *
 * 纯函数（不碰网络），便于单测；provider 的 chat() 只负责 fetch + 调用这两函数。
 */

/** API 格式。 */
export type ApiFormat = 'openai_chat' | 'openai_responses' | 'anthropic';

/** 全部可选格式（后台下拉与校验共用）。 */
export const API_FORMATS: readonly ApiFormat[] = ['openai_chat', 'openai_responses', 'anthropic'];

/** 校验并归一化格式，非法值回落 openai_chat。 */
export function normalizeApiFormat(value: unknown): ApiFormat {
  return API_FORMATS.includes(value as ApiFormat) ? (value as ApiFormat) : 'openai_chat';
}

/** 高级参数（存 sys_config 的 JSON 块，缺省用默认值合并）。 */
export interface AdvancedAiConfig {
  /** 模型系列（如 gpt5 / gemini3 / deepseek4；空 = 默认） */
  modelSeries: string;
  /** 上下文输入窗口（token，0 = 用上游默认） */
  maxInputTokens: number;
  /** 上下文输出窗口（token，0 = 用全局 config.ai.maxOutputTokens） */
  maxOutputTokens: number;
  /** 工具调用轮数（0 = 用上游默认） */
  toolRounds: number;
  /** 是否支持图片输入 */
  imageInput: boolean;
  /** 思考模式参数名（如 reasoning_effort），空 = 不开 */
  thinkingParam: string;
  /** 思考强度可选值列表（UI 里可增删） */
  thinkingOptions: string[];
  /** 当前选中的思考强度（空 = 默认/关闭） */
  thinkingValue: string;
  /** 采样温度（-1 = 不覆盖，用调用方传入值） */
  temperature: number;
  /** Top P（-1 = 不传） */
  topP: number;
  /** Top K（-1 = 不传） */
  topK: number;
}

/** 高级参数默认值。 */
export const DEFAULT_ADVANCED: AdvancedAiConfig = {
  modelSeries: '',
  maxInputTokens: 0,
  maxOutputTokens: 0,
  toolRounds: 0,
  imageInput: true,
  thinkingParam: '',
  thinkingOptions: [],
  thinkingValue: '',
  temperature: -1,
  topP: -1,
  topK: -1,
};

/** 解析并合并高级参数 JSON（脏数据/缺字段一律回落默认）。 */
export function parseAdvanced(raw: unknown): AdvancedAiConfig {
  if (!raw) return { ...DEFAULT_ADVANCED };
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ...DEFAULT_ADVANCED };
    }
  }
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_ADVANCED };
  const p = parsed as Record<string, unknown>;
  const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d);
  return {
    modelSeries: str(p.modelSeries, ''),
    maxInputTokens: num(p.maxInputTokens, 0),
    maxOutputTokens: num(p.maxOutputTokens, 0),
    toolRounds: num(p.toolRounds, 0),
    imageInput: typeof p.imageInput === 'boolean' ? p.imageInput : true,
    thinkingParam: str(p.thinkingParam, ''),
    thinkingOptions: Array.isArray(p.thinkingOptions)
      ? (p.thinkingOptions as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
    thinkingValue: str(p.thinkingValue, ''),
    temperature: num(p.temperature, -1),
    topP: num(p.topP, -1),
    topK: num(p.topK, -1),
  };
}

/** 模型用途：文本对话（生题/造句/词根/句签/解析/审核）与生图。 */
export type ModelPurpose = 'text' | 'image';

/**
 * 单个模型配置（模型列表的一项）。
 * 不分厂商了——一套字段走所有上游，厂商差异只体现在「API 格式」上。
 */
export interface AiModelConfig {
  id: string;
  purpose: ModelPurpose;
  enabled: boolean;
  /** API 格式（生图固定 openai_chat：走 images 接口） */
  format: ApiFormat;
  fullUrl: boolean;
  baseUrl: string;
  modelId: string;
  modelLabel: string;
  apiKey: string;
  advanced: AdvancedAiConfig;
}

/** 解析模型列表（JSON 字符串或数组，脏数据逐项剔除，缺字段回落默认）。 */
export function parseModels(raw: unknown): AiModelConfig[] {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) return [];
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const out: AiModelConfig[] = [];
  for (const item of parsed as unknown[]) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const purpose: ModelPurpose = o.purpose === 'image' ? 'image' : 'text';
    const id = typeof o.id === 'string' && o.id ? o.id : `${purpose}-${out.length + 1}`;
    out.push({
      id,
      purpose,
      enabled: typeof o.enabled === 'boolean' ? o.enabled : true,
      format: normalizeApiFormat(purpose === 'image' ? 'openai_chat' : o.format),
      fullUrl: o.fullUrl === true,
      baseUrl: typeof o.baseUrl === 'string' ? o.baseUrl.replace(/\/+$/, '') : '',
      modelId: typeof o.modelId === 'string' ? o.modelId : '',
      modelLabel: typeof o.modelLabel === 'string' ? o.modelLabel : '',
      apiKey: typeof o.apiKey === 'string' ? o.apiKey : '',
      advanced: parseAdvanced(o.advanced),
    });
  }
  return out;
}

/** 按用途取第一个启用的模型（没有则 null）。 */
export function resolveModel(models: AiModelConfig[], purpose: ModelPurpose): AiModelConfig | null {
  if (!Array.isArray(models)) return null;
  for (const m of models) {
    if (m.purpose === purpose && m.enabled) return m;
  }
  return null;
}

/** 生图端点（生图固定走 OpenAI 兼容的 images/generations）。 */
export function resolveImageEndpoint(baseUrl: string, fullUrl: boolean): string {
  const base = baseUrl.replace(/\/+$/, '');
  return fullUrl ? base : `${base}/images/generations`;
}

/** chat 请求输入。 */
export interface ChatRequestInput {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userContent: string;
  temperature: number;
  maxTokens: number;
  /** 是否要求 JSON 输出（仅 openai 两种格式生效；anthropic 靠提示词） */
  jsonMode: boolean;
  /** baseUrl 是否为「完整 URL」（含路径），true 时原样使用 */
  fullUrl: boolean;
  format: ApiFormat;
  advanced: AdvancedAiConfig;
  /** 视觉审核带图时传入；有图时强制走 openai_chat（多模态） */
  imageBase64?: string;
}

export interface BuiltRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/** 按格式解析出上游端点。 */
export function resolveChatEndpoint(baseUrl: string, format: ApiFormat, fullUrl: boolean): string {
  if (fullUrl) return baseUrl.replace(/\/+$/, '');
  const base = baseUrl.replace(/\/+$/, '');
  switch (format) {
    case 'openai_responses':
      return `${base}/responses`;
    case 'anthropic':
      return `${base}/messages`;
    default:
      return `${base}/chat/completions`;
  }
}

/** 构造请求（url + headers + body）。 */
export function buildChatRequest(input: ChatRequestInput): BuiltRequest {
  const format: ApiFormat = input.imageBase64 ? 'openai_chat' : normalizeApiFormat(input.format);
  const url = resolveChatEndpoint(input.baseUrl, format, input.fullUrl);

  // 采样参数：高级参数覆盖调用方默认值（缺省回落默认）
  const adv = input.advanced ?? DEFAULT_ADVANCED;
  const temperature = adv.temperature >= 0 ? adv.temperature : input.temperature;
  const sampling: Record<string, unknown> = {};
  if (adv.topP >= 0) sampling.top_p = adv.topP;
  if (adv.topK >= 0) sampling.top_k = adv.topK;
  const thinking = adv.thinkingParam && adv.thinkingValue ? { [adv.thinkingParam]: adv.thinkingValue } : {};
  const maxOut = adv.maxOutputTokens > 0 ? adv.maxOutputTokens : input.maxTokens;

  const userContent: unknown = input.imageBase64
    ? [
        { type: 'text', text: input.userContent },
        { type: 'image_url', image_url: { url: `data:image/webp;base64,${input.imageBase64}` } },
      ]
    : input.userContent;

  if (format === 'anthropic') {
    return {
      url,
      headers: {
        'x-api-key': input.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: {
        model: input.model,
        max_tokens: maxOut,
        system: input.systemPrompt,
        messages: [{ role: 'user', content: userContent }],
        temperature,
        ...sampling,
        ...thinking,
      },
    };
  }

  if (format === 'openai_responses') {
    return {
      url,
      headers: { Authorization: `Bearer ${input.apiKey}`, 'content-type': 'application/json' },
      body: {
        model: input.model,
        input: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature,
        max_output_tokens: maxOut,
        ...(input.jsonMode ? { text: { format: { type: 'json_object' } } } : {}),
        ...sampling,
        ...thinking,
      },
    };
  }

  // openai_chat（默认；视觉审核也走它）
  return {
    url,
    headers: { Authorization: `Bearer ${input.apiKey}`, 'content-type': 'application/json' },
    body: {
      model: input.model,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature,
      max_tokens: maxOut,
      ...(input.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      ...sampling,
      ...thinking,
    },
  };
}

/** 解析响应为统一文本 + token 用量。 */
export function parseChatResponse(
  format: ApiFormat,
  body: unknown,
): { content: string; promptTokens: number; completionTokens: number } {
  const b = body as Record<string, unknown> | null;
  if (format === 'anthropic') {
    const contentArr = Array.isArray(b?.content) ? (b.content as Array<Record<string, unknown>>) : [];
    const text = contentArr
      .filter((c) => c.type === 'text')
      .map((c) => String(c.text ?? ''))
      .join('');
    const usage = (b?.usage ?? {}) as Record<string, unknown>;
    return {
      content: text.trim(),
      promptTokens: Number(usage.input_tokens ?? 0),
      completionTokens: Number(usage.output_tokens ?? 0),
    };
  }
  if (format === 'openai_responses') {
    let out = '';
    if (typeof b?.output_text === 'string') {
      out = b.output_text;
    } else if (Array.isArray(b?.output)) {
      out = (b.output as Array<Record<string, unknown>>)
        .flatMap((o) => (Array.isArray(o.content) ? (o.content as Array<Record<string, unknown>>) : []))
        .filter((c) => c.type === 'output_text')
        .map((c) => String(c.text ?? ''))
        .join('');
    }
    const usage = (b?.usage ?? {}) as Record<string, unknown>;
    return {
      content: out.trim(),
      promptTokens: Number(usage.input_tokens ?? usage.prompt_tokens ?? 0),
      completionTokens: Number(usage.output_tokens ?? usage.completion_tokens ?? 0),
    };
  }
  // openai_chat
  const choices = Array.isArray(b?.choices) ? (b.choices as Array<Record<string, unknown>>) : [];
  const message = (choices[0]?.message ?? {}) as Record<string, unknown>;
  const content = String(message.content ?? '').trim() || String(message.reasoning_content ?? '').trim();
  const usage = (b?.usage ?? {}) as Record<string, unknown>;
  return {
    content,
    promptTokens: Number(usage.prompt_tokens ?? 0),
    completionTokens: Number(usage.completion_tokens ?? 0),
  };
}
