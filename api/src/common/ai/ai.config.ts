/**
 * AI 配置：存取 `sys_config` 里的 Agnes 相关键。
 *
 * 为什么不放环境变量：用户要求「AI 配置后台可管理」——运营换 key、换模型、换上游地址
 * 都不该改服务器配置并重启。放 sys_config 还有两个好处：与「参数管理」同源，天然有
 * 操作审计与随库备份。
 *
 * 回落规则：**DB 值优先，空值回落环境变量**。这样：
 * - 本地开发 / CI 继续用 .env，不必先在后台填一遍；
 * - 线上把 key 填进后台后立即生效（无需重建镜像、无需注入环境变量）。
 *
 * 安全约定（与邮件设置同一口径）：
 * - `apiKey` 明文存库（调用上游要能读），但**任何读接口都不回显**，只回显是否已配置 + 末 4 位掩码；
 * - 更新时传空串表示「不修改」，避免前端用掩码值把真密钥覆盖掉。
 */
import { AppException } from '../exception/app.exception.js';
import { config } from '../config/config.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { AI_CONFIG_KEYS } from './ai.constants.js';

/** 运行时生效的 AI 配置（apiKey 为空表示未配置）。 */
export interface AiSettings {
  apiKey: string;
  baseUrl: string;
  textModel: string;
  imageModel: string;
  /** 英伟达 NIM 生题通道 - 上游地址（空 = 不启用通道） */
  nimBaseUrl: string;
  /** 英伟达 NIM 生题通道 - API Key（空 = 回落 Agnes 密钥） */
  nimApiKey: string;
  /** 英伟达 NIM 生题通道 - 模型名（空 = 不启用通道，生题回落 textModel） */
  nimModel: string;
  /** 生题内容生成通道选择：'agnes'（默认）或 'nim'；'nim' 时生题内容生成走 NIM */
  genChannel: string;
}

/** 去掉末尾斜杠，避免拼出 `//chat/completions`（后台手填地址时很常见）。 */
function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

/**
 * 一次性把 AI 相关配置全读出来（键很少，无需缓存；后台改完由 AiSettingsService 刷新快照）。
 * @param prisma Prisma 实例
 * @returns 生效配置（DB 空值回落环境变量）
 */
export async function loadAiSettings(prisma: PrismaService): Promise<AiSettings> {
  const rows = await prisma.sysConfig.findMany({
    where: { configKey: { in: Object.values(AI_CONFIG_KEYS) } },
    select: { configKey: true, configValue: true },
  });
  const map = new Map(rows.map((row) => [row.configKey, row.configValue]));
  /** 取值：DB 非空优先，否则回落环境变量（再 trim）。 */
  const value = (key: string, fallback: string): string => {
    const fromDb = (map.get(key) ?? '').trim();
    return fromDb || fallback.trim();
  };
  return {
    apiKey: value(AI_CONFIG_KEYS.apiKey, config.ai.agnes.apiKey),
    baseUrl: normalizeBaseUrl(value(AI_CONFIG_KEYS.baseUrl, config.ai.agnes.baseUrl)),
    textModel: value(AI_CONFIG_KEYS.textModel, config.ai.agnes.textModel),
    imageModel: value(AI_CONFIG_KEYS.imageModel, config.ai.agnes.imageModel),
    nimBaseUrl: normalizeBaseUrl(value(AI_CONFIG_KEYS.nimBaseUrl, config.ai.agnes.nimBaseUrl)),
    nimApiKey: value(AI_CONFIG_KEYS.nimApiKey, config.ai.agnes.nimApiKey),
    nimModel: value(AI_CONFIG_KEYS.nimModel, config.ai.agnes.nimModel),
    // 非法值一律回落 'agnes'，避免脏数据把生题通道切到不存在的分支
    genChannel: value(AI_CONFIG_KEYS.genChannel, config.ai.agnes.genChannel) === 'nim' ? 'nim' : 'agnes',
  };
}

/** 写入（或更新）单个 AI 配置项。 */
export async function saveAiSetting(
  prisma: PrismaService,
  key: string,
  configName: string,
  value: string,
): Promise<void> {
  const trimmed = value.trim();
  // VarChar(500)：key / 地址 / 模型名都远小于它，超长直接拒，避免数据库静默截断
  if (trimmed.length > 500) {
    throw AppException.badRequest(`${configName} 过长（最多 500 字符）`);
  }
  await prisma.sysConfig.upsert({
    where: { configKey: key },
    update: { configValue: trimmed },
    create: {
      configName,
      configKey: key,
      configValue: trimmed,
      systemFlag: 1,
      remark: 'AI 服务配置（后台「AI 设置」维护；空值回落环境变量）',
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

/**
 * 解析「文本对话调用」实际使用的通道（baseUrl / apiKey / model）。
 *
 * `genChannel === 'nim'` 且配了 nimModel 时走 NIM 三件套（单个字段缺配时回落全局 Agnes，防御脏数据），
 * 否则走全局 Agnes 的 baseUrl / apiKey / textModel。
 *
 * 适用范围：所有走 chat/completions 的**纯文本**调用（生题流水线、文本审核、解析、逐词释义、
 * 句签文案、客户端造句 / 词根）。**图像生成（imageModel）与图像审核不受此影响**，始终走全局
 * baseUrl / apiKey——纯文本 NIM 模型不支持视觉输入，图像侧必须保持 Agnes。
 */
export function resolveTextChannel(s: AiSettings): { baseUrl: string; apiKey: string; model: string } {
  if (s.genChannel === 'nim' && s.nimModel) {
    return {
      baseUrl: s.nimBaseUrl || s.baseUrl,
      apiKey: s.nimApiKey || s.apiKey,
      model: s.nimModel,
    };
  }
  return { baseUrl: s.baseUrl, apiKey: s.apiKey, model: s.textModel };
}
