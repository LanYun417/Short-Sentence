/**
 * AI 配置常量（键集中在这里，避免读写两端各写一份字符串键而漂移）。
 *
 * 约定：值存在 `sys_config`（与「参数管理」同源），**空值回落环境变量**——
 * 这样本地开发/CI 继续用 .env，线上运营在后台填一次即可，无需改服务器配置重启。
 */
export const AI_CONFIG_KEYS = {
  /**
   * AI 模型列表（JSON 数组，多模型配置的唯一事实源）。
   * 每项 = { id, purpose: 'text'|'image', enabled, format, fullUrl, baseUrl, modelId, modelLabel, apiKey, advanced }。
   * 不分厂商：厂商差异只体现在「API 格式」字段上。
   */
  models: 'ai.models',

  /* ---- 以下为旧版单模型/NIM 通道键，仅用于一次性迁移读取，不再写入 ---- */
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
  [AI_CONFIG_KEYS.apiKey]: 'Agnes API Key（旧）',
  [AI_CONFIG_KEYS.baseUrl]: 'Agnes API 地址（旧）',
  [AI_CONFIG_KEYS.textModel]: 'Agnes 生文模型（旧）',
  [AI_CONFIG_KEYS.imageModel]: 'Agnes 生图模型（旧）',
  [AI_CONFIG_KEYS.nimBaseUrl]: 'NIM 上游地址（旧）',
  [AI_CONFIG_KEYS.nimApiKey]: 'NIM API Key（旧）',
  [AI_CONFIG_KEYS.nimModel]: 'NIM 生题模型（旧）',
  [AI_CONFIG_KEYS.genChannel]: '生题通道选择（旧）',
  [AI_CONFIG_KEYS.apiFormat]: 'API 格式（旧）',
  [AI_CONFIG_KEYS.fullUrl]: '完整 URL（旧）',
  [AI_CONFIG_KEYS.modelLabel]: '模型展示名称（旧）',
  [AI_CONFIG_KEYS.advanced]: '高级参数（旧）',
};
