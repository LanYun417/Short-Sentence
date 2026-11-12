/**
 * AI 设置控制器（/api/ai-settings，管理端）。
 *
 * 模型列表（不分厂商）：每项含用途（text 生文 / image 生图）、API 格式、地址、模型 ID、
 * Key 与高级参数。凭证明文存 sys_config 的 `ai.models`，读接口只回掩码，绝不回显。
 *
 * 保存后立即 `reload()` 刷新运行时快照，下一次 AI 调用即生效（无需重启进程）。
 */
import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { AppException } from '../../common/exception/app.exception.js';
import { type ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { AiSettingsService } from '../../common/ai/ai-settings.service.js';
import { saveAiModels, toModelViews, type AiModelView } from '../../common/ai/ai.config.js';
import {
  type AdvancedAiConfig,
  type AiModelConfig,
  type ApiFormat,
  buildChatRequest,
  normalizeApiFormat,
  parseAdvanced,
  resolveImageEndpoint,
} from '../../common/ai/ai-protocol.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SaveAiModelDto, TestAiDto, UpdateAiSettingsDto } from './ai-settings.dto.js';

/** 对外展示的 AI 设置（**不含真实 API Key**）。 */
export interface AiSettingsView {
  /** 全部模型（掩码形态） */
  models: AiModelView[];
  /** 当前生效的「生文」用途模型 id（没有则 null） */
  defaultTextModelId: string | null;
  /** 当前生效的「生图」用途模型 id（没有则 null） */
  defaultImageModelId: string | null;
}

@Controller('ai-settings')
export class AiSettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiSettings: AiSettingsService,
  ) {}

  /** 读取设置（API Key 只回掩码）。 */
  @Get()
  @RequirePermissions('system:ai:list')
  detail(): AiSettingsView {
    const settings = this.aiSettings.current;
    return {
      models: toModelViews(settings.models),
      defaultTextModelId: settings.models.find((m) => m.purpose === 'text' && m.enabled)?.id ?? null,
      defaultImageModelId: settings.models.find((m) => m.purpose === 'image' && m.enabled)?.id ?? null,
    };
  }

  /**
   * 保存设置（整表提交）。
   * 每项的 apiKey 留空 = 沿用已存密钥（匹配同 id 的旧值），避免前端把掩码回填成真值。
   */
  @Put()
  @RequirePermissions('system:ai:edit')
  @OperationLog('AI 设置', '保存')
  async save(@Body() dto: UpdateAiSettingsDto): Promise<ResponseEnvelope<null>> {
    const existing = new Map(this.aiSettings.current.models.map((m) => [m.id, m]));
    const seen = new Set<string>();
    const models: AiModelConfig[] = dto.models.map((m: SaveAiModelDto) => {
      if (seen.has(m.id)) {
        throw AppException.badRequest(`模型 id 重复：${m.id}`);
      }
      seen.add(m.id);
      return {
        id: m.id,
        purpose: m.purpose,
        enabled: m.enabled ?? true,
        // 生图固定 openai_chat（走 images 接口），文本按所选格式
        format: (m.purpose === 'image' ? 'openai_chat' : normalizeApiFormat(m.format)) as ApiFormat,
        fullUrl: !!m.fullUrl,
        baseUrl: m.baseUrl.trim(),
        modelId: m.modelId.trim(),
        modelLabel: (m.modelLabel ?? '').trim(),
        apiKey: (m.apiKey ?? '').trim() || existing.get(m.id)?.apiKey || '',
        advanced: parseAdvanced(m.advanced ?? {}) as AdvancedAiConfig,
      };
    });
    // 组合校验：启用的模型必须三项齐备；且至少一个启用的生文模型
    for (const m of models) {
      if (!m.enabled) continue;
      if (!m.baseUrl) throw AppException.badRequest(`模型「${m.modelLabel || m.id}」未填上游地址`);
      if (!m.modelId) throw AppException.badRequest(`模型「${m.modelLabel || m.id}」未填模型 ID`);
      if (!m.apiKey) throw AppException.badRequest(`模型「${m.modelLabel || m.id}」未填 API Key`);
    }
    if (!models.some((m) => m.purpose === 'text' && m.enabled)) {
      throw AppException.badRequest('至少需要一个启用的「生文」用途模型');
    }
    await saveAiModels(this.prisma, models);
    await this.aiSettings.reload();
    return { __raw: true, data: null, message: '已保存' };
  }

  /**
   * 测试连通性：用指定的模型（未保存的草稿或已存的 id）发一个极短请求。
   * 不传参时测当前生效的生文模型。失败时把上游状态码与前 200 字回包透出，便于定位。
   */
  @Post('test')
  @RequirePermissions('system:ai:edit')
  @OperationLog('AI 设置', '测试连通性')
  async test(
    @Body() body: TestAiDto,
    @Query('id') id?: string,
  ): Promise<ResponseEnvelope<{ latencyMs: number; model: string; id: string }>> {
    const saved = this.aiSettings.current.models;
    let target: AiModelConfig | undefined;
    if (body.model) {
      target = {
        id: body.model.id,
        purpose: body.model.purpose,
        enabled: true,
        format: (body.model.purpose === 'image' ? 'openai_chat' : normalizeApiFormat(body.model.format)) as ApiFormat,
        fullUrl: !!body.model.fullUrl,
        baseUrl: (body.model.baseUrl ?? '').trim(),
        modelId: (body.model.modelId ?? '').trim(),
        modelLabel: (body.model.modelLabel ?? '').trim(),
        apiKey: (body.model.apiKey ?? '').trim() || saved.find((m) => m.id === body.model?.id)?.apiKey || '',
        advanced: parseAdvanced(body.model.advanced ?? {}) as AdvancedAiConfig,
      };
    } else if (id) {
      target = saved.find((m) => m.id === id);
    } else {
      target = saved.find((m) => m.purpose === 'text' && m.enabled);
    }
    if (!target || !target.apiKey) {
      throw AppException.badRequest('尚未配置 API Key');
    }
    if (!target.baseUrl || !target.modelId) {
      throw AppException.badRequest('该模型未填上游地址或模型 ID');
    }
    const startedAt = Date.now();
    // 生图模型按 images 接口探活；文本模型按自身 API 格式探活
    const probe =
      target.purpose === 'image'
        ? {
            url: resolveImageEndpoint(target.baseUrl, !!target.fullUrl),
            headers: { Authorization: `Bearer ${target.apiKey}`, 'content-type': 'application/json' },
            body: {
              model: target.modelId,
              prompt: 'ping',
              size: '1024x1024',
              extra_body: { response_format: 'url' },
            } as Record<string, unknown>,
          }
        : buildChatRequest({
            baseUrl: target.baseUrl,
            apiKey: target.apiKey,
            model: target.modelId,
            systemPrompt: '',
            userContent: 'ping',
            temperature: 0,
            maxTokens: 8,
            jsonMode: false,
            fullUrl: !!target.fullUrl,
            format: target.format,
            advanced: target.advanced,
          });
    let response: Response;
    try {
      response = await fetch(probe.url, {
        method: 'POST',
        headers: probe.headers,
        body: JSON.stringify(probe.body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw AppException.badRequest(`连接失败：${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 200);
      throw AppException.badRequest(`上游返回 ${response.status}：${detail || '（无响应体）'}`);
    }
    return {
      __raw: true,
      data: { latencyMs: Date.now() - startedAt, model: target.modelId, id: target.id },
      message: '连通正常',
    };
  }
}
