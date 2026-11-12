/**
 * AI 配置的运行时快照。
 *
 * 为什么需要缓存而不是每次读库：Provider 的 `enabled` 是**同步 getter**（任务调度与
 * 解析回填在同步判断里用它），不能 await 数据库。这里启动时读一次、后台保存后再刷新，
 * getter 读内存快照即可。
 *
 * 未加载 / 读库失败时先用环境变量兜底，保证行为与旧版（纯 env）一致，不会把服务打挂。
 */
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { config } from '../config/config.js';
import { loadAiSettings, type AiSettings } from './ai.config.js';
import { DEFAULT_ADVANCED } from './ai-protocol.js';

@Injectable()
export class AiSettingsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AiSettingsService.name);

  /** 当前生效快照（初值取环境变量，保证首次访问即有值）。 */
  private snapshot: AiSettings = {
    apiKey: config.ai.agnes.apiKey,
    baseUrl: config.ai.agnes.baseUrl.replace(/\/+$/, ''),
    textModel: config.ai.agnes.textModel,
    imageModel: config.ai.agnes.imageModel,
    nimBaseUrl: config.ai.agnes.nimBaseUrl.replace(/\/+$/, ''),
    nimApiKey: config.ai.agnes.nimApiKey,
    nimModel: config.ai.agnes.nimModel,
    genChannel: config.ai.agnes.genChannel,
    apiFormat: 'openai_chat',
    fullUrl: false,
    modelLabel: '',
    advanced: { ...DEFAULT_ADVANCED },
  };

  constructor(private readonly prisma: PrismaService) {}

  /** 启动时从 sys_config 加载一次（种子已写入内置参数，此时库可用）。 */
  async onApplicationBootstrap(): Promise<void> {
    await this.reload();
  }

  /** 当前生效配置（同步读内存快照）。 */
  get current(): AiSettings {
    return this.snapshot;
  }

  /** 从 sys_config 重新加载；失败时保留旧快照（只告警，不影响服务启动）。 */
  async reload(): Promise<void> {
    try {
      this.snapshot = await loadAiSettings(this.prisma);
    } catch (error) {
      this.logger.warn(
        `AI 配置加载失败，沿用环境变量/上一次快照：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
