/**
 * Agnes 生题 Provider（agnes-2.5-flash，OpenAI 兼容 chat/completions）。
 * 模块职责：按主题批量生成句子草稿（英文句子/中文释义/音标/对话场景提示词/难度/分类），
 * 以及每日句签的主题文案。
 *
 * 契约（官方文档）：POST {baseUrl}/chat/completions，Bearer 认证；
 * 请求 { model: 'agnes-2.5-flash', messages, temperature, response_format: json_object }；
 * 响应 choices[0].message.content（OpenAI 兼容）。
 * Base URL 与密钥与生图（AgnesImageProvider）共用，仅模型不同。
 * 限流未知，调用方（生成流水线）必须用信号量控制并发，本 Provider 只管单次调用。
 */
import { Injectable, Logger } from '@nestjs/common';
import { config } from '../config/config.js';
import { AiCallLogService } from './ai-call-log.service.js';
import {
  AiProviderError,
  type ChatUsage,
  type SentenceCardTheme,
  type SentenceDraft,
  type SentenceGenProvider,
} from './ai.types.js';

/** 单条草稿的最小可用判定。 */
function isUsableDraft(item: unknown): item is SentenceDraft {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  const draft = item as Record<string, unknown>;
  return typeof draft.sentenceEn === 'string' && draft.sentenceEn.trim().length > 0;
}

/** 从任意值安全取出字符串（非字符串按空串处理），trim 后截断到 max。 */
function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

@Injectable()
export class AgnesSentenceProvider implements SentenceGenProvider {
  private readonly logger = new Logger(AgnesSentenceProvider.name);

  constructor(private readonly aiCallLog: AiCallLogService) {}

  /** 密钥未配置时禁用生题能力（由调用方转为明确的业务错误）。 */
  get enabled(): boolean {
    return config.ai.agnes.apiKey.trim().length > 0;
  }

  /**
   * 批量生成句子草稿。
   *
   * 提示词策略：system 规定输出 JSON 形状与字段约束；user 给出主题与数量。
   * 要求模型返回 `{"items": [...]}`（json_object 模式必须是对象，不能是裸数组）。
   */
  async generateBatch(theme: string, count: number): Promise<SentenceDraft[]> {
    if (!this.enabled) {
      throw new AiProviderError('生题能力未配置（AI_AGNES_API_KEY 缺失）', { retryable: false });
    }

    const systemPrompt = [
      '你是英语教研专家，为英语学习 App 生成日常对话短句题库。',
      '严格要求：',
      '1. 只输出 JSON，形状为 {"items": [...]}，不要任何解释文字；',
      '2. 每个 item 字段：sentenceEn（地道英文口语句）、translationZh（中文释义）、ipa（英式音标）、scenePrompt（英文生图提示词）、difficulty（1易/2中/3难）、categoryName（中文分类名，与主题一致或更细）；',
      '3. translationZh 是最容易出问题的字段，三条硬性要求：',
      '   a. 地道中文：符合中文的语序与词语搭配，严禁逐字直译英文语序。' +
        '例：英文 "what the patient earth has grown" 应译作「大地耐心孕育出的（果实）」，' +
        '不能译成「耐心大地生长出的」——中文里没有「耐心大地」这样拼出来的定语；',
      '   b. 语义自足：只读中文就能明白这句话在说什么，不允许出现「必须对照英文才看得懂」的中文。' +
        '反例：「站台在最后一刻变了。」——读的人不知道站台变成了什么，' +
        '应写成「快到发车时站台临时换了」或「站台在最后一刻改了」；',
      '   c. 成分完整：谁、做什么、在哪等必要信息不能省略到产生歧义；单句 8~25 字为宜；',
      '4. sentenceEn 要地道、自然，可以是日常口语，但语义必须完整——不要为了「口语化」而省略到含义不清，' +
        '也不要用生僻词与俚语；难度分布均匀；',
      '5. scenePrompt 必须是「两个人在具体场景中对话」的卡通插画画面描述：人物身份、动作、环境、光线，扁平卡通风格，16:9 构图，不要图内文字；',
      `6. 当次生成 ${count} 条，主题：${theme}。`,
    ].join('\n');

    const startedAt = Date.now();
    try {
      const response = await fetch(`${config.ai.agnes.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.ai.agnes.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.ai.agnes.textModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `主题：${theme}，数量：${count}` },
          ],
          temperature: 0.8,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(config.ai.requestTimeoutMs),
      });

      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 300);
        throw new AiProviderError(`生题接口返回 ${response.status}: ${detail}`, {
          retryable: response.status === 429 || response.status >= 500,
          status: response.status,
        });
      }

      const body = (await response.json()) as {
        choices?: Array<{
          message?: { content?: string | null; reasoning_content?: string | null };
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const message = body.choices?.[0]?.message;
      // content 为空时回退 reasoning_content：推理模型可能把输出放在 reasoning_content 里
      const content = message?.content?.trim() || message?.reasoning_content?.trim() || '';
      const usage: ChatUsage = {
        promptTokens: body.usage?.prompt_tokens ?? 0,
        completionTokens: body.usage?.completion_tokens ?? 0,
      };

      const drafts = this.parseDrafts(content);
      if (drafts.length === 0) {
        throw new AiProviderError('生题接口未返回可用草稿', { retryable: true });
      }
      await this.aiCallLog.record({
        type: 'sentence_gen',
        provider: 'agnes',
        model: config.ai.agnes.textModel,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        latencyMs: Date.now() - startedAt,
        status: 'success',
      });
      return drafts;
    } catch (error) {
      await this.aiCallLog.record({
        type: 'sentence_gen',
        provider: 'agnes',
        model: config.ai.agnes.textModel,
        latencyMs: Date.now() - startedAt,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof AiProviderError) {
        throw error;
      }
      throw new AiProviderError(`生题接口调用失败: ${error instanceof Error ? error.message : String(error)}`, {
        retryable: true,
      });
    }
  }

  /**
   * 生成每日句签主题（一张精美闪卡的文案 + 生图提示词）。
   * 输出形状 {"title","titleZh","sentenceEn","translationZh","scenePrompt"}。
   */
  async generateSentenceCardTheme(day: string): Promise<SentenceCardTheme> {
    if (!this.enabled) {
      throw new AiProviderError('生题能力未配置（AI_AGNES_API_KEY 缺失）', { retryable: false });
    }

    const systemPrompt = [
      '你是「短句」App 的每日句签设计师，为用户生成一张当天可收集的精美闪卡。',
      '严格要求：',
      '1. 只输出 JSON，形状为 {"title":"","titleZh":"","sentenceEn":"","translationZh":"","scenePrompt":""}，不要任何解释文字；',
      '2. title 是英文主题名（2~4 个单词，如 Morning Ritual），titleZh 是中文主题名；',
      '3. sentenceEn 是一句简短、优美、积极向上的英文短句（不超过 12 个单词）；',
      '4. translationZh 是中文译文，必须地道通顺、符合中文语序，严禁逐字直译英文：' +
        '例：英文 "Small hands gather what the patient earth has grown." ' +
        '应译作「小小的手，捧起大地耐心孕育的果实」，' +
        '而不是「小小的手，收获耐心大地生长出的果实」（「耐心大地」不成词，定语顺序也是英文的）；' +
        '中文同样要短，读两遍通顺即可，不要为了贴合英文而拗口；',
      '5. titleZh 与 translationZh 不要出现同一个词堆叠，读起来要像中文而不是翻译腔；',
      '6. scenePrompt 是英文生图提示词：唯美治愈系的场景插画（**不是**两人对话场景），描述画面主体、环境、光线、色调，扁平/绘本风，16:9 构图，不要图内文字；',
      '7. 主题每天不同，避免与常见节日重复；积极、温暖、有画面感。',
      `8. 日期：${day}。`,
    ].join('\n');

    const startedAt = Date.now();
    try {
      const response = await fetch(`${config.ai.agnes.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.ai.agnes.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.ai.agnes.textModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `生成 ${day} 的每日句签主题。` },
          ],
          temperature: 0.9,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(config.ai.requestTimeoutMs),
      });

      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 300);
        throw new AiProviderError(`句签主题接口返回 ${response.status}: ${detail}`, {
          retryable: response.status === 429 || response.status >= 500,
          status: response.status,
        });
      }

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null; reasoning_content?: string | null } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const message = body.choices?.[0]?.message;
      const content = message?.content?.trim() || message?.reasoning_content?.trim() || '';
      const usage: ChatUsage = {
        promptTokens: body.usage?.prompt_tokens ?? 0,
        completionTokens: body.usage?.completion_tokens ?? 0,
      };

      const theme = this.parseSentenceCardTheme(content);
      if (!theme) {
        throw new AiProviderError('句签主题未返回可用内容', { retryable: true });
      }
      await this.aiCallLog.record({
        type: 'sentence_card_gen',
        provider: 'agnes',
        model: config.ai.agnes.textModel,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        latencyMs: Date.now() - startedAt,
        status: 'success',
      });
      return theme;
    } catch (error) {
      await this.aiCallLog.record({
        type: 'sentence_card_gen',
        provider: 'agnes',
        model: config.ai.agnes.textModel,
        latencyMs: Date.now() - startedAt,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof AiProviderError) {
        throw error;
      }
      throw new AiProviderError(`句签主题接口调用失败: ${error instanceof Error ? error.message : String(error)}`, {
        retryable: true,
      });
    }
  }

  /** 解析句签主题输出（容忍 ```json 围栏与思考文字夹带）。 */
  private parseSentenceCardTheme(content: string): SentenceCardTheme | null {
    let text = content.trim();
    const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/;
    const matched = fence.exec(text);
    if (matched) {
      text = matched[1].trim();
    }
    if (!text.startsWith('{')) {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end > start) {
        text = text.slice(start, end + 1);
      }
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.logger.warn('[SentenceCard] 句签主题输出不是合法 JSON，已丢弃');
      return null;
    }
    const raw = parsed as Record<string, unknown>;
    const theme: SentenceCardTheme = {
      title: str(raw.title, 80),
      titleZh: str(raw.titleZh, 80),
      sentenceEn: str(raw.sentenceEn, 200),
      translationZh: str(raw.translationZh, 200),
      scenePrompt: str(raw.scenePrompt, 500),
    };
    // 标题与短句为卡面必需，缺任一视为不可用
    if (!theme.title || !theme.sentenceEn || !theme.scenePrompt) {
      return null;
    }
    return theme;
  }

  /** 解析模型输出为草稿数组（容忍 ```json 围栏、思考文字夹带与字段缺失）。 */
  private parseDrafts(content: string): SentenceDraft[] {
    let text = content.trim();
    const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/;
    const matched = fence.exec(text);
    if (matched) {
      text = matched[1].trim();
    }
    // 兜底：输出可能夹带思考/解释文字（推理模型尤其常见），截取首个 { 到末个 } 之间的片段再解析
    if (!text.startsWith('{') && !text.startsWith('[')) {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end > start) {
        text = text.slice(start, end + 1);
      }
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.logger.warn('[SentenceGen] 模型输出不是合法 JSON，已丢弃');
      return [];
    }
    const container = parsed as { items?: unknown[] };
    const items = Array.isArray(parsed) ? parsed : Array.isArray(container?.items) ? container.items : [];
    const drafts: SentenceDraft[] = [];
    for (const item of items) {
      if (!isUsableDraft(item)) {
        continue;
      }
      // isUsableDraft 已把 item 收窄为 SentenceDraft；这里再按记录访问需要二次断言
      const draft = item as unknown as Record<string, unknown>;
      drafts.push({
        sentenceEn: str(draft.sentenceEn, 300),
        translationZh: str(draft.translationZh, 300),
        ipa: str(draft.ipa, 200),
        scenePrompt: str(draft.scenePrompt, 500),
        difficulty: this.clampDifficulty(draft.difficulty),
        categoryName: str(draft.categoryName, 50),
      });
    }
    return drafts;
  }

  /** 难度归一到 1~3（非法值按 2 处理）。 */
  private clampDifficulty(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 2;
    }
    return Math.min(3, Math.max(1, Math.floor(parsed)));
  }
}
