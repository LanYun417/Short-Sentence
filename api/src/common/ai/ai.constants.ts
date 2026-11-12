/**
 * AI 配置常量（键集中在这里，避免读写两端各写一份字符串键而漂移）。
 *
 * 现行配置：模型列表存 `sys_config` 的 `ai.models`（JSON 数组）。
 * 旧版键（`ai.agnes.*` 单模型/NIM 通道）只用于**一次性迁移读取与迁移后清理**——
 * 键值字符串必须与老库保持一致，否则读不到旧配置；迁移完成后这些行会被删除。
 */
export const AI_CONFIG_KEYS = {
  /** AI 模型列表（JSON 数组，多模型配置的唯一事实源） */
  models: 'ai.models',
} as const;

/** 旧版单模型/NIM 通道键（仅迁移用；键名即老库原值）。 */
export const LEGACY_AI_CONFIG_KEYS = {
  apiKey: 'ai.agnes.apiKey',
  baseUrl: 'ai.agnes.baseUrl',
  textModel: 'ai.agnes.textModel',
  imageModel: 'ai.agnes.imageModel',
  nimBaseUrl: 'ai.agnes.nimBaseUrl',
  nimApiKey: 'ai.agnes.nimApiKey',
  nimModel: 'ai.agnes.nimModel',
  genChannel: 'ai.agnes.genChannel',
  apiFormat: 'ai.agnes.apiFormat',
  fullUrl: 'ai.agnes.fullUrl',
  modelLabel: 'ai.agnes.modelLabel',
  advanced: 'ai.agnes.advanced',
} as const;

/** 配置项的中文名（写库时作为 config_name）。 */
export const AI_CONFIG_NAMES: Record<string, string> = {
  [AI_CONFIG_KEYS.models]: 'AI 模型列表',
  [LEGACY_AI_CONFIG_KEYS.apiKey]: '旧版 API Key',
  [LEGACY_AI_CONFIG_KEYS.baseUrl]: '旧版 API 地址',
  [LEGACY_AI_CONFIG_KEYS.textModel]: '旧版生文模型',
  [LEGACY_AI_CONFIG_KEYS.imageModel]: '旧版生图模型',
  [LEGACY_AI_CONFIG_KEYS.nimBaseUrl]: '旧版 NIM 地址',
  [LEGACY_AI_CONFIG_KEYS.nimApiKey]: '旧版 NIM API Key',
  [LEGACY_AI_CONFIG_KEYS.nimModel]: '旧版 NIM 模型',
  [LEGACY_AI_CONFIG_KEYS.genChannel]: '旧版生题通道选择',
  [LEGACY_AI_CONFIG_KEYS.apiFormat]: '旧版 API 格式',
  [LEGACY_AI_CONFIG_KEYS.fullUrl]: '旧版完整 URL',
  [LEGACY_AI_CONFIG_KEYS.modelLabel]: '旧版模型展示名称',
  [LEGACY_AI_CONFIG_KEYS.advanced]: '旧版高级参数',
};
