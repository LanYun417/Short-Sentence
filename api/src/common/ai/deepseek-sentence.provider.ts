/**
 * DeepSeek 生题 Provider（经 NVIDIA integrate 的 OpenAI 兼容接口）。
 * 模块职责：按主题批量生成句子草稿（英文句子/中文释义/音标/对话场景提示词/难度/分类）。
 *
 * 契约：POST {baseUrl}/chat/completions，Bearer 认证，response_format=json_object。
 * 限流：上游约 40 RPM，调用方（生成流水线）必须用信号量控制并发，本 Provider 只管单次调用。
 */
import { Injectable, Logger } from '@nestjs/common';
import { config } from '../config/config.js';
import { AiCallLogService } from './ai-call-log.service.js';
import {
  AiProviderError,
  type ChatUsage,
  type CollectibleTheme,
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
export class DeepSeekSentenceProvider implements SentenceGenProvider {
  private readonly logger = new Logger(DeepSeekSentenceProvider.name);

  constructor(private readonly aiCallLog: AiCallLogService) {}

  /** 密钥未配置时禁用生题能力（由调用方转为明确的业务错误）。 */
  get enabled(): boolean {
    return config.ai.nvidia.apiKey.trim().length > 0;
  }

  /**
   * 批量生成句子草稿。
   *
   * 提示词策略：system 规定输出 JSON 形状与字段约束；user 给出主题与数量。
   * 要求模型返回 `{"items": [...]}`（json_object 模式必须是对象，不能是裸数组）。
   */
  async generateBatch(theme: string, count: number): Promise<SentenceDraft[]> {
    if (!this.enabled) {
      throw new AiProviderError('生题能力未配置（AI_NVIDIA_API_KEY 缺失）', { retryable: false });
    }

    const systemPrompt = [
      '你是英语教研专家，为英语学习 App 生成日常对话短句题库。',
      '严格要求：',
      '1. 只输出 JSON，形状为 {"items": [...]}，不要任何解释文字；',
      '2. 每个 item 字段：sentenceEn（地道英文口语句）、translationZh（精准中文释义）、ipa（英式音标）、scenePrompt（英文生图提示词）、difficulty（1易/2中/3难）、categoryName（中文分类名，与主题一致或更细）；',
      '3. scenePrompt 必须是「两个人在具体场景中对话」的卡通插画画面描述：人物身份、动作、环境、光线，扁平卡通风格，16:9 构图，不要图内文字；',
      '4. 句子口语化、实用、避免生僻词；难度分布均匀；',
      `5. 当次生成 ${count} 条，主题：${theme}。`,
    ].join('\n');

    const startedAt = Date.now();
    try {
      const response = await fetch(`${config.ai.nvidia.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.ai.nvidia.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.ai.nvidia.model,
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
      // content 为空时回退 reasoning_content：NVIDIA 上的 deepseek-v4.1-flash 属推理模型，
      // 会把全部输出（含目标 JSON）放进 reasoning_content，而 content 为 null。
      // 只读 content 会拿到空串，表现为「接口 200 正常，却每批零净增、题库始终为空」。
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
        provider: 'nvidia',
        model: config.ai.nvidia.model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        latencyMs: Date.now() - startedAt,
        status: 'success',
      });
      return drafts;
    } catch (error) {
      await this.aiCallLog.record({
        type: 'sentence_gen',
        provider: 'nvidia',
        model: config.ai.nvidia.model,
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
   * 生成每日藏品主题（一张精美闪卡的文案 + 生图提示词）。
   * 与生题共用上游与日志；输出形状 {"title","titleZh","sentenceEn","translationZh","scenePrompt"}。
   */
  async generateCollectibleTheme(day: string): Promise<CollectibleTheme> {
    if (!this.enabled) {
      throw new AiProviderError('生题能力未配置（AI_NVIDIA_API_KEY 缺失）', { retryable: false });
    }

    const systemPrompt = [
      '你是「短句」App 的每日藏品设计师，为用户生成一张当天可收集的精美闪卡。',
      '严格要求：',
      '1. 只输出 JSON，形状为 {"title":"","titleZh":"","sentenceEn":"","translationZh":"","scenePrompt":""}，不要任何解释文字；',
      '2. title 是英文主题名（2~4 个单词，如 Morning Ritual），titleZh 是中文主题名；',
      '3. sentenceEn 是一句简短、优美、积极向上的英文短句（不超过 12 个单词），translationZh 是精准中文翻译；',
      '4. scenePrompt 是英文生图提示词：唯美治愈系的场景插画（**不是**两人对话场景），描述画面主体、环境、光线、色调，扁平/绘本风，16:9 构图，不要图内文字；',
      '5. 主题每天不同，避免与常见节日重复；积极、温暖、有画面感。',
      `6. 日期：${day}。`,
    ].join('\n');

    const startedAt = Date.now();
    try {
      const response = await fetch(`${config.ai.nvidia.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.ai.nvidia.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.ai.nvidia.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `生成 ${day} 的每日藏品主题。` },
          ],
          temperature: 0.9,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(config.ai.requestTimeoutMs),
      });

      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 300);
        throw new AiProviderError(`藏品主题接口返回 ${response.status}: ${detail}`, {
          retryable: response.status === 429 || response.status >= 500,
          status: response.status,
        });
      }

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null; reasoning_content?: string | null } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const message = body.choices?.[0]?.message;
      // 与生题同因：推理模型会把输出放进 reasoning_content，content 可能为 null
      const content = message?.content?.trim() || message?.reasoning_content?.trim() || '';
      const usage: ChatUsage = {
        promptTokens: body.usage?.prompt_tokens ?? 0,
        completionTokens: body.usage?.completion_tokens ?? 0,
      };

      const theme = this.parseCollectibleTheme(content);
      if (!theme) {
        throw new AiProviderError('藏品主题未返回可用内容', { retryable: true });
      }
      await this.aiCallLog.record({
        type: 'collectible_gen',
        provider: 'nvidia',
        model: config.ai.nvidia.model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        latencyMs: Date.now() - startedAt,
        status: 'success',
      });
      return theme;
    } catch (error) {
      await this.aiCallLog.record({
        type: 'collectible_gen',
        provider: 'nvidia',
        model: config.ai.nvidia.model,
        latencyMs: Date.now() - startedAt,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof AiProviderError) {
        throw error;
      }
      throw new AiProviderError(`藏品主题接口调用失败: ${error instanceof Error ? error.message : String(error)}`, {
        retryable: true,
      });
    }
  }

  /** 解析藏品主题输出（容忍 ```json 围栏与思考文字夹带）。 */
  private parseCollectibleTheme(content: string): CollectibleTheme | null {
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
      this.logger.warn('[Collectible] 藏品主题输出不是合法 JSON，已丢弃');
      return null;
    }
    const raw = parsed as Record<string, unknown>;
    const theme: CollectibleTheme = {
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
