/**
 * 邮件相关常量（配置键集中在这里，避免读写两端各写一份字符串键而漂移）。
 */
export const MAIL_CONFIG_KEYS = {
  /** 总开关：1 启用 / 0 停用 */
  enabled: 'mail.enabled',
  secretId: 'mail.ses.secretId',
  secretKey: 'mail.ses.secretKey',
  region: 'mail.ses.region',
  fromAddress: 'mail.ses.fromAddress',
  fromAlias: 'mail.ses.fromAlias',
  templateCaptcha: 'mail.ses.templateCaptcha',
  templateReminder: 'mail.ses.templateReminder',
  /** 周报邮件模板 ID（可选：未配置时定时任务跳过发信） */
  templateWeekly: 'mail.ses.templateWeekly',
} as const;

/** 配置项的中文名（写库时作为 config_name）。 */
export const MAIL_CONFIG_NAMES: Record<string, string> = {
  [MAIL_CONFIG_KEYS.enabled]: '邮件服务开关',
  [MAIL_CONFIG_KEYS.secretId]: 'SES SecretId',
  [MAIL_CONFIG_KEYS.secretKey]: 'SES SecretKey',
  [MAIL_CONFIG_KEYS.region]: 'SES 地域',
  [MAIL_CONFIG_KEYS.fromAddress]: '发件人邮箱',
  [MAIL_CONFIG_KEYS.fromAlias]: '发件人显示名',
  [MAIL_CONFIG_KEYS.templateCaptcha]: '验证码邮件模板 ID',
  [MAIL_CONFIG_KEYS.templateReminder]: '每日提醒邮件模板 ID',
  [MAIL_CONFIG_KEYS.templateWeekly]: '周报邮件模板 ID',
};
