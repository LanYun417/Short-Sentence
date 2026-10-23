/**
 * 题库批量生成服务（每日定时 + 手动触发）。
 * 模块职责：把「生文（Agnes 2.5 Flash）→ 生图（Agnes）→ 转 webp 入库 → 置 ready」
 * 编排成可观测、可断点续跑的流水线。
 *
 * 关键设计：
 * - **进程内互斥**：同一时刻只跑一个批次（定时与手动触发不叠加、多 worker 不重复烧配额）；
 * - **断点续跑**：批次状态落 sentence_gen_task，重启后对未完成的批次继续执行；
 * - **幂等**：一天一批（biz_date 唯一），当天已有成功批次时拒绝再次触发；
 * - **限流**：生文信号量 + 指数退避重试；生图独立信号量（两者限流均未知，保守并发）；
 * - **部分失败不判整批失败**：有净增题目即算成功，失败数进 failCount 供运营补跑；
 * - **调度不在这里**：cron 由 TaskModule 的任务注册表统一注册（任务名 `sentence-gen`），
 *   本服务只暴露执行入口。早期版本在此处自行 addCronJob，结果后台「定时任务」页看不到它、
 *   执行记录也不进 sys_task_log——运维以为没配，其实在跑。
 */
import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { config } from '../../common/config/config.js';
import { AppException } from '../../common/exception/app.exception.js';
import { FileService } from '../../common/file/file.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AgnesSentenceProvider } from '../../common/ai/agnes-sentence.provider.js';
import { AgnesImageProvider } from '../../common/ai/agnes-image.provider.js';
import { Semaphore, withRetry } from '../../common/ai/concurrency.js';
import type { SentenceDraft } from '../../common/ai/ai.types.js';

/**
 * 单批生题的最大条数。
 *
 * 40 条时单次请求要让模型输出约 4k completion tokens，实测耗时 83~150s，
 * 逼近 180s 超时阈值（约 1/4 的批次直接超时并重试）；降到 20 条后单次约 40~70s，留足余量。
 */
const TEXT_CHUNK = 20;

/** 连续多少批零净增即停止（全部重复时的死循环保护）。 */
const MAX_EMPTY_CHUNKS = 3;

/** 连续多少批请求失败即放弃生题（已入库题目仍会继续生图，不会白跑）。 */
const MAX_FAILED_CHUNKS = 5;

/**
 * 配图风格后缀（统一追加到场景提示词末尾）。
 *
 * 产品定位是「视觉场景英语闪卡」，全站统一扁平卡通插画风格。
 * 在服务层统一追加而不是只靠模型输出的 scenePrompt：模型偶尔会写成写实/3D/照片风格，
 * 同一批题里混入不同画风会显得很乱，这里兜住风格下限。
 */
const IMAGE_STYLE_SUFFIX =
  'flat cartoon illustration style, clean vector art, soft cel shading, friendly characters, bright pastel colors, wide 16:9 composition, no text in image';

@Injectable()
export class SentenceGenService {
  private readonly logger = new Logger(SentenceGenService.name);
  /** 进程内互斥标志。 */
  private running = false;
  /**
   * 本批强制难度（1/2/3；null = 按自然分布）。
   * 只由手动触发指定，用于运营补某一档题目（例如「基础档数量不够」）。
   * 批次表没有这个字段，用进程内变量传递——`running` 已保证同时只有一批在跑。
   */
  private focusDifficulty: number | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sentenceGen: AgnesSentenceProvider,
    private readonly imageGen: AgnesImageProvider,
    private readonly fileService: FileService,
  ) {}

  /**
   * 定时触发入口（由 TaskModule 的 `sentence-gen` 任务调用）。
   * 与手动触发同一套心智模型，只是 triggerType 记 cron；今日已成功则直接跳过。
   */
  async runScheduled(): Promise<void> {
    if (this.running) {
      this.logger.warn('[SentenceGen] 已有批次在执行，本次定时触发跳过');
      return;
    }
    const bizDate = this.today();
    // 一天一批：今天已成功 → 跳过（重复触发只会重复消耗上游配额）
    const successToday = await this.prisma.sentenceGenTask.findFirst({
      where: { bizDate, status: 'success' },
      select: { id: true },
    });
    if (successToday) {
      return;
    }
    // 断点续跑：优先跑今天未完成的批次
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

  /**
   * 手动触发（管理端调试 / 补跑 / 补某一档题目用）。
   * @param count 本批目标题数
   * @param difficulty 强制本批全部为该难度（1/2/3；省略则按 40/40/20 自然分布）
   */
  async triggerManual(count?: number, difficulty?: number): Promise<{ taskId: number }> {
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
    this.focusDifficulty = difficulty ?? null;
    void this.execute(task.id);
    return { taskId: Number(task.id) };
  }

  /** 主执行体（fire-and-forget 调用；结果全部落在批次表）。 */
  private async execute(taskId: bigint): Promise<void> {
    this.running = true;
    const startedAt = new Date();
    let textDone = 0;
    let imageDone = 0;
    let failCount = 0;

    // 生图队列与生题**并行**推进：每批题目入库后立即排产配图，
    // 首批题在一两分钟内即可 ready，用户不必等 300 条题全部生成完
    // （否则首屏可用时间被拉长到十几分钟，期间前端一直显示「暂无可用题目」）。
    const imageSemaphore = new Semaphore(config.ai.imageConcurrency);
    const imageJobs: Promise<boolean>[] = [];
    const queuedIds = new Set<string>();
    const imageRetry = {
      // 生图上游（Agnes）限流恢复较慢：实测并发 6 会持续 429，退避必须比生题宽得多
      // （10s → 20s → 40s，累计约 70s），否则重试只是把 429 再打一遍。
      maxAttempts: Math.max(config.ai.maxAttempts, 4),
      baseDelayMs: 10_000,
      maxDelayMs: 120_000,
    };

    /** 把本批次尚未排队的待配图题目推入生图队列（非阻塞）。 */
    const enqueuePendingImages = async (): Promise<void> => {
      const pending = await this.prisma.sentence.findMany({
        where: { genTaskId: taskId, status: 'pending_image' },
        select: { id: true, scenePrompt: true },
      });
      for (const sentence of pending) {
        const key = String(sentence.id);
        if (queuedIds.has(key)) {
          continue;
        }
        queuedIds.add(key);
        imageJobs.push(imageSemaphore.run(() => this.generateImage(sentence, imageRetry)));
      }
    };

    /** 收尾：等待生图队列全部结束并汇总成功数。 */
    const drainImageQueue = async (): Promise<void> => {
      const results = await Promise.all(imageJobs);
      imageDone = results.filter(Boolean).length;
      failCount += results.length - imageDone;
    };

    try {
      const task = await this.prisma.sentenceGenTask.update({
        where: { id: taskId },
        data: { status: 'running', startedAt, errorMessage: null },
        select: { targetCount: true },
      });

      // ---------- 1. 生题（分批 + 信号量 + 重试；每批入库后立即排入生图） ----------
      const theme = await this.currentTheme();
      const textSemaphore = new Semaphore(config.ai.textConcurrency);
      const retry = {
        maxAttempts: config.ai.maxAttempts,
        baseDelayMs: 1000,
        maxDelayMs: 30_000,
      };
      let emptyChunks = 0;
      let failedChunks = 0;
      /** 审核阶段剔除的条数（未入库；单独统计，便于判断提示词是否过严） */
      let rejectedCount = 0;
      while (textDone < task.targetCount) {
        const need = Math.min(TEXT_CHUNK, task.targetCount - textDone);
        if (need <= 0) {
          break;
        }
        let drafts: SentenceDraft[] = [];
        try {
          drafts = await textSemaphore.run(() =>
            withRetry(() => this.sentenceGen.generateBatch(theme, need, this.focusDifficulty ?? undefined), retry),
          );
        } catch (error) {
          // 单批失败（多为上游超时）不中断整轮：计数后继续下一批。
          // 与「零净增」分开计数——请求超时并不代表题库重复，混用会误触发停止条件。
          failCount += 1;
          failedChunks += 1;
          this.logger.error(`[SentenceGen] 生题批次失败（还需 ${need} 条）: ${this.errText(error)}`);
          if (failedChunks >= MAX_FAILED_CHUNKS) {
            this.logger.warn(`[SentenceGen] 生题连续失败 ${failedChunks} 批，放弃继续生题，转入生图`);
            break;
          }
          continue;
        }
        failedChunks = 0;

        // ---------- 二阶段：优化（地道性 / 中文可读性 / 难度校准）----------
        // 失败降级为原稿：优化是「加分项」，挂掉不该让整批题目作废
        const polished = await this.runStage('优化', () => this.sentenceGen.polishBatch(drafts, theme), drafts);

        // ---------- 三阶段：审核（不通过的直接丢弃，不进生图）----------
        const reviewed = await this.runStage('审核', () => this.sentenceGen.reviewBatch(polished), {
          approved: polished,
          rejected: [] as Array<{ draft: SentenceDraft; reason: string }>,
        });
        if (reviewed.rejected.length > 0) {
          rejectedCount += reviewed.rejected.length;
          const sample = reviewed.rejected
            .slice(0, 3)
            .map((item) => `${item.draft.sentenceEn}（${item.reason}）`)
            .join('；');
          this.logger.warn(`[SentenceGen] 审核剔除 ${reviewed.rejected.length} 条，样例：${sample}`);
        }

        const inserted = await this.persistDrafts(reviewed.approved, taskId);
        textDone += inserted;
        await this.prisma.sentenceGenTask.update({ where: { id: taskId }, data: { textDone } });
        // 入库即排产：让生图与生题重叠
        await enqueuePendingImages();
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

      // ---------- 2. 生图收尾 ----------
      await drainImageQueue();

      // ---------- 3. 终态 ----------
      // 有净增题目或图片即算成功（部分失败进 failCount，供运营按补跑按钮处理）
      const ok = textDone > 0 || imageDone > 0;
      await this.prisma.sentenceGenTask.update({
        where: { id: taskId },
        data: {
          status: ok ? 'success' : 'failed',
          textDone,
          imageDone,
          // failCount 记「未入库条数」：调用失败 + 审核剔除（运营只看这个数字判断要不要补跑）
          failCount: failCount + rejectedCount,
          errorMessage: ok ? null : '本轮未产出任何题目（详见服务日志）',
          finishedAt: new Date(),
        },
      });
      this.logger.log(
        `[SentenceGen] 批次 ${taskId} 完成：题目 +${textDone}，图片 +${imageDone}，` +
          `调用失败 ${failCount}，审核剔除 ${rejectedCount}`,
      );
    } catch (error) {
      // 生题阶段整体异常（DB 抖动 / 意外抛出）也不能让已入库题目没有配图，
      // 否则整批白跑、前台始终无题可刷。
      const message = this.errText(error);
      this.logger.error(`[SentenceGen] 批次 ${taskId} 生题阶段异常: ${message}`);
      try {
        await enqueuePendingImages();
        await drainImageQueue();
      } catch (imageError) {
        this.logger.error(`[SentenceGen] 异常后的补救生图失败: ${this.errText(imageError)}`);
      }
      await this.prisma.sentenceGenTask
        .update({
          where: { id: taskId },
          data: {
            status: imageDone > 0 ? 'success' : 'failed',
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
      // 难度焦点只对当前批次有效，不能泄漏到下一次（含定时任务）
      this.focusDifficulty = null;
    }
  }

  /**
   * 跑一个可选阶段（优化 / 审核）。
   *
   * 失败时返回兜底值并记日志：二、三阶段分别是「加分项」与「把关」，挂掉不该让整批题目作废
   * ——降级而不中断。重试次数比生题少：这类失败多为上游超时，多试无益且会拖长整批时长。
   */
  private async runStage<T>(name: string, task: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await withRetry(task, { maxAttempts: 2, baseDelayMs: 2000, maxDelayMs: 10_000 });
    } catch (error) {
      this.logger.error(`[SentenceGen] ${name}阶段失败，已降级（本批按未处理继续）：${this.errText(error)}`);
      return fallback;
    }
  }

  /** 生成单题配图：生图 → 转 webp → 入库 → 置 ready（失败只记日志，不影响其它题）。 */
  private async generateImage(
    sentence: { id: bigint; scenePrompt: string },
    retry: { maxAttempts: number; baseDelayMs: number; maxDelayMs: number },
  ): Promise<boolean> {
    try {
      const image = await withRetry(
        () =>
          this.imageGen.generate(`${sentence.scenePrompt}, ${IMAGE_STYLE_SUFFIX}`, {
            size: config.sentence.imageSize,
            ratio: config.sentence.imageRatio,
          }),
        retry,
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
