/**
 * 支付配置运行时快照。
 * 模块职责：与 AiSettingsService 同一模式——Provider 需要**同步**判断「支付是否可用」，
 * 不能每次 await 数据库。启动时读一次，后台保存后再 reload，getter 读内存快照。
 */
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  isPayEnabled,
  loadPaySettings,
  savePaySettings,
  toPaySettingsView,
  type PaySettingsView,
  type PayWechatSettings,
} from './pay-settings.js';

/** 空配置（未配置 = 支付功能禁用）。 */
const EMPTY_SETTINGS: PayWechatSettings = {
  appId: '',
  mchId: '',
  serialNo: '',
  privateKey: '',
  apiv3Key: '',
  notifyUrl: '',
};

@Injectable()
export class PaySettingsService implements OnModuleInit {
  private readonly logger = new Logger(PaySettingsService.name);

  /** 当前生效快照（启动时由 onModuleInit 填充；空对象 = 未配置）。 */
  private snapshot: PayWechatSettings = { ...EMPTY_SETTINGS };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 模块初始化阶段从 sys_config 加载（早于所有 onApplicationBootstrap）。
   * 失败时保留空快照：支付未配置只是增值功能不可用，**不阻断服务启动**（与 AI 同一口径）。
   */
  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  /** 当前生效配置（同步读内存快照）。 */
  get current(): PayWechatSettings {
    return this.snapshot;
  }

  /** 支付是否已配置可用（六项齐全）。 */
  get enabled(): boolean {
    return isPayEnabled(this.snapshot);
  }

  /** 从 sys_config 重新加载；失败时保留旧快照并告警。 */
  async reload(): Promise<void> {
    try {
      this.snapshot = await loadPaySettings(this.prisma);
    } catch (error) {
      this.logger.warn(`支付配置加载失败，沿用上一次快照：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** 保存后重载（后台「支付设置」用）。 */
  async save(input: PayWechatSettings): Promise<void> {
    await savePaySettings(this.prisma, input);
    await this.reload();
  }

  /** 后台展示形态（密钥掩码，绝不回明文）。 */
  toView(): PaySettingsView {
    return toPaySettingsView(this.snapshot);
  }
}
