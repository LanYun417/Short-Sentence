/**
 * AI 配置常量（键集中在这里，避免读写两端各写一份字符串键而漂移）。
 *
 * 约定：值存在 `sys_config`（与「参数管理」同源），**空值回落环境变量**——
 * 这样本地开发/CI 继续用 .env，线上运营在后台填一次即可，无需改服务器配置重启。
 */
export const AI_CONFIG_KEYS = {
  /** Agnes API Key（只写不读：接口只回掩码） */
  apiKey: 'ai.agnes.apiKey',
  /** 上游地址（含 /v1） */
  baseUrl: 'ai.agnes.baseUrl',
  /** 生文模型 */
  textModel: 'ai.agnes.textModel',
  /** 生图模型 */
  imageModel: 'ai.agnes.imageModel',
  /** 英伟达 NIM 生题通道 - 上游地址（可选；留空回落 Agnes） */
  nimBaseUrl: 'ai.agnes.nimBaseUrl',
  /** 英伟达 NIM 生题通道 - API Key（可选；留空回落 Agnes） */
  nimApiKey: 'ai.agnes.nimApiKey',
  /** 英伟达 NIM 生题通道 - 模型名（可选；留空 = 不启用通道） */
  nimModel: 'ai.agnes.nimModel',
  /** 生题内容生成通道选择：'agnes'（默认）或 'nim'（选 nim 时才走 NIM） */
  genChannel: 'ai.agnes.genChannel',
} as const;

/** 配置项的中文名（写库时作为 config_name）。 */
export const AI_CONFIG_NAMES: Record<string, string> = {
  [AI_CONFIG_KEYS.apiKey]: 'Agnes API Key',
  [AI_CONFIG_KEYS.baseUrl]: 'Agnes API 地址',
  [AI_CONFIG_KEYS.textModel]: 'Agnes 生文模型',
  [AI_CONFIG_KEYS.imageModel]: 'Agnes 生图模型',
  [AI_CONFIG_KEYS.nimBaseUrl]: 'NIM 上游地址',
  [AI_CONFIG_KEYS.nimApiKey]: 'NIM API Key',
  [AI_CONFIG_KEYS.nimModel]: 'NIM 生题模型',
  [AI_CONFIG_KEYS.genChannel]: '生题通道选择',
};
