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

/**
 * 测试连通性（发一个极短请求）。
 * @param channel 通道：'nim' 测英伟达 NIM 生题通道，缺省测全局 Agnes 生文模型。
 */
export function testAiApi(channel?: string): Promise<AiTestResult> {
  const url = channel ? '/ai-settings/test?channel=nim' : '/ai-settings/test';
  return post<AiTestResult>(url);
}
