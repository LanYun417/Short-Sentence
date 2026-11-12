/**
 * AI 配置：模型列表存 `sys_config` 的 `ai.models`（JSON 数组）。
 *
 * 一次配置、多模型：每项含用途（text 生文 / image 生图）、API 格式、地址、模型 ID、Key 与
 * 高级参数——**不分厂商**（Agnes / 英伟达 NIM 的双通道概念已废弃），厂商差异只体现在
 * 「API 格式」字段上。
 *
 * 为什么不放环境变量：用户要求「后台可管理」——换 key、换模型、加上游都不该改服务器配置
 * 并重启。放 sys_config 还有两个好处：与「参数管理」同源，天然有操作审计与随库备份。
 *
 * 安全约定（与邮件设置同一口径）：
 * - `apiKey` 明文存库（调用上游要能读），但读接口只回掩码，绝不回显；
 * - 更新时**整表提交**（models 数组是唯一事实源），不再有「留空表示不改」的单项语义。
 *
 * 兼容：老库里的 `ai.agnes.*` / `ai.agnes.nim*` 单模型配置，首次加载时**自动迁移**
 * 成模型列表（文本模型按原 genChannel 选择取 Agnes 或 NIM），并写回 `ai.models`。
 */
import { AppException } from '../exception/app.exception.js';
import { config } from '../config/config.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { AI_CONFIG_KEYS } from './ai.constants.js';
import {
  type AdvancedAiConfig,
  type AiModelConfig,
  type ApiFormat,
  DEFAULT_ADVANCED,
  normalizeApiFormat,
  parseAdvanced,
  parseModels,
} from './ai-protocol.js';

export type { AdvancedAiConfig, AiModelConfig, ApiFormat } from './ai-protocol.js';

/** 运行时生效的 AI 配置（模型列表为空表示未配置）。 */
export interface AiSettings {
  /** 全部模型（含禁用）；为空 = 未配置 */
  models: AiModelConfig[];
  /** 是否刚从旧版单模型配置迁移而来（供 service 写回一次） */
  migrated?: boolean;
}

/** 去掉末尾斜杠，避免拼出 `//chat/completions`（后台手填地址时很常见）。 */
function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

/** 旧版单模型/NIM 配置迁移成模型列表（读旧键，值空回落环境变量）。 */
function migrateLegacyModels(map: Map<string, string>): AiModelConfig[] {
  const value = (key: string, fallback: string): string => {
    const fromDb = (map.get(key) ?? '').trim();
    return fromDb || fallback.trim();
  };
  const apiKey = value(AI_CONFIG_KEYS.apiKey, config.ai.agnes.apiKey);
  const baseUrl = normalizeBaseUrl(value(AI_CONFIG_KEYS.baseUrl, config.ai.agnes.baseUrl));
  const textModel = value(AI_CONFIG_KEYS.textModel, config.ai.agnes.textModel);
  const imageModel = value(AI_CONFIG_KEYS.imageModel, config.ai.agnes.imageModel);
  const genChannel = value(AI_CONFIG_KEYS.genChannel, config.ai.agnes.genChannel) === 'nim' ? 'nim' : 'agnes';

  // 文本模型：原来选 NIM 且有 NIM 模型时用 NIM 三件套（缺项回落 Agnes），否则用 Agnes。
  const nimModel = value(AI_CONFIG_KEYS.nimModel, config.ai.agnes.nimModel);
  const isNim = genChannel === 'nim' && !!nimModel;
  const models: AiModelConfig[] = [];
  if (isNim) {
    models.push({
      id: 'text-1',
      purpose: 'text',
      enabled: true,
      format: 'openai_chat',
      fullUrl: false,
      baseUrl: normalizeBaseUrl(value(AI_CONFIG_KEYS.nimBaseUrl, config.ai.agnes.nimBaseUrl) || baseUrl),
      modelId: nimModel,
      modelLabel: '',
      apiKey: value(AI_CONFIG_KEYS.nimApiKey, config.ai.agnes.nimApiKey) || apiKey,
      advanced: { ...DEFAULT_ADVANCED },
    });
  }
  if (textModel || apiKey) {
    models.push({
      id: isNim ? 'text-2' : 'text-1',
      purpose: 'text',
      enabled: !isNim,
      format: normalizeApiFormat(value(AI_CONFIG_KEYS.apiFormat, 'openai_chat')),
      fullUrl: ['1', 'true', 'yes'].includes(value(AI_CONFIG_KEYS.fullUrl, '').toLowerCase()),
      baseUrl,
      modelId: textModel,
      modelLabel: value(AI_CONFIG_KEYS.modelLabel, ''),
      apiKey,
      advanced: parseAdvanced(map.get(AI_CONFIG_KEYS.advanced) ?? ''),
    });
  }
  if (imageModel) {
    models.push({
      id: 'image-1',
      purpose: 'image',
      enabled: true,
      format: 'openai_chat',
      fullUrl: false,
      baseUrl,
      modelId: imageModel,
      modelLabel: '',
      apiKey,
      advanced: { ...DEFAULT_ADVANCED },
    });
  }
  return models;
}

/**
 * 读模型列表（`ai.models`）。
 * 老库没有该键时按旧键迁移（见 migrateLegacyModels），并置 migrated 供 service 写回一次。
 */
export async function loadAiSettings(prisma: PrismaService): Promise<AiSettings> {
  const rows = await prisma.sysConfig.findMany({
    where: { configKey: { in: Object.values(AI_CONFIG_KEYS) } },
    select: { configKey: true, configValue: true },
  });
  const map = new Map(rows.map((row) => [row.configKey, row.configValue]));
  // ai.models 缺失 / 空 / 非法 JSON / 空数组 → 都按旧配置迁移（保证升级后不丢配置）
  const models = parseModels(map.get(AI_CONFIG_KEYS.models) ?? '');
  if (models.length > 0) {
    return { models };
  }
  return { models: migrateLegacyModels(map), migrated: true };
}

/** 写入整份模型列表（唯一事实源，覆盖式）。 */
export async function saveAiModels(prisma: PrismaService, models: AiModelConfig[]): Promise<void> {
  const json = JSON.stringify(models);
  if (json.length > 20000) {
    throw AppException.badRequest('模型配置过长（最多 20000 字符）');
  }
  await prisma.sysConfig.upsert({
    where: { configKey: AI_CONFIG_KEYS.models },
    update: { configValue: json },
    create: {
      configName: 'AI 模型列表',
      configKey: AI_CONFIG_KEYS.models,
      configValue: json,
      systemFlag: 1,
      remark: 'AI 模型列表（后台「AI 设置」维护；每项含用途/API 格式/地址/模型 ID/Key/高级参数）',
    },
  });
}

/** 掩码显示：只保留末 4 位（密钥短于 4 位时整体打码）。 */
export function maskSecret(secret: string): string {
  if (!secret) {
    return '';
  }
  return secret.length <= 4 ? '****' : `****${secret.slice(-4)}`;
}

/** 去掉 key 明文的展示形态（读接口用）。 */
export interface AiModelView {
  id: string;
  purpose: 'text' | 'image';
  enabled: boolean;
  format: ApiFormat;
  fullUrl: boolean;
  baseUrl: string;
  modelId: string;
  modelLabel: string;
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
  advanced: AdvancedAiConfig;
}

/** 模型列表转展示形态（剔除明文 Key）。 */
export function toModelViews(models: AiModelConfig[]): AiModelView[] {
  return models.map((m) => ({
    id: m.id,
    purpose: m.purpose,
    enabled: m.enabled,
    format: m.format,
    fullUrl: m.fullUrl,
    baseUrl: m.baseUrl,
    modelId: m.modelId,
    modelLabel: m.modelLabel,
    apiKeyConfigured: m.apiKey.length > 0,
    apiKeyMasked: maskSecret(m.apiKey),
    advanced: m.advanced,
  }));
}
