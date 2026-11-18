/**
 * 支付配置：微信公众号/商户密钥存 `sys_config`（键前缀 `pay.wechat.*`），环境变量兜底。
 *
 * 为什么放 sys_config（与 AI 模型 / 邮件设置同一口径）：用户要求「做完在后台配置密钥」——
 * 换商户号、换密钥、换回调地址都不该改服务器 `.env` 并重启。放 sys_config 还与「参数管理」
 * 同源，天然有操作审计与随库备份。
 *
 * 安全约定（与 AI / 邮件同一口径）：
 * - 私钥 / APIv3 密钥**明文存库**（调微信接口要能读），但读接口只回掩码与「是否已配置」；
 * - 更新为整表提交（唯一事实源），没有「留空表示不改」的单项语义；
 * - 环境变量只在新库没配过时兜底，之后一律以库为准。
 */
import { AppException } from '../exception/app.exception.js';
import { config } from '../config/config.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { isValidPemKey, normalizePrivateKey } from './wechatpay-crypto.js';

/** sys_config 键名。 */
export const PAY_CONFIG_KEYS = {
  appId: 'pay.wechat.appid',
  mchId: 'pay.wechat.mchid',
  serialNo: 'pay.wechat.serial',
  privateKey: 'pay.wechat.privateKey',
  apiv3Key: 'pay.wechat.apiv3Key',
  notifyUrl: 'pay.wechat.notifyUrl',
} as const;

/** 生效的微信支付配置（任一项为空 = 支付未配置）。 */
export interface PayWechatSettings {
  appId: string;
  mchId: string;
  serialNo: string;
  privateKey: string;
  apiv3Key: string;
  notifyUrl: string;
}

/** 后台展示形态（密钥一律不回明文）。 */
export interface PaySettingsView {
  appId: string;
  mchId: string;
  serialNo: string;
  privateKeyConfigured: boolean;
  privateKeyMasked: string;
  apiv3KeyConfigured: boolean;
  apiv3KeyMasked: string;
  notifyUrl: string;
  /** 是否已可用（六项齐全且私钥是合法 PEM、apiv3Key 32 位） */
  enabled: boolean;
  /** 不可用时的缺项说明（后台提示补哪项） */
  missing: string[];
}

/** 掩码：只留末 4 位。 */
function mask(value: string): string {
  if (!value) {
    return '';
  }
  return value.length <= 4 ? '****' : `****${value.slice(-4)}`;
}

/** 读生效配置：sys_config 优先，缺键回退环境变量。 */
export async function loadPaySettings(prisma: PrismaService): Promise<PayWechatSettings> {
  const keys = Object.values(PAY_CONFIG_KEYS);
  const rows = await prisma.sysConfig.findMany({
    where: { configKey: { in: keys } },
    select: { configKey: true, configValue: true },
  });
  const map = new Map(rows.map((row) => [row.configKey, row.configValue]));
  const pick = (key: string, env: string): string => (map.get(key) ?? '').trim() || env.trim();
  return {
    appId: pick(PAY_CONFIG_KEYS.appId, config.pay.wechat.appId),
    mchId: pick(PAY_CONFIG_KEYS.mchId, config.pay.wechat.mchId),
    serialNo: pick(PAY_CONFIG_KEYS.serialNo, config.pay.wechat.serialNo),
    privateKey: pick(PAY_CONFIG_KEYS.privateKey, config.pay.wechat.privateKey),
    apiv3Key: pick(PAY_CONFIG_KEYS.apiv3Key, config.pay.wechat.apiv3Key),
    notifyUrl: pick(PAY_CONFIG_KEYS.notifyUrl, config.pay.wechat.notifyUrl),
  };
}

/** 检查某项配置缺失原因（后台「支付设置」按此提示补哪项）。 */
export function paySettingsMissing(settings: PayWechatSettings): string[] {
  const missing: string[] = [];
  if (!settings.appId) missing.push('AppID');
  if (!settings.mchId) missing.push('商户号');
  if (!settings.serialNo) missing.push('商户证书序列号');
  if (!settings.privateKey) missing.push('商户 API 私钥');
  if (!settings.apiv3Key) missing.push('APIv3 密钥');
  else if (settings.apiv3Key.length !== 32) missing.push('APIv3 密钥（须 32 位）');
  if (!settings.notifyUrl) missing.push('回调地址');
  const pem = normalizePrivateKey(settings.privateKey);
  if (pem && !isValidPemKey(pem)) missing.push('商户 API 私钥（PEM 格式不正确）');
  return missing;
}

/** 配置是否可用（六项齐全）。 */
export function isPayEnabled(settings: PayWechatSettings): boolean {
  return paySettingsMissing(settings).length === 0;
}

/** 配置转后台展示形态（密钥回掩码，绝不回明文）。 */
export function toPaySettingsView(settings: PayWechatSettings): PaySettingsView {
  return {
    appId: settings.appId,
    mchId: settings.mchId,
    serialNo: settings.serialNo,
    privateKeyConfigured: settings.privateKey.length > 0,
    privateKeyMasked: mask(settings.privateKey),
    apiv3KeyConfigured: settings.apiv3Key.length > 0,
    apiv3KeyMasked: mask(settings.apiv3Key),
    notifyUrl: settings.notifyUrl,
    enabled: isPayEnabled(settings),
    missing: paySettingsMissing(settings),
  };
}

/** 保存配置（整表提交；入库前做可读性校验）。 */
export async function savePaySettings(prisma: PrismaService, input: PayWechatSettings): Promise<void> {
  const pem = normalizePrivateKey(input.privateKey);
  if (pem && !isValidPemKey(pem)) {
    throw AppException.badRequest('商户 API 私钥不是合法的 PEM（需含 -----BEGIN PRIVATE KEY----- 头）');
  }
  if (input.apiv3Key && input.apiv3Key.length !== 32) {
    throw AppException.badRequest('APIv3 密钥须为 32 位（商户平台设置的密钥原文）');
  }
  if (input.notifyUrl && !/^https?:\/\//.test(input.notifyUrl)) {
    throw AppException.badRequest('回调地址须是完整 URL（https://<域名>/api/pay/notify/wechat）');
  }

  const entries: Array<{ key: string; name: string; value: string }> = [
    { key: PAY_CONFIG_KEYS.appId, name: '微信支付 AppID', value: input.appId },
    { key: PAY_CONFIG_KEYS.mchId, name: '微信支付商户号', value: input.mchId },
    { key: PAY_CONFIG_KEYS.serialNo, name: '商户证书序列号', value: input.serialNo },
    { key: PAY_CONFIG_KEYS.privateKey, name: '商户 API 私钥', value: input.privateKey },
    { key: PAY_CONFIG_KEYS.apiv3Key, name: 'APIv3 密钥', value: input.apiv3Key },
    { key: PAY_CONFIG_KEYS.notifyUrl, name: '支付回调地址', value: input.notifyUrl },
  ];

  for (const entry of entries) {
    await prisma.sysConfig.upsert({
      where: { configKey: entry.key },
      update: { configValue: entry.value },
      create: {
        configName: entry.name,
        configKey: entry.key,
        configValue: entry.value,
        systemFlag: 1,
        remark: '微信支付配置（后台「支付设置」维护；敏感项只回掩码）',
      },
    });
  }
}
