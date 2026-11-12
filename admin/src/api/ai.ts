/**
 * AI 设置接口（模型列表）。
 */
import { get, post, put } from './request';
import type { AiSettings, AiTestResult, SaveAiModel, SaveAiSettingsPayload } from '@/types/api';

/** 读取设置（API Key 只回掩码）。 */
export function getAiSettingsApi(): Promise<AiSettings> {
  return get<AiSettings>('/ai-settings');
}

/** 保存设置（整表提交模型列表；每项 apiKey 留空 = 沿用已存密钥）。 */
export function saveAiSettingsApi(payload: SaveAiSettingsPayload): Promise<null> {
  return put<null>('/ai-settings', payload);
}

/**
 * 测试连通性（发一个极短请求）。
 * @param model 未保存的模型草稿（优先按它测，key 留空则沿用已存同 id 的密钥）
 * @param id 已保存的模型配置 id（不传 model 时按 id 测，都不传测当前生效的生文模型）
 */
export function testAiApi(model?: SaveAiModel, id?: string): Promise<AiTestResult> {
  const url = id ? `/ai-settings/test?id=${encodeURIComponent(id)}` : '/ai-settings/test';
  return post<AiTestResult>(url, model ? { model } : {});
}
