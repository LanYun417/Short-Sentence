/**
 * AI 配置的运行时快照。
 *
 * 为什么需要缓存而不是每次读库：Provider 的 `enabled` 是**同步 getter**（任务调度与
 * 解析回填在同步判断里用它），不能 await 数据库。这里启动时读一次、后台保存后再刷新，
 * getter 读内存快照即可。
 *
 * 老库升级：首次加载发现仍是旧版单模型配置（`ai.agnes.*`）时，自动迁移成模型列表
 * 写入 `ai.models`，并删掉旧键——之后即以模型列表为准。
 */
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { clearLegacyAiConfig, loadAiSettings, saveAiModels, type AiSettings } from './ai.config.js';

@Injectable()
export class AiSettingsService implements OnModuleInit {
  private readonly logger = new Logger(AiSettingsService.name);

  /** 当前生效快照（初值为空列表，启动时 reload 会从库填充）。 */
  private snapshot: AiSettings = { models: [] };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 模块初始化阶段就从 sys_config 加载（老库自动迁移成模型列表）。
   *
   * 为什么必须赶在 `onApplicationBootstrap`：任务模块的「启动补跑」（接龙主题周更、
   * 每日句签等）也在启动期执行，若 AI 快照还没填好，补跑会统一报「能力未配置」
   * 而白跑一轮。onModuleInit 早于所有模块的 onApplicationBootstrap，稳。
   */
  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  /** 当前生效配置（同步读内存快照）。 */
  get current(): AiSettings {
    return this.snapshot;
  }

  /** 从 sys_config 重新加载；失败时保留旧快照（只告警，不影响服务启动）。 */
  async reload(): Promise<void> {
    try {
      const next = await loadAiSettings(this.prisma);
      // 一次性迁移：老库配置首次迁移后立刻落库为 ai.models，并删掉旧的 ai.agnes.* 键，
      // 之后即以 ai.models 为准（「参数管理」里不再残留旧版键）。
      if (next.migrated && next.models.length > 0) {
        await saveAiModels(this.prisma, next.models);
        await clearLegacyAiConfig(this.prisma);
        next.migrated = false;
      }
      this.snapshot = next;
    } catch (error) {
      this.logger.warn(`AI 配置加载失败，沿用上一次快照：${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
