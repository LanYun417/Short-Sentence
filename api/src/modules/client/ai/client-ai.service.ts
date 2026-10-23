/**
 * 客户端 AI 服务（流式代理 Agnes）。
 * 模块职责：场景延展造句、词根词缀拆解——用户端「AI 拓展」差异化能力。
 *
 * 关键约定：
 * - **密钥只在服务端**：前端只见到本服务转发的 SSE，上游 Agnes Key 不暴露；
 * - **流式转发**：上游 chunk 实时透传，客户端断连立即 AbortController 中止上游（防泄漏计费）；
 * - **错误不透出细节**：流内以 error 事件下发统一文案，堆栈只进日志；
 * - **留痕**：每次调用落 ai_call_log（含 usage，需上游 stream_options.include_usage）。
 */
import { Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { config } from '../../../common/config/config.js';
import { AiCallLogService } from '../../../common/ai/ai-call-log.service.js';
import { AiProviderError } from '../../../common/ai/ai.types.js';

/** 上游 SSE 解析产出。 */
interface UpstreamChunk {
  content?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** 客户端断开的统一错误文案。 */
const UPSTREAM_ERROR_MESSAGE = 'AI 服务暂时不可用，请稍后重试';

/** SSE 帧（event 缺省为 message；由控制器负责序列化为 SSE 文本行）。 */
export interface SseFrame {
  event?: string;
  data: string;
}

@Injectable()
export class ClientAiService {
  private readonly logger = new Logger(ClientAiService.name);

  constructor(private readonly aiCallLog: AiCallLogService) {}

  /** 场景延展造句：输入中文，流式返回地道英文 + 音标。 */
  expandStream(userId: number, chinese: string, sentenceId?: number): Observable<SseFrame> {
    const system = [
      '你是英语外教。用户给出想表达的中文，你输出最地道的英文口语句。',
      '输出格式：第一行英文句子，第二行 IPA 音标（放 / / 里），第三行一句中文说明使用场景。',
      '只输出这三行，不要解释、不要标题。',
    ].join('\n');
    const user = sentenceId ? `参考场景句子 id：${sentenceId}\n我想表达：${chinese}` : `我想表达：${chinese}`;
    return this.streamChat({ system, user, type: 'expand', bizId: sentenceId ?? userId });
  }

  /** 词根词缀拆解：输入单词，流式返回拆解。 */
  wordRootStream(userId: number, word: string, sentenceId?: number): Observable<SseFrame> {
    const system = [
      '你是英语词源学老师。用户给出英文单词，你拆解它的词根、前缀、后缀与记忆钩子。',
      '输出格式：第一行「词根：xxx（含义）」，其后每行一个构件「前缀/后缀/词根：xxx = 含义」；',
      '最后一行「记忆法：一句联想口诀」。只输出这些行，不要额外解释。',
    ].join('\n');
    const user = sentenceId ? `单词：${word}\n上下文句子 id：${sentenceId}` : `单词：${word}`;
    return this.streamChat({ system, user, type: 'word_root', bizId: sentenceId ?? userId });
  }

  /** 通用流式转发（上游 OpenAI 兼容 SSE → 前端 SseFrame）。 */
  private streamChat(params: { system: string; user: string; type: string; bizId: number }): Observable<SseFrame> {
    return new Observable<SseFrame>((subscriber) => {
      const controller = new AbortController();
      const startedAt = Date.now();
      let promptTokens = 0;
      let completionTokens = 0;

      void (async () => {
        try {
          if (config.ai.agnes.apiKey.trim().length === 0) {
            throw new AiProviderError('AI 能力未配置（AI_AGNES_API_KEY 缺失）', { retryable: false });
          }
          const response = await fetch(`${config.ai.agnes.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.ai.agnes.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: config.ai.agnes.textModel,
              messages: [
                { role: 'system', content: params.system },
                { role: 'user', content: params.user },
              ],
              temperature: 0.7,
              stream: true,
              // 让上游在末包返回 usage，否则流式响应拿不到 token 统计
              stream_options: { include_usage: true },
            }),
            signal: controller.signal,
          });
          if (!response.ok || !response.body) {
            const detail = (await response.text().catch(() => '')).slice(0, 200);
            throw new AiProviderError(`上游返回 ${response.status}: ${detail}`, {
              retryable: response.status === 429 || response.status >= 500,
              status: response.status,
            });
          }

          for await (const chunk of this.parseUpstreamSse(response)) {
            if (chunk.usage) {
              promptTokens = chunk.usage.prompt_tokens ?? promptTokens;
              completionTokens = chunk.usage.completion_tokens ?? completionTokens;
            }
            if (chunk.content) {
              subscriber.next({ data: chunk.content });
            }
          }
          subscriber.next({ event: 'done', data: '[DONE]' });
          subscriber.complete();
          await this.aiCallLog.record({
            type: params.type,
            provider: 'agnes',
            model: config.ai.agnes.textModel,
            bizId: params.bizId,
            promptTokens,
            completionTokens,
            latencyMs: Date.now() - startedAt,
            status: 'success',
          });
        } catch (error) {
          // 客户端主动断开：正常结束，不记失败
          if (error instanceof DOMException && error.name === 'AbortError') {
            subscriber.complete();
            return;
          }
          this.logger.error(
            `[ClientAi] ${params.type} 流式调用失败: ${error instanceof Error ? error.message : String(error)}`,
          );
          await this.aiCallLog.record({
            type: params.type,
            provider: 'agnes',
            model: config.ai.agnes.textModel,
            bizId: params.bizId,
            latencyMs: Date.now() - startedAt,
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : String(error),
          });
          subscriber.next({ event: 'error', data: UPSTREAM_ERROR_MESSAGE });
          subscriber.complete();
        }
      })();

      // 退订（客户端断开 / 组件卸载）→ 立即中止上游请求
      return () => controller.abort();
    });
  }

  /** 解析上游 SSE 字节流为 chunk（按 \n\n 分事件，容忍半包）。 */
  private async *parseUpstreamSse(response: Response): AsyncGenerator<UpstreamChunk> {
    const reader = response.body?.getReader();
    if (!reader) {
      return;
    }
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        // 最后一段可能是半包，留到下次
        buffer = events.pop() ?? '';
        for (const event of events) {
          const dataLine = event.split('\n').find((line) => line.startsWith('data:'));
          if (!dataLine) {
            continue;
          }
          const data = dataLine.slice(5).trim();
          if (data === '[DONE]') {
            return;
          }
          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
              usage?: { prompt_tokens?: number; completion_tokens?: number };
            };
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield { content };
            }
            if (parsed.usage) {
              yield { usage: parsed.usage };
            }
          } catch {
            // 半包 JSON：忽略（下一轮 buffer 会补齐）
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
