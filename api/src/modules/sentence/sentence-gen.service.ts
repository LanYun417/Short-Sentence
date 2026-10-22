/**
 * 题库批量生成服务（每日 Cron + 手动触发）。
 * 模块职责：把「生题（DeepSeek）→ 生图（Agnes）→ 转 webp 入库 → 置 ready」
 * 编排成可观测、可断点续跑的流水线。
 *
 * 关键设计：
 * - **进程内互斥**：同一时刻只跑一个批次（cron 与手动触发不叠加、多 worker 不重复烧配额）；
 * - **断点续跑**：批次状态落 sentence_gen_task，重启后对未完成的批次继续执行；
 * - **幂等**：一天一批（biz_date 唯一），当天已有成功批次时拒绝再次触发；
 * - **限流**：生题信号量 + 指数退避重试（NVIDIA 约 40 RPM）；生图独立信号量（Agnes 限流未知）；
 * - **部分失败不判整批失败**：有净增题目即算成功，失败数进 failCount 供运营补跑。
 */
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import sharp from 'sharp';
import { config } from '../../common/config/config.js';
import { AppException } from '../../common/exception/app.exception.js';
import { FileService } from '../../common/file/file.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { DeepSeekSentenceProvider } from '../../common/ai/deepseek-sentence.provider.js';
import { AgnesImageProvider } from '../../common/ai/agnes-image.provider.js';
import { Semaphore, withRetry } from '../../common/ai/concurrency.js';
import type { SentenceDraft } from '../../common/ai/ai.types.js';

/** 单批生题的最大条数（单次输出过长会被截断，300 条必须分批要）。 */
const TEXT_CHUNK = 40;

/** 连续多少批零净增即停止（全部重复时的死循环保护）。 */
const MAX_EMPTY_CHUNKS = 3;

/** cron 任务名（SchedulerRegistry 键）。 */
const CRON_JOB_NAME = 'sentence-daily-gen';

@Injectable()
export class SentenceGenService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SentenceGenService.name);
  /** 进程内互斥标志。 */
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly sentenceGen: DeepSeekSentenceProvider,
    private readonly imageGen: AgnesImageProvider,
    private readonly fileService: FileService,
  ) {}

  /** 注册每日生成任务（配置驱动的动态 cron，不能用 @Cron 装饰器）。 */
  onModuleInit(): void {
    if (!config.sentence.cronEnabled) {
      this.logger.warn('[SentenceGen] 每日生成已停用（SENTENCE_CRON_ENABLED=false）');
      return;
    }
    const cron = `0 ${config.sentence.cronMinute} ${config.sentence.cronHour} * * *`;
    const job = CronJob.from({
      cronTime: cron,
      onTick: () => {
        void this.triggerCron();
      },
      start: true,
      name: CRON_JOB_NAME,
      // 慢任务执行完才允许下一次触发（300 题生图可能跨小时）
      waitForCompletion: true,
    });
    this.schedulerRegistry.addCronJob(CRON_JOB_NAME, job);
    this.logger.log(`[SentenceGen] 已注册每日生成任务（目标 ${config.sentence.dailyTarget} 题，cron: ${cron}）`);
  }

  onModuleDestroy(): void {
    if (this.schedulerRegistry.doesExist('cron', CRON_JOB_NAME)) {
      this.schedulerRegistry.deleteCronJob(CRON_JOB_NAME);
    }
  }

  /** 手动触发（管理端调试/补跑用）。 */
  async triggerManual(count?: number): Promise<{ taskId: number }> {
    if (this.running) {
      throw AppException.conflict('生成任务正在进行中，请稍后查看批次进度');
    }
    const bizDate = this.today();
    // 一天一批：今天已成功 → 拒绝（重复触发只会重复消耗上游配额）
    const successToday = await this.prisma.sentenceGenTask.findFirst({
      where: { bizDate, status: 'success' },
      select: { id: true },
    });
    if (successToday) {
      throw AppException.conflict('今日批次已成功完成，请勿重复触发');
    }
    // 断点续跑：优先跑今天未完成的批次
    const unfinished = await this.prisma.sentenceGenTask.findFirst({
      where: { bizDate, status: { in: ['pending', 'running', 'failed'] } },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    const target = Math.max(1, count ?? config.sentence.dailyTarget);
    const task = unfinished
      ? await this.prisma.sentenceGenTask.update({
          where: { id: unfinished.id },
          data: { targetCount: target, triggerType: 'manual' },
          select: { id: true },
        })
      : await this.prisma.sentenceGenTask.create({
          data: { bizDate, targetCount: target, triggerType: 'manual', status: 'pending' },
          select: { id: true },
        });
    void this.execute(task.id);
    return { taskId: Number(task.id) };
  }

  /** cron 自动触发（同手动的心智模型，只是 triggerType 不同）。 */
  private async triggerCron(): Promise<void> {
    if (this.running) {
      this.logger.warn('[SentenceGen] 已有批次在执行，本次 cron 触发跳过');
      return;
    }
    const bizDate = this.today();
    const successToday = await this.prisma.sentenceGenTask.findFirst({
      where: { bizDate, status: 'success' },
      select: { id: true },
    });
    if (successToday) {
      return;
    }
    const unfinished = await this.prisma.sentenceGenTask.findFirst({
      where: { bizDate, status: { in: ['pending', 'running', 'failed'] } },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    const task =
      unfinished ??
      (await this.prisma.sentenceGenTask.create({
        data: { bizDate, targetCount: config.sentence.dailyTarget, triggerType: 'cron', status: 'pending' },
        select: { id: true },
      }));
    void this.execute(task.id);
  }

  /** 主执行体（fire-and-forget 调用；结果全部落在批次表）。 */
  private async execute(taskId: bigint): Promise<void> {
    this.running = true;
    const startedAt = new Date();
    let textDone = 0;
    let imageDone = 0;
    let failCount = 0;

    try {
      const task = await this.prisma.sentenceGenTask.update({
        where: { id: taskId },
        data: { status: 'running', startedAt, errorMessage: null },
        select: { targetCount: true },
      });

      // ---------- 1. 生题（分批 + 信号量 + 重试） ----------
      const theme = await this.currentTheme();
      const textSemaphore = new Semaphore(config.ai.textConcurrency);
      const retry = {
        maxAttempts: config.ai.maxAttempts,
        baseDelayMs: 1000,
        maxDelayMs: 30_000,
      };
      let emptyChunks = 0;
      while (textDone < task.targetCount) {
        const need = Math.min(TEXT_CHUNK, task.targetCount - textDone);
        if (need <= 0) {
          break;
        }
        let drafts: SentenceDraft[] = [];
        try {
          drafts = await textSemaphore.run(() => withRetry(() => this.sentenceGen.generateBatch(theme, need), retry));
        } catch (error) {
          // 单批失败不中断整轮：计数后继续下一批（上游限流时的常见形态）
          failCount += 1;
          this.logger.error(`[SentenceGen] 生题批次失败（还需 ${need} 条）: ${this.errText(error)}`);
          emptyChunks += 1;
          if (emptyChunks >= MAX_EMPTY_CHUNKS) {
            throw error;
          }
          continue;
        }
        const inserted = await this.persistDrafts(drafts, taskId);
        textDone += inserted;
        await this.prisma.sentenceGenTask.update({ where: { id: taskId }, data: { textDone } });
        if (inserted === 0) {
          emptyChunks += 1;
          if (emptyChunks >= MAX_EMPTY_CHUNKS) {
            this.logger.warn('[SentenceGen] 连续多批零净增（疑似全部重复），停止生题');
            break;
          }
        } else {
          emptyChunks = 0;
        }
      }

      // ---------- 2. 生图（信号量 + 重试 + webp + 入库） ----------
      const pending = await this.prisma.sentence.findMany({
        where: { genTaskId: taskId, status: 'pending_image' },
        select: { id: true, scenePrompt: true },
      });
      const imageSemaphore = new Semaphore(config.ai.imageConcurrency);
      const imageRetry = { ...retry, baseDelayMs: 2000 };
      const results = await Promise.all(
        pending.map((sentence) =>
          imageSemaphore.run(async () => {
            try {
              const image = await withRetry(
                () =>
                  this.imageGen.generate(sentence.scenePrompt, {
                    size: config.sentence.imageSize,
                    ratio: config.sentence.imageRatio,
                  }),
                imageRetry,
              );
              const webp = await sharp(image.buffer)
                .resize({ width: config.sentence.imageMaxWidth, withoutEnlargement: true })
                .webp({ quality: config.sentence.imageQuality })
                .toBuffer();
              const saved = await this.fileService.save(`${Number(sentence.id)}.webp`, 'image/webp', webp, null);
              await this.prisma.sentence.update({
                where: { id: sentence.id },
                data: { imageFileId: BigInt(saved.file.id), status: 'ready' },
              });
              return true;
            } catch (error) {
              this.logger.error(`[SentenceGen] 生图失败（sentence ${sentence.id}）: ${this.errText(error)}`);
              return false;
            }
          }),
        ),
      );
      imageDone = results.filter(Boolean).length;
      failCount += results.length - imageDone;

      // ---------- 3. 终态 ----------
      // 有净增题目或图片即算成功（部分失败进 failCount，供运营按补跑按钮处理）
      const ok = textDone > 0 || imageDone > 0;
      await this.prisma.sentenceGenTask.update({
        where: { id: taskId },
        data: {
          status: ok ? 'success' : 'failed',
          textDone,
          imageDone,
          failCount,
          errorMessage: ok ? null : '本轮未产出任何题目（详见服务日志）',
          finishedAt: new Date(),
        },
      });
      this.logger.log(`[SentenceGen] 批次 ${taskId} 完成：题目 +${textDone}，图片 +${imageDone}，失败 ${failCount}`);
    } catch (error) {
      const message = this.errText(error);
      this.logger.error(`[SentenceGen] 批次 ${taskId} 整体失败: ${message}`);
      await this.prisma.sentenceGenTask
        .update({
          where: { id: taskId },
          data: {
            status: 'failed',
            textDone,
            imageDone,
            failCount: failCount + 1,
            errorMessage: message.slice(0, 500),
            finishedAt: new Date(),
          },
        })
        .catch(() => undefined);
    } finally {
      this.running = false;
    }
  }

  /** 生题入库（按 sentenceEn 唯一约束去重；返回净增条数）。 */
  private async persistDrafts(drafts: SentenceDraft[], taskId: bigint): Promise<number> {
    if (drafts.length === 0) {
      return 0;
    }
    const categories = await this.prisma.sentenceCategory.findMany({
      where: { status: 1 },
      select: { id: true, name: true },
      orderBy: { sort: 'asc' },
    });
    const fallbackCategoryId = categories[0]?.id ?? 0n;
    const byName = new Map(categories.map((category) => [category.name, category.id]));

    const seen = new Set<string>();
    const rows = drafts
      .filter((draft) => draft.sentenceEn.trim().length > 0)
      .map((draft) => {
        const categoryId = byName.get(draft.categoryName) ?? fallbackCategoryId;
        const scenePrompt =
          draft.scenePrompt.trim().length > 0 ? draft.scenePrompt : this.defaultScenePrompt(draft.sentenceEn);
        return {
          categoryId,
          difficulty: Math.min(3, Math.max(1, draft.difficulty || 2)),
          sentenceEn: draft.sentenceEn.trim(),
          translationZh: draft.translationZh || draft.sentenceEn,
          ipa: draft.ipa || null,
          scenePrompt: scenePrompt.slice(0, 500),
          source: 'ai',
          status: 'pending_image',
          genTaskId: taskId,
        };
      })
      // 批内去重（模型偶发重复）
      .filter((row) => {
        if (seen.has(row.sentenceEn)) {
          return false;
        }
        seen.add(row.sentenceEn);
        return true;
      });

    if (rows.length === 0 || !fallbackCategoryId) {
      return 0;
    }
    const result = await this.prisma.sentence.createMany({
      data: rows,
      // MySQL 下 createMany 不支持 skipDuplicates 之外的柔性去重；唯一键冲突的行会被跳过
      skipDuplicates: true,
    });
    return result.count;
  }

  /** 当日主题（启用的分类名拼接，让模型在既有分类内产出）。 */
  private async currentTheme(): Promise<string> {
    const categories = await this.prisma.sentenceCategory.findMany({
      where: { status: 1 },
      select: { name: true },
      orderBy: { sort: 'asc' },
    });
    return categories.length > 0 ? categories.map((category) => category.name).join('、') : '日常生活';
  }

  /** 无提示词时的兜底构图（两人对话场景）。 */
  private defaultScenePrompt(sentenceEn: string): string {
    return `Two people having a natural conversation in an everyday setting, one of them saying "${sentenceEn.slice(0, 120)}", warm natural light, 16:9 composition, no text in image`;
  }

  /** 本地时区今天（YYYY-MM-DD）。 */
  private today(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  /** 错误对象 → 单行文本。 */
  private errText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
