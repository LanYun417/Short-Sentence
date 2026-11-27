/**
 * 邮件设置控制器（/api/mail-settings，管理端）。
 *
 * 凭证为什么存在这里而不是环境变量：运营要能自己换 SES 账号、发件地址与模板，
 * 不必改服务器配置再重启；`secretKey` 只写不读（GET 只回掩码），避免从接口泄露。
 */
import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { type ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { MailService, type MailStatus } from '../../common/mail/mail.service.js';
import { loadMailSettings, maskSecret, saveMailSetting } from '../../common/mail/mail.config.js';
import { MAIL_CONFIG_KEYS, MAIL_CONFIG_NAMES } from '../../common/mail/mail.constants.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TestMailDto, UpdateMailSettingsDto } from './mail-settings.dto.js';

/** 对外展示的邮件设置（**不含真实 SecretKey**）。 */
export interface MailSettingsView extends MailStatus {
  /** 掩码后的 SecretId（末 4 位可见） */
  secretId: string;
  /** 是否已配置 SecretKey */
  secretKeyConfigured: boolean;
  /** 掩码后的 SecretKey（末 4 位可见） */
  secretKeyMasked: string;
  region: string;
  fromAddress: string;
  fromAlias: string;
  templateCaptcha: number;
  templateReminder: number;
  /** 周报模板 ID（0 = 未配置，邮件周报不发送） */
  templateWeekly: number;
}

@Controller('mail-settings')
export class MailSettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /** 读取设置（密钥只回掩码）。 */
  @Get()
  @RequirePermissions('system:mail:list')
  async detail(): Promise<MailSettingsView> {
    const settings = await loadMailSettings(this.prisma);
    const status = await this.mailService.status();
    return {
      ...status,
      secretId: maskSecret(settings.secretId),
      secretKeyConfigured: settings.secretKey.length > 0,
      secretKeyMasked: maskSecret(settings.secretKey),
      region: settings.region,
      fromAddress: settings.fromAddress,
      fromAlias: settings.fromAlias,
      templateCaptcha: settings.templateCaptcha,
      templateReminder: settings.templateReminder,
      templateWeekly: settings.templateWeekly,
    };
  }

  /** 保存设置（secretKey 传空 = 不修改）。 */
  @Put()
  @RequirePermissions('system:mail:edit')
  @OperationLog('邮件设置', '保存')
  async save(@Body() dto: UpdateMailSettingsDto): Promise<ResponseEnvelope<null>> {
    await saveMailSetting(
      this.prisma,
      MAIL_CONFIG_KEYS.enabled,
      MAIL_CONFIG_NAMES[MAIL_CONFIG_KEYS.enabled],
      dto.enabled ? '1' : '0',
    );
    // 逐项写：只写本次传了的，没传的保持原值（避免前端表单没填的字段被清空）
    if (dto.secretId !== undefined) {
      await saveMailSetting(
        this.prisma,
        MAIL_CONFIG_KEYS.secretId,
        MAIL_CONFIG_NAMES[MAIL_CONFIG_KEYS.secretId],
        dto.secretId,
      );
    }
    if (dto.secretKey) {
      // 空串刻意跳过：前端拿不到真密钥，只能留空表示不改
      await saveMailSetting(
        this.prisma,
        MAIL_CONFIG_KEYS.secretKey,
        MAIL_CONFIG_NAMES[MAIL_CONFIG_KEYS.secretKey],
        dto.secretKey,
      );
    }
    if (dto.region !== undefined) {
      await saveMailSetting(
        this.prisma,
        MAIL_CONFIG_KEYS.region,
        MAIL_CONFIG_NAMES[MAIL_CONFIG_KEYS.region],
        dto.region,
      );
    }
    if (dto.fromAddress !== undefined) {
      await saveMailSetting(
        this.prisma,
        MAIL_CONFIG_KEYS.fromAddress,
        MAIL_CONFIG_NAMES[MAIL_CONFIG_KEYS.fromAddress],
        dto.fromAddress,
      );
    }
    if (dto.fromAlias !== undefined) {
      await saveMailSetting(
        this.prisma,
        MAIL_CONFIG_KEYS.fromAlias,
        MAIL_CONFIG_NAMES[MAIL_CONFIG_KEYS.fromAlias],
        dto.fromAlias,
      );
    }
    if (dto.templateCaptcha !== undefined) {
      await saveMailSetting(
        this.prisma,
        MAIL_CONFIG_KEYS.templateCaptcha,
        MAIL_CONFIG_NAMES[MAIL_CONFIG_KEYS.templateCaptcha],
        String(dto.templateCaptcha),
      );
    }
    if (dto.templateReminder !== undefined) {
      await saveMailSetting(
        this.prisma,
        MAIL_CONFIG_KEYS.templateReminder,
        MAIL_CONFIG_NAMES[MAIL_CONFIG_KEYS.templateReminder],
        String(dto.templateReminder),
      );
    }
    if (dto.templateWeekly !== undefined) {
      await saveMailSetting(
        this.prisma,
        MAIL_CONFIG_KEYS.templateWeekly,
        MAIL_CONFIG_NAMES[MAIL_CONFIG_KEYS.templateWeekly],
        String(dto.templateWeekly),
      );
    }
    return { __raw: true, data: null, message: '已保存' };
  }

  /** 发送测试邮件（用验证码模板发一条，验证凭证/模板/域名是否都配好）。 */
  @Post('test')
  @RequirePermissions('system:mail:edit')
  @OperationLog('邮件设置', '测试发信')
  async test(@Body() dto: TestMailDto): Promise<ResponseEnvelope<null>> {
    await this.mailService.sendTest(dto.to);
    return { __raw: true, data: null, message: `测试邮件已发送至 ${dto.to}` };
  }
}
