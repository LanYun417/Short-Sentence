/**
 * AI 设置控制器（/api/ai-settings，管理端）。
 *
 * 为什么凭证存 sys_config 而不是环境变量：运营换 key / 换模型 / 换上游地址
 * 不必改服务器配置再重启；`apiKey` 只写不读（GET 只回掩码），避免从接口泄露。
 *
 * 保存后立即 `reload()` 刷新运行时快照，下一次 AI 调用即生效（无需重启进程）。
 */
import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { AppException } from '../../common/exception/app.exception.js';
import { type ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { AiSettingsService } from '../../common/ai/ai-settings.service.js';
import { maskSecret, saveAiSetting } from '../../common/ai/ai.config.js';
import { AI_CONFIG_KEYS, AI_CONFIG_NAMES } from '../../common/ai/ai.constants.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UpdateAiSettingsDto } from './ai-settings.dto.js';

/** 对外展示的 AI 设置（**不含真实 API Key**）。 */
export interface AiSettingsView {
  /** 是否已配置 API Key */
  apiKeyConfigured: boolean;
  /** 掩码后的 API Key（末 4 位可见） */
  apiKeyMasked: string;
  /** 上游地址 */
  baseUrl: string;
  /** 生文模型 */
  textModel: string;
  /** 生图模型 */
  imageModel: string;
  /** 是否可用（API Key 非空） */
  enabled: boolean;
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
      apiKeyConfigured: settings.apiKey.length > 0,
      apiKeyMasked: maskSecret(settings.apiKey),
      baseUrl: settings.baseUrl,
      textModel: settings.textModel,
      imageModel: settings.imageModel,
      enabled: settings.apiKey.length > 0,
    };
  }

  /** 保存设置（apiKey 传空 = 不修改）。 */
  @Put()
  @RequirePermissions('system:ai:edit')
  @OperationLog('AI 设置', '保存')
  async save(@Body() dto: UpdateAiSettingsDto): Promise<ResponseEnvelope<null>> {
    // 逐项写：只写本次传了的，没传的保持原值（避免前端表单没填的字段被清空）
    if (dto.apiKey) {
      // 空串刻意跳过：前端拿不到真密钥，只能留空表示不改
      await saveAiSetting(this.prisma, AI_CONFIG_KEYS.apiKey, AI_CONFIG_NAMES[AI_CONFIG_KEYS.apiKey], dto.apiKey);
    }
    if (dto.baseUrl !== undefined) {
      await saveAiSetting(this.prisma, AI_CONFIG_KEYS.baseUrl, AI_CONFIG_NAMES[AI_CONFIG_KEYS.baseUrl], dto.baseUrl);
    }
    if (dto.textModel !== undefined) {
      await saveAiSetting(
        this.prisma,
        AI_CONFIG_KEYS.textModel,
        AI_CONFIG_NAMES[AI_CONFIG_KEYS.textModel],
        dto.textModel,
      );
    }
    if (dto.imageModel !== undefined) {
      await saveAiSetting(
        this.prisma,
        AI_CONFIG_KEYS.imageModel,
        AI_CONFIG_NAMES[AI_CONFIG_KEYS.imageModel],
        dto.imageModel,
      );
    }
    // 刷新运行时快照：下一次 AI 调用即用新配置（无需重启）
    await this.aiSettings.reload();
    return { __raw: true, data: null, message: '已保存' };
  }

  /**
   * 测试连通性：用当前生文模型发一个极短的请求。
   *
   * 只测文本模型（生图一次成本高、耗时数十秒，不适合做「点一下试试」）。
   * 失败时把上游状态码与前 200 字回包透出，便于定位 key/地址/模型哪个错了。
   */
  @Post('test')
  @RequirePermissions('system:ai:edit')
  @OperationLog('AI 设置', '测试连通性')
  async test(): Promise<ResponseEnvelope<{ latencyMs: number; model: string }>> {
    const settings = this.aiSettings.current;
    if (!settings.apiKey) {
      throw AppException.badRequest('尚未配置 API Key');
    }
    const startedAt = Date.now();
    let response: Response;
    try {
      response = await fetch(`${settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.textModel,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 8,
        }),
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
      data: { latencyMs: Date.now() - startedAt, model: settings.textModel },
      message: '连通正常',
    };
  }
}
