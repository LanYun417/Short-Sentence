/**
 * 邮件服务：把「SES 客户端 + 配置读取 + 业务模板」串起来。
 *
 * 只做三件事：
 * 1. 发验证码（注册 / 登录 / 找回密码，模板 66220：「短句-验证码」，变量 action / code）；
 * 2. 发每日学习提醒（模板 66223：「短句-每日学习提醒」，变量 nickname）；
 * 3. 后台「测试发信」（用验证码模板发一条，验证凭证与模板是否配好）。
 *
 * 失败一律抛出可读错误（腾讯云错误码附在消息里），不做静默降级——
 * 邮件发不出去时，用户与运营都应该立刻知道原因（域名未验证 / 模板 ID 错 / 额度用尽）。
 */
import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../exception/app.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { loadMailSettings, type MailSettings } from './mail.config.js';
import { sesSendEmail, SesError } from './tencent-ses.client.js';

/** 邮件服务就绪状态（后台展示用）。 */
export interface MailStatus {
  enabled: boolean;
  /** 凭证与发件人是否齐全（齐全才可能发出去） */
  ready: boolean;
  /** 缺失项的中文名（ready=false 时非空） */
  missing: string[];
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 当前配置（含真实密钥，仅进程内使用，不要直接返回给接口）。 */
  settings(): Promise<MailSettings> {
    return loadMailSettings(this.prisma);
  }

  /** 就绪状态（后台展示，不泄露密钥）。 */
  async status(): Promise<MailStatus> {
    const settings = await this.settings();
    const missing: string[] = [];
    if (!settings.secretId) {
      missing.push('SecretId');
    }
    if (!settings.secretKey) {
      missing.push('SecretKey');
    }
    if (!settings.fromAddress) {
      missing.push('发件人邮箱');
    }
    if (!settings.templateCaptcha) {
      missing.push('验证码模板 ID');
    }
    if (!settings.templateReminder) {
      missing.push('每日提醒模板 ID');
    }
    return { enabled: settings.enabled, ready: missing.length === 0, missing };
  }

  /** 发送前置校验：启用 + 配置齐全。 */
  private async assertReady(): Promise<MailSettings> {
    const settings = await this.settings();
    if (!settings.enabled) {
      throw AppException.badRequest('邮件服务未启用，请先在「邮件设置」里打开开关');
    }
    const status = await this.status();
    if (!status.ready) {
      throw AppException.badRequest(`邮件服务配置不完整：缺少 ${status.missing.join('、')}`);
    }
    return settings;
  }

  /**
   * 按模板发一封信。
   *
   * @param to 收件人
   * @param templateId 腾讯云模板 ID
   * @param data 模板变量（键名必须与模板里的 {{变量}} 一致）
   * @param subject 邮件主题（腾讯云模板邮件也要求传）
   */
  async sendTemplate(to: string, templateId: number, data: Record<string, string>, subject: string): Promise<void> {
    const settings = await this.assertReady();
    const from = settings.fromAlias ? `${settings.fromAlias} <${settings.fromAddress}>` : settings.fromAddress;
    try {
      const result = await sesSendEmail(
        { secretId: settings.secretId, secretKey: settings.secretKey, region: settings.region },
        {
          FromEmailAddress: from,
          Destination: [to],
          Subject: subject,
          // 模板邮件的变量必须是 JSON **字符串**（不是对象），腾讯云要求如此
          Template: { TemplateID: templateId, TemplateData: JSON.stringify(data) },
        },
      );
      this.logger.log(`[Mail] 已发送模板 ${templateId} → ${to}（MessageId=${result.messageId || '未知'}）`);
    } catch (error) {
      if (error instanceof SesError) {
        this.logger.warn(`[Mail] 发送失败 ${to}：${error.code} ${error.message}`);
        throw AppException.badRequest(`邮件发送失败：${error.message}（${error.code}）`);
      }
      this.logger.error(`[Mail] 发送异常 ${to}：${error instanceof Error ? error.message : String(error)}`);
      throw AppException.badRequest('邮件发送失败，请稍后重试');
    }
  }

  /** 验证码邮件（action 如「注册」「登录」，会显示在正文里）。 */
  async sendCaptcha(to: string, code: string, action: string): Promise<void> {
    const settings = await this.settings();
    await this.sendTemplate(to, settings.templateCaptcha, { action, code }, `短句 - ${action}验证码`);
  }

  /** 每日学习提醒。 */
  async sendDailyReminder(to: string, nickname: string): Promise<void> {
    const settings = await this.settings();
    await this.sendTemplate(to, settings.templateReminder, { nickname }, '短句 - 今日的英语挑战已备好');
  }

  /** 后台「发送测试邮件」：用验证码模板发一条固定内容，验证凭证/模板/域名都通。 */
  async sendTest(to: string): Promise<void> {
    await this.sendCaptcha(to, '123456', '测试');
  }
}
