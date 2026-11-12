/**
 * 生图 Provider（模型列表里第一个启用的「生图」用途模型）。
 * 模块职责：按场景提示词生成对话场景图，返回原始字节（转 webp 与入库由调用方负责）。
 *
 * 契约：固定走 OpenAI 兼容的 images 接口（POST {baseUrl}/images/generations，Bearer 认证）；
 * 请求体 { model, prompt, size, ratio, extra_body: { response_format: 'url' } }；
 * 响应 data[0].url（默认）或 data[0].b64_json（return_base64: true / b64_json）。
 * 注意：`response_format` 只能放 extra_body 里，放顶层会被上游拒绝。
 * 16:9 2K 档输出 2624x1472，正适合卡片图；上游生成可能数十秒，超时按官方建议放宽。
 */
import { Injectable } from '@nestjs/common';
import { config } from '../config/config.js';
import { AiCallLogService } from './ai-call-log.service.js';
import { AiBudgetService } from './ai-budget.service.js';
import { AiSettingsService } from './ai-settings.service.js';
import { AiProviderError, type GeneratedImage, type ImageGenProvider } from './ai.types.js';
import { resolveImageEndpoint, resolveModel } from './ai-protocol.js';

/** 生图响应结构。 */
interface ImageGenResponse {
  data?: Array<{ url?: string | null; b64_json?: string | null }>;
}

@Injectable()
export class ImageGenApiProvider implements ImageGenProvider {
  constructor(
    private readonly aiCallLog: AiCallLogService,
    private readonly budget: AiBudgetService,
    private readonly aiSettings: AiSettingsService,
  ) {}

  /** 未配置启用的「生图」用途模型时禁用生图能力（由调用方转为明确的业务错误）。 */
  get enabled(): boolean {
    const model = resolveModel(this.aiSettings.current.models, 'image');
    return !!model && model.baseUrl.trim().length > 0 && model.modelId.trim().length > 0;
  }

  /** 按提示词生成一张图（URL 输出，下载后返回字节）。 */
  async generate(prompt: string, options: { size: string; ratio: string }): Promise<GeneratedImage> {
    const model = resolveModel(this.aiSettings.current.models, 'image');
    if (!model || !model.baseUrl || !model.modelId) {
      throw new AiProviderError('生图能力未配置（AI 设置里添加并启用一个「生图」用途的模型）', { retryable: false });
    }
    // 预算闸门放在 try 之前：超额时抛不可重试错误且不写 ai_call_log（详见 text-chat.provider）
    await this.budget.assertWithinBudget();

    const startedAt = Date.now();
    try {
      const response = await fetch(resolveImageEndpoint(model.baseUrl, !!model.fullUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${model.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model.modelId,
          prompt,
          size: options.size,
          ratio: options.ratio,
          extra_body: { response_format: 'url' },
        }),
        signal: AbortSignal.timeout(config.ai.requestTimeoutMs),
      });

      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 300);
        throw new AiProviderError(`生图接口返回 ${response.status}: ${detail}`, {
          retryable: response.status === 429 || response.status >= 500,
          status: response.status,
        });
      }

      const body = (await response.json()) as ImageGenResponse;
      const first = body.data?.[0];
      if (first?.b64_json) {
        const buffer = Buffer.from(first.b64_json, 'base64');
        await this.logCall('success', Date.now() - startedAt, null);
        return { buffer, mimeType: 'image/png' };
      }
      if (first?.url) {
        // URL 输出：下载为字节（图片最终要转 webp 入本地库，不持久化上游 URL）
        const imageResponse = await fetch(first.url, {
          signal: AbortSignal.timeout(config.ai.requestTimeoutMs),
        });
        if (!imageResponse.ok) {
          throw new AiProviderError(`生图下载失败: HTTP ${imageResponse.status}`, {
            retryable: true,
            status: imageResponse.status,
          });
        }
        const buffer = Buffer.from(await imageResponse.arrayBuffer());
        await this.logCall('success', Date.now() - startedAt, null);
        return { buffer, mimeType: imageResponse.headers.get('content-type') ?? 'image/png' };
      }
      throw new AiProviderError('生图接口未返回图像（url/b64_json 均为空）', { retryable: true });
    } catch (error) {
      await this.logCall('failed', Date.now() - startedAt, error instanceof Error ? error.message : String(error));
      if (error instanceof AiProviderError) {
        throw error;
      }
      throw new AiProviderError(`生图接口调用失败: ${error instanceof Error ? error.message : String(error)}`, {
        retryable: true,
      });
    }
  }

  /** 写调用日志（失败静默）。 */
  private async logCall(status: string, latencyMs: number, errorMessage: string | null): Promise<void> {
    await this.aiCallLog.record({
      type: 'image_gen',
      provider: resolveModel(this.aiSettings.current.models, 'image')?.id ?? 'image-model',
      model: resolveModel(this.aiSettings.current.models, 'image')?.modelId ?? '-',
      latencyMs,
      status,
      errorMessage,
    });
  }
}
