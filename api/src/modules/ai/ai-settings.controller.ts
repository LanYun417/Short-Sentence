/**
 * AI 设置控制器（/api/ai-settings，管理端）。
 *
 * 为什么凭证存 sys_config 而不是环境变量：运营换 key / 换模型 / 换上游地址
 * 不必改服务器配置再重启；`apiKey` 只写不读（GET 只回掩码），避免从接口泄露。
 *
 * 保存后立即 `reload()` 刷新运行时快照，下一次 AI 调用即生效（无需重启进程）。
 */
import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { AppException } from '../../common/exception/app.exception.js';
import { type ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { AiSettingsService } from '../../common/ai/ai-settings.service.js';
import { maskSecret, saveAiSetting } from '../../common/ai/ai.config.js';
import { AI_CONFIG_KEYS, AI_CONFIG_NAMES } from '../../common/ai/ai.constants.js';
import { type AdvancedAiConfig, buildChatRequest } from '../../common/ai/ai-protocol.js';
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
  /** NIM 上游地址 */
  nimBaseUrl: string;
  /** NIM API Key 是否已配置 */
  nimApiKeyConfigured: boolean;
  /** 掩码后的 NIM API Key（末 4 位可见） */
  nimApiKeyMasked: string;
  /** NIM 生题模型（空 = 不启用通道） */
  nimModel: string;
  /** 生题内容生成通道选择：'agnes'（默认）或 'nim' */
  genChannel: string;
  /** 文本通道 API 格式 */
  apiFormat: string;
  /** 上游地址是否为完整 URL */
  fullUrl: boolean;
  /** 模型展示名称 */
  modelLabel: string;
  /** 高级参数 */
  advanced: AdvancedAiConfig;
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
      nimBaseUrl: settings.nimBaseUrl,
      nimApiKeyConfigured: settings.nimApiKey.length > 0,
      nimApiKeyMasked: maskSecret(settings.nimApiKey),
      nimModel: settings.nimModel,
      genChannel: settings.genChannel,
      apiFormat: settings.apiFormat,
      fullUrl: settings.fullUrl,
      modelLabel: settings.modelLabel,
      advanced: settings.advanced,
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
    // 组合校验：以「生题通道选择」为准——选 nim 才要求 NIM 三件套齐备；
    // 选 agnes 时即使配了 NIM 也不用（两套配置可共存、随时切换）。
    // 基于「本次变更后的合并值」判断，避免只改某一项、其余已存在被误拦截。
    const current = this.aiSettings.current;
    const mergedGen = {
      channel: dto.genChannel !== undefined ? dto.genChannel : current.genChannel,
      baseUrl: dto.nimBaseUrl !== undefined ? dto.nimBaseUrl : current.nimBaseUrl,
      apiKey: dto.nimApiKey !== undefined ? dto.nimApiKey : current.nimApiKey,
      model: dto.nimModel !== undefined ? dto.nimModel : current.nimModel,
    };
    if (mergedGen.channel === 'nim') {
      if (!mergedGen.model || !mergedGen.model.trim()) {
        throw AppException.badRequest('已选择 NIM 通道，请填写 NIM 生题模型');
      }
      if (!mergedGen.baseUrl || !mergedGen.baseUrl.trim()) {
        throw AppException.badRequest('已选择 NIM 通道，请填写 NIM 上游地址');
      }
      if (!mergedGen.apiKey || !mergedGen.apiKey.trim()) {
        throw AppException.badRequest('已选择 NIM 通道，请填写 NIM API Key');
      }
    }
    if (dto.nimBaseUrl !== undefined) {
      await saveAiSetting(
        this.prisma,
        AI_CONFIG_KEYS.nimBaseUrl,
        AI_CONFIG_NAMES[AI_CONFIG_KEYS.nimBaseUrl],
        dto.nimBaseUrl,
      );
    }
    if (dto.nimApiKey) {
      // 留空刻意跳过：前端拿不到真密钥，只能留空表示不改
      await saveAiSetting(
        this.prisma,
        AI_CONFIG_KEYS.nimApiKey,
        AI_CONFIG_NAMES[AI_CONFIG_KEYS.nimApiKey],
        dto.nimApiKey,
      );
    }
    if (dto.nimModel !== undefined) {
      await saveAiSetting(this.prisma, AI_CONFIG_KEYS.nimModel, AI_CONFIG_NAMES[AI_CONFIG_KEYS.nimModel], dto.nimModel);
    }
    if (dto.genChannel !== undefined) {
      await saveAiSetting(
        this.prisma,
        AI_CONFIG_KEYS.genChannel,
        AI_CONFIG_NAMES[AI_CONFIG_KEYS.genChannel],
        dto.genChannel,
      );
    }
    if (dto.apiFormat !== undefined) {
      await saveAiSetting(
        this.prisma,
        AI_CONFIG_KEYS.apiFormat,
        AI_CONFIG_NAMES[AI_CONFIG_KEYS.apiFormat],
        dto.apiFormat,
      );
    }
    if (dto.fullUrl !== undefined) {
      await saveAiSetting(
        this.prisma,
        AI_CONFIG_KEYS.fullUrl,
        AI_CONFIG_NAMES[AI_CONFIG_KEYS.fullUrl],
        dto.fullUrl ? '1' : '0',
      );
    }
    if (dto.modelLabel !== undefined) {
      await saveAiSetting(
        this.prisma,
        AI_CONFIG_KEYS.modelLabel,
        AI_CONFIG_NAMES[AI_CONFIG_KEYS.modelLabel],
        dto.modelLabel,
      );
    }
    if (dto.advanced !== undefined) {
      // 高级参数整体作为 JSON 块存储；存前剔除未填项（保留默认语义由 load 时 parseAdvanced 合并）
      await saveAiSetting(
        this.prisma,
        AI_CONFIG_KEYS.advanced,
        AI_CONFIG_NAMES[AI_CONFIG_KEYS.advanced],
        JSON.stringify(dto.advanced),
      );
    }
    // 刷新运行时快照：下一次 AI 调用即用新配置（无需重启）
    await this.aiSettings.reload();
    return { __raw: true, data: null, message: '已保存' };
  }

  /**
   * 测试连通性：用指定通道发一个极短的请求。
   *
   * `channel=nim` 时测英伟达 NIM 生题通道（地址/密钥/模型回落到全局 Agnes 对应项）；
   * 缺省测全局生文模型。只测文本模型（生图一次成本高、耗时数十秒，不适合做「点一下试试」）。
   * 失败时把上游状态码与前 200 字回包透出，便于定位 key/地址/模型哪个错了。
   */
  @Post('test')
  @RequirePermissions('system:ai:edit')
  @OperationLog('AI 设置', '测试连通性')
  async test(@Query('channel') channel?: string): Promise<ResponseEnvelope<{ latencyMs: number; model: string }>> {
    const settings = this.aiSettings.current;
    const useNim = channel === 'nim';
    const baseUrl = useNim ? settings.nimBaseUrl || settings.baseUrl : settings.baseUrl;
    const apiKey = useNim ? settings.nimApiKey || settings.apiKey : settings.apiKey;
    const model = useNim ? settings.nimModel : settings.textModel;
    if (!apiKey) {
      throw AppException.badRequest(useNim ? '尚未配置 NIM API Key' : '尚未配置 API Key');
    }
    if (useNim && !model) {
      throw AppException.badRequest('尚未配置 NIM 生题模型');
    }
    const startedAt = Date.now();
    // 走协议层构造请求，和真实调用走同一套格式/地址规则
    const req = buildChatRequest({
      baseUrl,
      apiKey,
      model,
      systemPrompt: '',
      userContent: 'ping',
      temperature: 0,
      maxTokens: 8,
      jsonMode: false,
      fullUrl: settings.fullUrl,
      format: settings.apiFormat,
      advanced: settings.advanced,
    });
    let response: Response;
    try {
      response = await fetch(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify(req.body),
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
      data: { latencyMs: Date.now() - startedAt, model },
      message: '连通正常',
    };
  }
}
