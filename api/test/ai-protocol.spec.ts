import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADVANCED,
  type AdvancedAiConfig,
  type ApiFormat,
  buildChatRequest,
  normalizeApiFormat,
  parseAdvanced,
  parseChatResponse,
  resolveChatEndpoint,
} from '../src/common/ai/ai-protocol.js';

const baseInput = {
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'sk-test',
  model: 'agnes-2.5-flash',
  systemPrompt: 'sys',
  userContent: 'hello',
  temperature: 0.2,
  maxTokens: 512,
  jsonMode: true,
  fullUrl: false,
  format: 'openai_chat' as ApiFormat,
  advanced: { ...DEFAULT_ADVANCED } as AdvancedAiConfig,
};

describe('resolveChatEndpoint', () => {
  it('按格式拼接路径，并去掉末尾斜杠', () => {
    expect(resolveChatEndpoint('https://a.com/v1/', 'openai_chat', false)).toBe('https://a.com/v1/chat/completions');
    expect(resolveChatEndpoint('https://a.com/v1', 'openai_responses', false)).toBe('https://a.com/v1/responses');
    expect(resolveChatEndpoint('https://a.com/v1', 'anthropic', false)).toBe('https://a.com/v1/messages');
  });

  it('fullUrl 时原样使用（去掉末尾斜杠）', () => {
    expect(resolveChatEndpoint('https://a.com/custom/path/', 'anthropic', true)).toBe('https://a.com/custom/path');
  });
});

describe('normalizeApiFormat / parseAdvanced', () => {
  it('非法格式回落 openai_chat', () => {
    expect(normalizeApiFormat('xxx')).toBe('openai_chat');
    expect(normalizeApiFormat('anthropic')).toBe('anthropic');
  });

  it('advanced JSON 缺字段/脏数据回落默认', () => {
    expect(parseAdvanced('')).toEqual(DEFAULT_ADVANCED);
    expect(parseAdvanced('not json')).toEqual(DEFAULT_ADVANCED);
    const merged = parseAdvanced(JSON.stringify({ modelSeries: 'gpt5', temperature: 0.5, imageInput: false }));
    expect(merged.modelSeries).toBe('gpt5');
    expect(merged.temperature).toBe(0.5);
    expect(merged.imageInput).toBe(false);
    expect(merged.topK).toBe(-1); // 未给的字段回落默认
  });
});

describe('buildChatRequest', () => {
  it('openai_chat：Bearer + chat/completions + response_format + 采样/思考参数', () => {
    const adv: AdvancedAiConfig = {
      ...DEFAULT_ADVANCED,
      topP: 0.9,
      topK: 40,
      thinkingParam: 'reasoning_effort',
      thinkingValue: 'high',
      temperature: 0.7,
      maxOutputTokens: 1024,
    };
    const req = buildChatRequest({ ...baseInput, advanced: adv });
    expect(req.url).toBe('https://api.example.com/v1/chat/completions');
    expect(req.headers.Authorization).toBe('Bearer sk-test');
    const body = req.body;
    expect(body.model).toBe('agnes-2.5-flash');
    expect(body.temperature).toBe(0.7); // 高级参数覆盖调用方
    expect(body.max_tokens).toBe(1024);
    expect(body.top_p).toBe(0.9);
    expect(body.top_k).toBe(40);
    expect(body.reasoning_effort).toBe('high');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect((body.messages as Array<{ role: string }>)[0].role).toBe('system');
  });

  it('openai_responses：走 /responses，用 input + max_output_tokens + text.format', () => {
    const req = buildChatRequest({ ...baseInput, format: 'openai_responses' });
    expect(req.url).toBe('https://api.example.com/v1/responses');
    const body = req.body;
    expect(Array.isArray(body.input)).toBe(true);
    expect(body.max_output_tokens).toBe(512);
    expect(body.text).toEqual({ format: { type: 'json_object' } });
    expect(body.messages).toBeUndefined();
  });

  it('anthropic：x-api-key 头 + system 单独字段 + messages', () => {
    const req = buildChatRequest({ ...baseInput, format: 'anthropic' });
    expect(req.url).toBe('https://api.example.com/v1/messages');
    expect(req.headers['x-api-key']).toBe('sk-test');
    expect(req.headers['anthropic-version']).toBe('2023-06-01');
    expect(req.headers.Authorization).toBeUndefined();
    const body = req.body;
    expect(body.system).toBe('sys');
    expect(body.max_tokens).toBe(512);
    expect(body.response_format).toBeUndefined(); // anthropic 不支持该字段
  });

  it('带图时强制 openai_chat，user content 变数组', () => {
    const req = buildChatRequest({ ...baseInput, format: 'anthropic', imageBase64: 'AAAA' });
    expect(req.url).toContain('/chat/completions');
    const messages = req.body.messages as Array<{ content: unknown }>;
    expect(Array.isArray(messages[1].content)).toBe(true);
  });
});

describe('parseChatResponse', () => {
  it('openai_chat：content / reasoning_content 回退 + usage', () => {
    expect(
      parseChatResponse('openai_chat', {
        choices: [{ message: { content: ' hi ' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    ).toEqual({ content: 'hi', promptTokens: 10, completionTokens: 5 });
    expect(
      parseChatResponse('openai_chat', { choices: [{ message: { content: '', reasoning_content: 'think' } }] }).content,
    ).toBe('think');
  });

  it('openai_responses：output_text / output[].content[].text', () => {
    expect(
      parseChatResponse('openai_responses', { output_text: 'abc', usage: { input_tokens: 3, output_tokens: 2 } }),
    ).toEqual({ content: 'abc', promptTokens: 3, completionTokens: 2 });
    const nested = parseChatResponse('openai_responses', {
      output: [
        {
          content: [
            { type: 'output_text', text: 'x' },
            { type: 'refusal', text: 'y' },
          ],
        },
      ],
    });
    expect(nested.content).toBe('x');
  });

  it('anthropic：content 数组拼接 text 块 + usage input/output', () => {
    const r = parseChatResponse('anthropic', {
      content: [
        { type: 'text', text: 'a' },
        { type: 'tool_use', text: 'b' },
        { type: 'text', text: 'c' },
      ],
      usage: { input_tokens: 7, output_tokens: 4 },
    });
    expect(r).toEqual({ content: 'ac', promptTokens: 7, completionTokens: 4 });
  });
});
