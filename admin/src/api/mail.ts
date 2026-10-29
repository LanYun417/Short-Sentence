/**
 * 邮件设置接口（腾讯云 SES）。
 */
import { get, post, put } from './request';
import type { MailSettings, SaveMailSettingsPayload } from '@/types/api';

/** 读取设置（SecretId / SecretKey 只回掩码）。 */
export function getMailSettingsApi(): Promise<MailSettings> {
  return get<MailSettings>('/mail-settings');
}

/** 保存设置（secretId / secretKey 留空 = 不修改）。 */
export function saveMailSettingsApi(payload: SaveMailSettingsPayload): Promise<null> {
  return put<null>('/mail-settings', payload);
}

/** 发送测试邮件（用验证码模板发一条）。 */
export function testMailApi(to: string): Promise<null> {
  return post<null>('/mail-settings/test', { to });
}
