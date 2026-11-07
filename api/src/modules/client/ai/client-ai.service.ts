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
import { Observable, finalize, of, tap } from 'rxjs';
import { AppException } from '../../../common/exception/app.exception.js';
import { AiCallLogService } from '../../../common/ai/ai-call-log.service.js';
import { AiQuotaService } from '../../../common/ai/ai-quota.service.js';
import { AiSettingsService } from '../../../common/ai/ai-settings.service.js';
import { resolveTextChannel } from '../../../common/ai/ai.config.js';
import { AiProviderError } from '../../../common/ai/ai.types.js';
import { PrismaService } from '../../../prisma/prisma.service.js';

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

  constructor(
    private readonly aiCallLog: AiCallLogService,
    private readonly aiQuota: AiQuotaService,
    private readonly prisma: PrismaService,
    private readonly aiSettings: AiSettingsService,
  ) {}

  /**
   * 场景延展造句：输入中文，流式返回地道英文 + 音标 + 场景说明。
   * 输出约定为**单行紧凑 JSON**（sentence / phonetic / note）——SSE 的 data 行按行 trim
   * 后拼接， payload 里一旦出现换行会被空行分帧拆散，故提示词必须禁止换行；
   * 前端凭此直接渲染结构化卡片，不再面对一坨纯文本。
   */
  expandStream(userId: number, chinese: string, sentenceId?: number): Observable<SseFrame> {
    const system = [
      '你是英语外教。用户给出想表达的中文，你输出最地道的英文口语句。',
      '只输出一个单行紧凑 JSON 对象：不要 markdown 代码块、不要换行、不要任何解释文字。结构：',
      '{"sentence":"地道的英文句子","phonetic":"IPA 音标（含首尾斜杠）","note":"一句中文，说明适用场景或语气"}',
    ].join('\n');
    const user = sentenceId ? `参考场景句子 id：${sentenceId}\n我想表达：${chinese}` : `我想表达：${chinese}`;
    return this.streamChat({ system, user, type: 'expand', bizId: sentenceId ?? userId, userId });
  }

  /**
   * 词根词缀拆解：输入单词，流式返回结构化拆解。
   * 输出与词根词典（WordRootAnalysis）**完全同构**，前端因此能用同一张卡片渲染，
   * 并可直接把结果回传收录进词典。同样要求单行紧凑 JSON（理由见 expandStream）。
   */
  wordRootStream(userId: number, word: string, sentenceId?: number): Observable<SseFrame> {
    const system = [
      '你是英语词源学老师。用户给出英文单词，你拆解它的词根、前缀、后缀与记忆钩子。',
      '只输出一个单行紧凑 JSON 对象：不要 markdown 代码块、不要换行、不要任何解释文字。结构：',
      '{"phonetic":"/.../","meaning":"中文释义（含词性）","parts":[{"type":"prefix|root|suffix","text":"un-","meaning":"否定"}],"explanation":"一句话说明这个词是怎么构成的","related":["同根词1","同根词2"]}',
      'parts 按单词从左到右顺序排列；若某词没有明显词缀，parts 至少给出词根。',
    ].join('\n');
    const user = sentenceId ? `单词：${word}\n上下文句子 id：${sentenceId}` : `单词：${word}`;
    return this.streamChat({ system, user, type: 'word_root', bizId: sentenceId ?? userId, userId });
  }

  /**
   * 题目解析：老题没有 `sentence.explanation` 时实时生成，**正常结束后写回库**。
   *
   * 设计取舍：
   * - 提示词只喂「正确英文 + 中文」，**不带用户作答/判定**——解析要落库、全站共享，
   *   带上某个人的答案会把「你写的是…」写进所有人的解析里；
   * - 入库是**条件更新**（只写空值）+ 只在收到 done 帧后写：客户端切题/断连会走
   *   AbortError→complete()，此时 `finished` 仍为 false，绝不把半截解析写进库；
   * - 写库失败静默（不影响已经返回给用户的流）；超出列宽截断到 500。
   *
   * 效果：每道老题全站只多花一次 AI 调用，之后随 `answer` 直接下发。
   */
  async analyzeStream(params: { userId: number; sentenceId: number }): Promise<Observable<SseFrame>> {
    const sentence = await this.prisma.sentence.findFirst({
      where: { id: BigInt(params.sentenceId), status: 'ready' },
      select: { sentenceEn: true, translationZh: true, explanation: true },
    });
    if (!sentence) {
      throw AppException.notFound('题目不存在或未就绪');
    }
    // 已有解析：不再调 AI，直接把库里的文本按同一帧格式下发
    // （前端本来也不会请求；这里兜住「另一个用户刚生成完」的并发竞态，避免空解析块）
    const baked = sentence.explanation?.trim();
    if (baked) {
      return of({ data: baked }, { event: 'done', data: '[DONE]' });
    }
    const system = [
      '你是英语老师。请针对下面这句英文给出解析，供初学者理解。',
      '要求：严格输出三行，固定格式；不要 markdown、不要编号、不要任何多余文字：',
      '语法：<一句话点明时态/句式>',
      '词形：<关键词的形式与用法，如「wait → have been waiting」>',
      '易错：<最容易写错的一点>',
      '每行不超过 30 个汉字，总长不超过 90 字；用大白话，必须针对这句话，不要泛泛而谈。',
    ].join('\n');
    const user = [`正确英文：${sentence.sentenceEn}`, `中文：${sentence.translationZh}`].join('\n');

    /** 流式累积的解析文本（只收内容帧，不收 done/error 帧的 data）。 */
    let collected = '';
    /** 是否收到正常结束帧（done）。中止/失败时为 false，不允许入库。 */
    let finished = false;

    return this.streamChat({
      system,
      user,
      type: 'analysis',
      bizId: params.sentenceId,
      userId: params.userId,
    }).pipe(
      tap((frame) => {
        if (frame.event === 'done') {
          finished = true;
          return;
        }
        if (!frame.event && frame.data) {
          collected += frame.data;
        }
      }),
      finalize(() => {
        const text = collected.trim();
        if (!finished || !text) {
          return;
        }
        // 条件更新：只填空值，避免并发答题 / 后台回填的已有结果被覆盖
        void this.prisma.sentence
          .updateMany({
            where: {
              id: BigInt(params.sentenceId),
              OR: [{ explanation: null }, { explanation: '' }],
            },
            data: { explanation: text.slice(0, 500) },
          })
          .catch(() => {
            // 写库失败静默：解析已经流给用户了，不影响本次体验
          });
      }),
    );
  }

  /** 通用流式转发（上游 OpenAI 兼容 SSE → 前端 SseFrame）。 */
  private streamChat(params: {
    system: string;
    user: string;
    type: string;
    bizId: number;
    userId: number;
  }): Observable<SseFrame> {
    return new Observable<SseFrame>((subscriber) => {
      const controller = new AbortController();
      const startedAt = Date.now();
      // 文本通道：genChannel 选了 nim 时客户端 AI 也走 NIM，否则走全局 Agnes
      const ch = resolveTextChannel(this.aiSettings.current);
      let promptTokens = 0;
      let completionTokens = 0;

      void (async () => {
        try {
          if (ch.apiKey.trim().length === 0) {
            throw new AiProviderError('AI 能力未配置（AI_AGNES_API_KEY 缺失）', { retryable: false });
          }
          const response = await fetch(`${ch.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${ch.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: ch.model,
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
            model: ch.model,
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
          // 上游失败退额度：没有产出不该白扣用户次数
          await this.aiQuota.refund(params.userId);
          await this.aiCallLog.record({
            type: params.type,
            provider: 'agnes',
            model: ch.model,
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
