/**
 * 定时任务模块。
 * 模块职责：提供定时任务的注册、调度、执行与执行记录查询。
 *
 * 依赖说明：
 * - ScheduleModule 已在 AppModule 里 `forRoot()`（全局模块），SchedulerRegistry 随处可注入；
 * - FileLoggerService / ImageScaleService 由 CommonModule（全局）提供；
 * - PrismaService 由 PrismaModule（全局）提供。
 */
import { Module } from '@nestjs/common';
import { TaskController } from './task.controller.js';
import { TaskService } from './task.service.js';
import { SentenceModule } from '../sentence/sentence.module.js';
import { WordRootModule } from '../client/word-root/word-root.module.js';
import { CollectibleModule } from '../client/collectible/collectible.module.js';

@Module({
  // SentenceModule：把「短句题库生成」并入本模块的任务注册表，
  // 使其出现在管理端定时任务页并记录执行日志（此前它在 SentenceGenService 里自建 cron，页面上看不到）
  // WordRootModule：词根词典每日入库
  // CollectibleModule：每日藏品 AI 生成
  imports: [SentenceModule, WordRootModule, CollectibleModule],
  controllers: [TaskController],
  providers: [TaskService],
})
export class TaskModule {}
