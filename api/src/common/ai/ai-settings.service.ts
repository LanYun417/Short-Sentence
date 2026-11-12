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
import { loadAiSettings, saveAiModels, type AiSettings } from './ai.config.js';

@Injectable()
export class AiSettingsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AiSettingsService.name);

  /** 当前生效快照（初值为空列表，启动时 reload 会从库/环境变量填充）。 */
  private snapshot: AiSettings = { models: [] };

  constructor(private readonly prisma: PrismaService) {}

  /** 启动时从 sys_config 加载一次（老库自动迁移成模型列表）。 */
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
      const next = await loadAiSettings(this.prisma);
      // 一次性迁移写回：老库配置首次迁移后立刻落库，之后即以 ai.models 为准
      if (next.migrated && next.models.length > 0) {
        await saveAiModels(this.prisma, next.models);
        next.migrated = false;
      }
      this.snapshot = next;
    } catch (error) {
      this.logger.warn(`AI 配置加载失败，沿用上一次快照：${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
