/**
 * 邮件配置：存取 `sys_config` 里的邮件相关键。
 *
 * 为什么不放环境变量：用户要求「凭证后台可编辑」——运营换 SES 账号、换发件地址、
 * 换模板都不该改服务器配置并重启。放 sys_config 还有一个好处：与「参数管理」同源，
 * 天然有审计（操作日志）与备份。
 *
 * 安全约定：
 * - `secretKey` 明文存库（要能用于签名），但**任何读接口都不回显**，只回显是否已配置；
 * - 更新时传空串表示「不修改」，避免前端用掩码值把真密钥覆盖掉。
 */
import { AppException } from '../exception/app.exception.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { MAIL_CONFIG_KEYS } from './mail.constants.js';

/** 读取后的邮件配置（secretKey 为空表示未配置）。 */
export interface MailSettings {
  enabled: boolean;
  secretId: string;
  secretKey: string;
  region: string;
  fromAddress: string;
  fromAlias: string;
  /** 验证码模板 ID（腾讯云 SES 控制台创建） */
  templateCaptcha: number;
  /** 每日学习提醒模板 ID */
  templateReminder: number;
  /** 周报模板 ID（0 = 未配置；周报定时任务跳过发信，不影响站内周报） */
  templateWeekly: number;
}

/** 一次性把邮件相关配置全读出来（键很少，无需缓存；后台改完立即生效）。 */
export async function loadMailSettings(prisma: PrismaService): Promise<MailSettings> {
  const rows = await prisma.sysConfig.findMany({
    where: { configKey: { in: Object.values(MAIL_CONFIG_KEYS) } },
    select: { configKey: true, configValue: true },
  });
  const map = new Map(rows.map((row) => [row.configKey, row.configValue]));
  const value = (key: string): string => (map.get(key) ?? '').trim();
  const num = (key: string, fallback: number): number => {
    const parsed = Number(value(key));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    enabled: value(MAIL_CONFIG_KEYS.enabled) === '1',
    secretId: value(MAIL_CONFIG_KEYS.secretId),
    secretKey: value(MAIL_CONFIG_KEYS.secretKey),
    region: value(MAIL_CONFIG_KEYS.region) || 'ap-guangzhou',
    fromAddress: value(MAIL_CONFIG_KEYS.fromAddress),
    fromAlias: value(MAIL_CONFIG_KEYS.fromAlias) || '短句',
    templateCaptcha: num(MAIL_CONFIG_KEYS.templateCaptcha, 0),
    templateReminder: num(MAIL_CONFIG_KEYS.templateReminder, 0),
    templateWeekly: num(MAIL_CONFIG_KEYS.templateWeekly, 0),
  };
}

/** 写入（或更新）单个邮件配置项。 */
export async function saveMailSetting(
  prisma: PrismaService,
  key: string,
  configName: string,
  value: string,
): Promise<void> {
  const trimmed = value.trim();
  // VarChar(500)：密钥/地址都远小于它，超长直接拒，避免数据库静默截断
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
      remark: '邮件服务配置（后台「邮件设置」维护）',
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
