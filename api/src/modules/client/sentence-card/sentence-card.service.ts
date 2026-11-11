/**
 * 每日句签服务（客户端 + 定时生成）。
 * 模块职责：
 * - 每日定时 AI 生成一张精美句签（文案 + 生图 → webp 入库），bizDate 唯一即幂等；
 * - 用户完成每日目标后领取当日句签（userId + sentenceCardId 唯一即幂等）；
 * - 查询用户已获得的句签列表。
 *
 * 设计红线（与产品「轻量、正反馈、不焦虑」一致）：
 * 领取只增不减、幂等；未达标返回 null（不报错、不惩罚）；句签与题库配图同一存储链路。
 */
import { Injectable, Logger } from '@nestjs/common';
import { normalizeGeneratedImage } from '../../../common/ai/image-normalize.js';
import { AppException } from '../../../common/exception/app.exception.js';
import { dayContextOf, parseDateKey } from '../../../common/calendar/day-context.js';
import { config } from '../../../common/config/config.js';
import { FileService } from '../../../common/file/file.service.js';
import { AgnesImageProvider } from '../../../common/ai/agnes-image.provider.js';
import { AgnesSentenceProvider } from '../../../common/ai/agnes-sentence.provider.js';
import { withRetry } from '../../../common/ai/concurrency.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { IMAGE_2D_HARD_STYLE } from '../../../common/ai/image-style.js';

/** 句签生图画风（唯美治愈系，区别于题库的两人对话卡通），末尾统一拼 2D 硬约束。 */
export const SENTENCE_CARD_STYLE_SUFFIX =
  'dreamy healing flat illustration, soft pastel palette with flat watercolor-style color washes, ' +
  'serene atmosphere, wide 16:9 composition, no text in image, ' +
  IMAGE_2D_HARD_STYLE;

/** 「未拥有」列表容量上限：句签按天累积，一年就是 365 张，不能一次全塞给前端。 */
const MISSING_CARD_LIMIT = 60;

/** 句签视图（客户端）。 */
export interface SentenceCardView {
  id: number;
  bizDate: string;
  title: string;
  titleZh: string;
  sentenceEn: string;
  translationZh: string;
  /** 寄语（这张卡独有的一句；老卡片可能为空，前端有兜底） */
  blessing: string;
  imageUrl: string | null;
  /** 获得时间（ISO；未领取为 null） */
  obtainedAt: string | null;
}

/** 未拥有的句签（总数 + 最近一批）。 */
export interface MissingSentenceCards {
  /** 未拥有总数（可能大于 list.length） */
  total: number;
  /** 最近的未拥有句签（按业务日期倒序，容量见 MISSING_CARD_LIMIT） */
  list: SentenceCardView[];
}

@Injectable()
export class SentenceCardService {
  private readonly logger = new Logger(SentenceCardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly themeGen: AgnesSentenceProvider,
    private readonly imageGen: AgnesImageProvider,
    private readonly fileService: FileService,
  ) {}

  /**
   * 生成今日句签（幂等：当天已 ready 则跳过）。供定时任务调用。
   * 失败会落一条 status=failed 记录并抛出（任务日志记为失败），便于排查与手动重试。
   */
  async generateDaily(): Promise<void> {
    await this.generateForDate(this.today());
  }

  /**
   * 生成指定日期的句签（幂等：该日期已 ready 则跳过）。
   *
   * 抽出来供运营后台复用：后台要能重生成**任意日期**的卡片，也要能强制覆盖已就绪的
   * （文案不满意时换一张），这两件事都不是定时任务会做的。
   *
   * @param bizDate 业务日期 YYYY-MM-DD
   * @param force true 时即使已就绪也重新生成
   * @returns 是否实际生成（false = 已就绪被跳过）
   */
  async generateForDate(bizDate: string, force = false): Promise<boolean> {
    const existing = await this.prisma.dailySentenceCard.findUnique({
      where: { bizDate },
      select: { id: true, status: true },
    });
    if (!force && existing?.status === 'ready') {
      this.logger.log(`[SentenceCard] ${bizDate} 句签已就绪，跳过`);
      return false;
    }

    try {
      // 1) AI 文案（主题 + 短句 + 生图提示词）
      // 取最近 7 张已就绪卡片喂给模型做去重：不传历史，模型只能凭运气避开，
      // 实测会连续多天收敛到同一主题（曾 4 天全是「静谧」）。
      const recentCards = await this.prisma.dailySentenceCard.findMany({
        where: { bizDate: { lt: bizDate }, status: 'ready' },
        orderBy: { bizDate: 'desc' },
        take: 7,
        select: {
          title: true,
          titleZh: true,
          sentenceEn: true,
          translationZh: true,
          scenePrompt: true,
          blessing: true,
        },
      });
      // 当天语境：节日/节气命中时按对应风格生成，否则走随机维度。
      // 优先级在 dayContextOf 里已定（节日 > 节气 > 普通日）。
      const context = dayContextOf(parseDateKey(bizDate));
      if (context.kind !== 'ordinary') {
        this.logger.log(
          `[SentenceCard] ${bizDate} 命中${context.kind === 'festival' ? '节日' : '节气'}：${context.name}`,
        );
      }
      const theme = await withRetry(() => this.themeGen.generateSentenceCardTheme(bizDate, recentCards, context), {
        maxAttempts: 3,
        baseDelayMs: 3000,
        maxDelayMs: 20000,
      });
      // 2) AI 生图 → webp
      const image = await withRetry(
        () =>
          this.imageGen.generate(`${theme.scenePrompt}, ${SENTENCE_CARD_STYLE_SUFFIX}`, {
            size: config.sentence.imageSize,
            ratio: config.sentence.imageRatio,
          }),
        { maxAttempts: 4, baseDelayMs: 5000, maxDelayMs: 30000 },
      );
      const webp = await normalizeGeneratedImage(image.buffer, {
        maxWidth: config.sentence.imageMaxWidth,
        ratio: config.sentence.imageRatio,
        quality: config.sentence.imageQuality,
      });
      const saved = await this.fileService.save(`sentence-card-${bizDate}.webp`, 'image/webp', webp, null);

      // 3) 入库（bizDate 唯一 → upsert，重复触发覆盖为最新成功结果）
      const data = {
        title: theme.title,
        titleZh: theme.titleZh || theme.title,
        sentenceEn: theme.sentenceEn,
        translationZh: theme.translationZh,
        blessing: theme.blessing,
        scenePrompt: theme.scenePrompt,
        imageFileId: BigInt(saved.file.id),
        status: 'ready',
      };
      await this.prisma.dailySentenceCard.upsert({
        where: { bizDate },
        create: { bizDate, ...data },
        update: data,
      });
      this.logger.log(`[SentenceCard] ${bizDate} 句签生成完成：${theme.title}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[SentenceCard] ${bizDate} 句签生成失败：${message}`);
      // 落一条 failed 记录（便于运营排查 / 手动重试）；记录失败不影响向上抛出
      await this.prisma.dailySentenceCard
        .upsert({
          where: { bizDate },
          create: {
            bizDate,
            title: '',
            titleZh: '',
            sentenceEn: '',
            translationZh: '',
            blessing: '',
            scenePrompt: '',
            status: 'failed',
          },
          update: { status: 'failed' },
        })
        .catch(() => undefined);
      throw error;
    }
  }

  /** 领取今日句签（幂等；未完成每日目标或今日句签未就绪则返回 null）。 */
  async claimToday(userId: number): Promise<SentenceCardView | null> {
    const bizDate = this.today();
    // 1) 校验今日目标是否完成
    const checkin = await this.prisma.userCheckin.findUnique({
      where: { userId_checkinDate: { userId: BigInt(userId), checkinDate: bizDate } },
      select: { doneCount: true, goalCount: true },
    });
    if (!checkin || checkin.goalCount <= 0 || checkin.doneCount < checkin.goalCount) {
      return null;
    }
    // 2) 今日句签须就绪
    const card = await this.prisma.dailySentenceCard.findUnique({ where: { bizDate } });
    if (!card || card.status !== 'ready') {
      return null;
    }
    // 3) 幂等领取（userId + sentenceCardId 唯一）
    const grant = await this.prisma.userSentenceCard.upsert({
      where: {
        userId_sentenceCardId: { userId: BigInt(userId), sentenceCardId: card.id },
      },
      create: { userId: BigInt(userId), sentenceCardId: card.id },
      update: {},
      select: { obtainedAt: true },
    });
    const imageUrl = await this.imageUrlOf(card.imageFileId);
    return this.toView(card, grant.obtainedAt, imageUrl);
  }

  /**
   * 补发过往漏领的句签（运营后台用）。
   *
   * 「漏签」= 用户某天已完成每日目标（doneCount >= goalCount）却没能领到当天句签——
   * 典型场景：当日句签生成失败 / 用户当天没打开 App / 达标后接口失败。
   * 规则：历史达标日 × 当天句签已就绪 − 已拥有 = 本次补发范围。
   *
   * 幂等：先按 (userId, sentenceCardId) 过滤掉已拥有的，再 createMany + skipDuplicates
   * 双保险（唯一键兜底并发），重复调用不会重复发、也不会多发。
   */
  async backfillMissed(userId: number): Promise<{ granted: number; bizDates: string[] }> {
    const uid = BigInt(userId);
    // 1) 用户所有「已达标」的打卡日期
    const checkins = await this.prisma.userCheckin.findMany({
      where: { userId: uid },
      select: { checkinDate: true, doneCount: true, goalCount: true },
    });
    const qualifiedDates = checkins
      .filter((row) => row.goalCount > 0 && row.doneCount >= row.goalCount)
      .map((row) => row.checkinDate);
    if (qualifiedDates.length === 0) {
      return { granted: 0, bizDates: [] };
    }

    // 2) 这些日期里已就绪的句签
    const cards = await this.prisma.dailySentenceCard.findMany({
      where: { bizDate: { in: qualifiedDates }, status: 'ready' },
      select: { id: true, bizDate: true },
      orderBy: { bizDate: 'asc' },
    });
    if (cards.length === 0) {
      return { granted: 0, bizDates: [] };
    }

    // 3) 扣掉已拥有的
    const owned = await this.prisma.userSentenceCard.findMany({
      where: { userId: uid, sentenceCardId: { in: cards.map((card) => card.id) } },
      select: { sentenceCardId: true },
    });
    const ownedIds = new Set(owned.map((row) => String(row.sentenceCardId)));
    const missing = cards.filter((card) => !ownedIds.has(String(card.id)));
    if (missing.length === 0) {
      return { granted: 0, bizDates: [] };
    }

    // 4) 补发（skipDuplicates 在 MySQL/MariaDB 下由 INSERT IGNORE 兜底）
    await this.prisma.userSentenceCard.createMany({
      data: missing.map((card) => ({ userId: uid, sentenceCardId: card.id })),
      skipDuplicates: true,
    });
    this.logger.log(
      `[SentenceCard] 用户 ${userId} 补发漏签 ${missing.length} 张：${missing.map((c) => c.bizDate).join(', ')}`,
    );
    return { granted: missing.length, bizDates: missing.map((card) => card.bizDate) };
  }

  /**
   * 运营后台「解锁」指定句签（幂等）。
   *
   * 与 claimToday 同一条写入链路：userId + sentenceCardId 唯一键兜底并发，
   * 重复解锁返回 alreadyOwned=true 而不是报错。card 不存在或未就绪时报错，
   * 避免运营对 pending/failed 的卡误操作。
   */
  async grantCard(userId: number, cardId: number): Promise<{ view: SentenceCardView; alreadyOwned: boolean }> {
    const card = await this.prisma.dailySentenceCard.findUnique({ where: { id: BigInt(cardId) } });
    if (!card) {
      throw AppException.notFound('句签不存在');
    }
    if (card.status !== 'ready') {
      throw AppException.badRequest('该句签尚未就绪（pending/failed），无法解锁');
    }
    const existing = await this.prisma.userSentenceCard.findUnique({
      where: { userId_sentenceCardId: { userId: BigInt(userId), sentenceCardId: card.id } },
      select: { id: true },
    });
    const grant = await this.prisma.userSentenceCard.upsert({
      where: { userId_sentenceCardId: { userId: BigInt(userId), sentenceCardId: card.id } },
      create: { userId: BigInt(userId), sentenceCardId: card.id },
      update: {},
      select: { obtainedAt: true },
    });
    const imageUrl = await this.imageUrlOf(card.imageFileId);
    this.logger.log(`[SentenceCard] 运营为用户 ${userId} 解锁句签 #${cardId}（${card.bizDate}）`);
    return { view: this.toView(card, grant.obtainedAt, imageUrl), alreadyOwned: existing !== null };
  }

  /** 我的句签列表（按获得时间倒序）。 */
  async listMine(userId: number): Promise<SentenceCardView[]> {
    const rows = await this.prisma.userSentenceCard.findMany({
      where: { userId: BigInt(userId) },
      orderBy: { obtainedAt: 'desc' },
      select: { obtainedAt: true, sentenceCard: true },
    });
    // 批量取图片 URL，避免 N+1
    const ids = [...new Set(rows.map((row) => row.sentenceCard.imageFileId).filter((id) => id > 0n))];
    const files = ids.length
      ? await this.prisma.file.findMany({ where: { id: { in: ids } }, select: { id: true, fileUrl: true } })
      : [];
    const urlMap = new Map(files.map((file) => [String(file.id), file.fileUrl]));
    return rows.map((row) =>
      this.toView(row.sentenceCard, row.obtainedAt, urlMap.get(String(row.sentenceCard.imageFileId)) ?? null),
    );
  }

  /**
   * 未拥有的句签（已就绪的每日句签 − 已获得），按业务日期倒序。
   * 供「查看未拥有」弹窗使用：让用户看到集卡还差哪些（含过往漏领的）。
   * 列表按 MISSING_CARD_LIMIT 截断，另返回 total 让前端说明「共 N 张，显示最近一批」。
   */
  async listMissing(userId: number): Promise<MissingSentenceCards> {
    const uid = BigInt(userId);
    const owned = await this.prisma.userSentenceCard.findMany({
      where: { userId: uid },
      select: { sentenceCardId: true },
    });
    const ownedIds = owned.map((row) => row.sentenceCardId);
    const where = {
      status: 'ready',
      ...(ownedIds.length > 0 ? { id: { notIn: ownedIds } } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.dailySentenceCard.count({ where }),
      this.prisma.dailySentenceCard.findMany({
        where,
        orderBy: { bizDate: 'desc' },
        take: MISSING_CARD_LIMIT,
      }),
    ]);
    // 批量取图片 URL，避免 N+1（与 listMine 同一套路）
    const ids = [...new Set(rows.map((row) => row.imageFileId).filter((id) => id > 0n))];
    const files = ids.length
      ? await this.prisma.file.findMany({ where: { id: { in: ids } }, select: { id: true, fileUrl: true } })
      : [];
    const urlMap = new Map(files.map((file) => [String(file.id), file.fileUrl]));
    return {
      total,
      list: rows.map((row) => this.toView(row, null, urlMap.get(String(row.imageFileId)) ?? null)),
    };
  }

  /**
   * 今日句签是否已获得（导航头像常驻特效用）。
   * 轻量查询：只判断「今天这张是否已入账」，不返回卡片内容。
   */
  async todayStatus(userId: number): Promise<{ obtained: boolean; bizDate: string }> {
    const bizDate = this.today();
    const row = await this.prisma.userSentenceCard.findFirst({
      where: { userId: BigInt(userId), sentenceCard: { bizDate } },
      select: { id: true },
    });
    return { obtained: row !== null, bizDate };
  }

  /** 组装视图。 */
  private toView(
    card: {
      id: bigint;
      bizDate: string;
      title: string;
      titleZh: string;
      sentenceEn: string;
      translationZh: string;
      blessing: string;
    },
    obtainedAt: Date | null,
    imageUrl: string | null,
  ): SentenceCardView {
    return {
      id: Number(card.id),
      bizDate: card.bizDate,
      title: card.title,
      titleZh: card.titleZh,
      sentenceEn: card.sentenceEn,
      translationZh: card.translationZh,
      blessing: card.blessing,
      imageUrl,
      obtainedAt: obtainedAt ? obtainedAt.toISOString() : null,
    };
  }

  /** 由文件 id 解析访问 URL（0/缺失返回 null）。 */
  private async imageUrlOf(fileId: bigint): Promise<string | null> {
    if (fileId <= 0n) {
      return null;
    }
    const file = await this.fileService.findById(Number(fileId));
    return file?.fileUrl ?? null;
  }

  /** 本地时区的今天（YYYY-MM-DD）。 */
  private today(): string {
    return this.formatDate(new Date());
  }

  /** 格式化为本地时区日期串。 */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
