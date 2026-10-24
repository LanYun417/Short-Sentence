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
    // bizDate 唯一：今天已有批次就复用它，**绝不能新建**（否则唯一键冲突）
    const existing = await this.prisma.sentenceGenTask.findUnique({
      where: { bizDate },
      select: { id: true, status: true },
    });
    if (existing) {
      if (existing.status === 'paused') {
        // 运营主动暂停的批次，定时任务不该擅自续跑
        this.logger.log('[SentenceGen] 今日批次处于暂停状态，等运营手动继续');
        return;
      }
      if (['success', 'cancelled', 'running'].includes(existing.status)) {
        return;
      }
      // pending / failed：断点续跑
      void this.execute(existing.id);
      return;
    }
    const task = await this.prisma.sentenceGenTask.create({
      data: { bizDate, targetCount: config.sentence.dailyTarget, triggerType: 'cron', status: 'pending' },
      select: { id: true },
    });
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
    const existing = await this.prisma.sentenceGenTask.findUnique({
      where: { bizDate },
      select: { id: true, status: true },
    });
    if (existing?.status === 'success') {
      throw AppException.conflict('今日批次已成功完成，请勿重复触发');
    }
    if (existing?.status === 'cancelled') {
      // bizDate 唯一，取消的批次不删掉就再也建不了今天的批次——给出可执行的提示
      throw AppException.conflict('今日批次已取消，请先在「生成批次」里删除它再重新生成');
    }
    const target = Math.max(1, count ?? config.sentence.dailyTarget);
    const task = existing
      ? await this.prisma.sentenceGenTask.update({
          where: { id: existing.id },
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

  /* --------------------------- 运营控制：暂停 / 继续 / 取消 / 删除 --------------------------- */

  /**
   * 读取运营控制指令（暂停 / 取消）。
   * 读失败按「继续」处理——不能因为一次查询抖动把整批停掉；
   * 批次被删则按「取消」处理，避免继续往不存在的行上写。
   */
  private async controlOf(taskId: bigint): Promise<'run' | 'pause' | 'cancel'> {
    const row = await this.prisma.sentenceGenTask
      .findUnique({ where: { id: taskId }, select: { status: true } })
      .catch(() => null);
    if (!row) {
      return 'cancel';
    }
    if (row.status === 'paused') {
      return 'pause';
    }
    if (row.status === 'cancelled') {
      return 'cancel';
    }
    return 'run';
  }

  /**
   * 暂停：只落标记，实际在**下一个批次边界**停下（正在飞的模型请求不打断，否则白烧配额）。
   * 所以点击后最长要等一个批次（生题+优化+审核，约 1~2 分钟）才真正停。
   */
  async pause(id: number): Promise<void> {
    const task = await this.requireTask(id);
    if (task.status !== 'running' && task.status !== 'pending') {
      throw AppException.badRequest('只有进行中的批次可以暂停');
    }
    await this.prisma.sentenceGenTask.update({
      where: { id: BigInt(id) },
      data: { status: 'paused', lastHeartbeatAt: new Date() },
    });
  }

  /** 继续：接着跑已暂停 / 已失败的批次（计数器从批次表读回，不会重复生成）。 */
  async resume(id: number): Promise<void> {
    if (this.running) {
      throw AppException.conflict('已有批次在执行，请等它结束再继续');
    }
    const task = await this.requireTask(id);
    if (task.status !== 'paused' && task.status !== 'failed') {
      throw AppException.badRequest('只有已暂停 / 失败的批次可以继续');
    }
    // 先落 running 再起执行体：否则控制点可能读到残留的 paused，刚续跑就被再次暂停
    await this.prisma.sentenceGenTask.update({
      where: { id: BigInt(id) },
      data: { status: 'running', stage: 'generating', lastHeartbeatAt: new Date() },
    });
    void this.execute(BigInt(id));
  }

  /** 取消：同样在批次边界生效，终态 cancelled（之后可删除）。 */
  async cancel(id: number): Promise<void> {
    const task = await this.requireTask(id);
    if (task.status === 'success' || task.status === 'cancelled') {
      throw AppException.badRequest('该批次已结束');
    }
    await this.prisma.sentenceGenTask.update({
      where: { id: BigInt(id) },
      data: { status: 'cancelled', lastHeartbeatAt: new Date() },
    });
  }

  /**
   * 删除批次。
   *
   * 语义（按产品口径）：**不删已配图的题目**——它们是可用内容，只是不再挂在这条批次上；
   * 只清理「还没生成配图」的 pending_image 题（没有可用产出，留着只会变成无人处理的孤儿）。
   *
   * 只允许删终态批次（含已暂停）：运行中的批次循环还在 update 它，删了会报 record not found。
   */
  async remove(id: number): Promise<{ removedSentences: number }> {
    const task = await this.requireTask(id);
    if (!['success', 'failed', 'cancelled', 'paused'].includes(task.status)) {
      throw AppException.badRequest('批次正在执行，请先暂停或取消再删除');
    }
    const [pending] = await this.prisma.$transaction([
      this.prisma.sentence.deleteMany({ where: { genTaskId: BigInt(id), status: 'pending_image' } }),
      this.prisma.sentenceGenTask.delete({ where: { id: BigInt(id) } }),
    ]);
    this.logger.log(`[SentenceGen] 批次 ${id} 已删除，清理未配图题目 ${pending.count} 条`);
    return { removedSentences: pending.count };
  }

  /** 取批次（不存在则 404）。 */
  private async requireTask(id: number): Promise<{ status: string }> {
    const task = await this.prisma.sentenceGenTask.findUnique({
      where: { id: BigInt(id) },
      select: { status: true },
    });
    if (!task) {
      throw AppException.notFound('批次不存在');
    }
    return task;
  }

  /**
   * 主执行体（fire-and-forget 调用；结果全部落在批次表）。
   *
   * 支持「继续」：计数器从批次表**读回来接着数**。否则续跑会从 0 重新生成一遍
   * ——唯一键虽然会去重，但白烧上游配额，而且永远到不了目标数。
   */
  private async execute(taskId: bigint): Promise<void> {
    this.running = true;
    const resumed = await this.prisma.sentenceGenTask.findUnique({
      where: { id: taskId },
      select: { targetCount: true, textDone: true, imageDone: true, failCount: true, startedAt: true },
    });
    if (!resumed) {
      // 批次已被删除：直接退出，别再往不存在的行上写
      this.running = false;
      return;
    }
    const startedAt = resumed.startedAt ?? new Date();
    let textDone = resumed.textDone;
    let imageDone = resumed.imageDone;
    let failCount = resumed.failCount;

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
        imageJobs.push(imageSemaphore.run(() => this.generateImage(sentence, imageRetry, taskId)));
      }
    };

    /** 收尾：等待生图队列全部结束并汇总成功数（累加，兼容「继续」时的已有计数）。 */
    const drainImageQueue = async (): Promise<void> => {
      const results = await Promise.all(imageJobs);
      const okCount = results.filter(Boolean).length;
      imageDone += okCount;
      failCount += results.length - okCount;
    };

    try {
      const task = await this.prisma.sentenceGenTask.update({
        where: { id: taskId },
        data: { status: 'running', stage: 'generating', startedAt, lastHeartbeatAt: startedAt, errorMessage: null },
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
      /** 运营控制指令（每轮循环开头读一次）。 */
      let control: 'run' | 'pause' | 'cancel' = 'run';
      /** 审核阶段剔除的条数（未入库；单独统计，便于判断提示词是否过严） */
      let rejectedCount = 0;

      // 续跑（继续 / 失败重跑）时可能还有上次没排产的待配图题目：
      // 若文字已达标、循环一次都不进，这里不补排就永远不会有图。
      await enqueuePendingImages();

      while (textDone < task.targetCount) {
        // 控制点：暂停 / 取消只在这里生效。
        // 不硬中断正在飞的上游请求（那会白烧配额），等当前批次跑完再停。
        control = await this.controlOf(taskId);
        if (control !== 'run') {
          this.logger.log(
            `[SentenceGen] 批次 ${taskId} 收到${control === 'pause' ? '暂停' : '取消'}指令，在批次边界停止`,
          );
          break;
        }
        const need = Math.min(TEXT_CHUNK, task.targetCount - textDone);
        if (need <= 0) {
          break;
        }
        let drafts: SentenceDraft[] = [];
        try {
          drafts = await textSemaphore.run(() =>
            withRetry(
              () => this.sentenceGen.generateBatch(theme, need, this.focusDifficulty ?? undefined, Number(taskId)),
              retry,
            ),
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
        await this.heartbeat(taskId, 'polishing');
        const polished = await this.runStage(
          '优化',
          () => this.sentenceGen.polishBatch(drafts, theme, Number(taskId)),
          drafts,
        );

        // ---------- 三阶段：审核（不通过的直接丢弃，不进生图）----------
        await this.heartbeat(taskId, 'reviewing');
        // 审核阶段本身失败时**整批丢弃**（fail-closed）：宁可这一批不要，
        // 也不让没审过的题进库——过去 fallback 是「全部放行」，等于审核形同虚设。
        const reviewed = await this.runStage('审核', () => this.sentenceGen.reviewBatch(polished, Number(taskId)), {
          approved: [] as SentenceDraft[],
          rejected: polished.map((draft) => ({ draft, reason: '审核阶段调用失败，整批丢弃' })),
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
        // 计数器与心跳一起更新：前端每 3s 轮询，看到心跳就不再判断「卡住」
        await this.prisma.sentenceGenTask.update({
          where: { id: taskId },
          data: { textDone, lastHeartbeatAt: new Date() },
        });
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
      await this.heartbeat(taskId, 'imaging');
      await drainImageQueue();

      // ---------- 3. 终态 ----------
      // 暂停 / 取消：保留已有产出（已入库的题与已生成的图都不回滚），状态如实落库
      if (control !== 'run') {
        await this.prisma.sentenceGenTask.update({
          where: { id: taskId },
          data: {
            status: control === 'pause' ? 'paused' : 'cancelled',
            stage: 'done',
            lastHeartbeatAt: new Date(),
            textDone,
            imageDone,
            failCount: failCount + rejectedCount,
            finishedAt: new Date(),
          },
        });
        this.logger.log(
          `[SentenceGen] 批次 ${taskId} 已${control === 'pause' ? '暂停' : '取消'}：题目 ${textDone}，图片 ${imageDone}`,
        );
        return;
      }

      // 有净增题目或图片即算成功（部分失败进 failCount，供运营按补跑按钮处理）
      const ok = textDone > 0 || imageDone > 0;
      await this.prisma.sentenceGenTask.update({
        where: { id: taskId },
        data: {
          status: ok ? 'success' : 'failed',
          stage: 'done',
          lastHeartbeatAt: new Date(),
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
   * 失败时返回调用方给的兜底值并记日志——**兜底值由阶段自己决定**：
   * - 优化是「加分项」：失败就退回原稿，不该让整批作废；
   * - 审核是「把关」：失败必须**整批丢弃**（fail-closed），不能放行没审过的题。
   *
   * 重试次数比生题少：这类失败多为上游超时，多试无益且会拖长整批时长。
   */
  private async runStage<T>(name: string, task: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await withRetry(task, { maxAttempts: 2, baseDelayMs: 2000, maxDelayMs: 10_000 });
    } catch (error) {
      this.logger.error(`[SentenceGen] ${name}阶段失败，已降级（本批按未处理继续）：${this.errText(error)}`);
      return fallback;
    }
  }

  /**
   * 上报阶段 / 心跳。
   *
   * 为什么需要：批次表原来只有三个计数器，且**每批 20 条完成才更新一次**，
   * 中间 40~70s 的模型请求期间前端数字完全不动——运营无法区分「在跑」和「卡死」。
   * 这里在每次阶段切换与每张图完成时更新 lastHeartbeatAt，前端据此显示「N 秒前有心跳」。
   *
   * 生图与生题是并行的：生图只碰 lastHeartbeatAt、不传 stage，否则会把文字阶段覆盖成 imaging。
   */
  private async heartbeat(taskId: bigint, stage?: string): Promise<void> {
    await this.prisma.sentenceGenTask
      .update({
        where: { id: taskId },
        data: stage ? { stage, lastHeartbeatAt: new Date() } : { lastHeartbeatAt: new Date() },
      })
      // 心跳失败不该影响整批生成
      .catch(() => undefined);
  }

  /** 生成单题配图：生图 → 转 webp → 入库 → 置 ready（失败只记日志，不影响其它题）。 */
  private async generateImage(
    sentence: { id: bigint; scenePrompt: string },
    retry: { maxAttempts: number; baseDelayMs: number; maxDelayMs: number },
    taskId: bigint,
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
      await this.heartbeat(taskId);
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
      // 英文为空 / 中文释义为空都直接丢弃：
      // 过去中文缺失时用 `draft.translationZh || draft.sentenceEn` 兜底，
      // 结果「中文释义」字段里会显示一句英文（2026-10-24 发现的数据质量漏洞）。
      .filter((draft) => draft.sentenceEn.trim().length > 0 && draft.translationZh.trim().length > 0)
      .map((draft) => {
        const categoryId = byName.get(draft.categoryName) ?? fallbackCategoryId;
        const scenePrompt =
          draft.scenePrompt.trim().length > 0 ? draft.scenePrompt : this.defaultScenePrompt(draft.sentenceEn);
        return {
          categoryId,
          difficulty: Math.min(3, Math.max(1, draft.difficulty || 2)),
          sentenceEn: draft.sentenceEn.trim(),
          // 备用答案落库为 JSON 字符串（判定时解析）；没有等价表达时留 null
          alternateAnswers:
            draft.alternateAnswers && draft.alternateAnswers.length > 0 ? JSON.stringify(draft.alternateAnswers) : null,
          translationZh: draft.translationZh.trim(),
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
