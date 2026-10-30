/**
 * AI 设置接口（Agnes）。
 */
import { get, post, put } from './request';
import type { AiSettings, AiTestResult, SaveAiSettingsPayload } from '@/types/api';

/** 读取设置（API Key 只回掩码）。 */
export function getAiSettingsApi(): Promise<AiSettings> {
  return get<AiSettings>('/ai-settings');
}

/** 保存设置（apiKey 留空 = 不修改）。 */
export function saveAiSettingsApi(payload: SaveAiSettingsPayload): Promise<null> {
  return put<null>('/ai-settings', payload);
}

/** 测试连通性（用当前生文模型发一个极短请求）。 */
export function testAiApi(): Promise<AiTestResult> {
  return post<AiTestResult>('/ai-settings/test');
}
