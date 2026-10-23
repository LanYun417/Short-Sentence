/**
 * 每日藏品服务（客户端 + 定时生成）。
 * 模块职责：
 * - 每日定时 AI 生成一张精美闪卡（文案 + 生图 → webp 入库），bizDate 唯一即幂等；
 * - 用户完成每日目标后领取当日藏品（userId + collectibleId 唯一即幂等）；
 * - 查询用户已获得的藏品列表。
 *
 * 设计红线（与产品「轻量、正反馈、不焦虑」一致）：
 * 领取只增不减、幂等；未达标返回 null（不报错、不惩罚）；藏品与题库配图同一存储链路。
 */
import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { config } from '../../../common/config/config.js';
import { FileService } from '../../../common/file/file.service.js';
import { AgnesImageProvider } from '../../../common/ai/agnes-image.provider.js';
import { DeepSeekSentenceProvider } from '../../../common/ai/deepseek-sentence.provider.js';
import { withRetry } from '../../../common/ai/concurrency.js';
import { PrismaService } from '../../../prisma/prisma.service.js';

/** 藏品生图画风（唯美治愈系，区别于题库的两人对话卡通）。 */
const COLLECTIBLE_STYLE_SUFFIX =
  'dreamy healing illustration, soft watercolor and pastel tones, warm golden sunlight, serene atmosphere, high detail, wide 16:9 composition, no text in image';

/** 藏品视图（客户端）。 */
export interface CollectibleView {
  id: number;
  bizDate: string;
  title: string;
  titleZh: string;
  sentenceEn: string;
  translationZh: string;
  imageUrl: string | null;
  /** 获得时间（ISO；未领取为 null） */
  obtainedAt: string | null;
}

@Injectable()
export class CollectibleService {
  private readonly logger = new Logger(CollectibleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly themeGen: DeepSeekSentenceProvider,
    private readonly imageGen: AgnesImageProvider,
    private readonly fileService: FileService,
  ) {}

  /**
   * 生成今日藏品（幂等：当天已 ready 则跳过）。供定时任务调用。
   * 失败会落一条 status=failed 记录并抛出（任务日志记为失败），便于排查与手动重试。
   */
  async generateDaily(): Promise<void> {
    const bizDate = this.today();
    const existing = await this.prisma.dailyCollectible.findUnique({
      where: { bizDate },
      select: { id: true, status: true },
    });
    if (existing?.status === 'ready') {
      this.logger.log(`[Collectible] ${bizDate} 藏品已就绪，跳过`);
      return;
    }

    try {
      // 1) AI 文案（主题 + 短句 + 生图提示词）
      const theme = await withRetry(() => this.themeGen.generateCollectibleTheme(bizDate), {
        maxAttempts: 3,
        baseDelayMs: 3000,
        maxDelayMs: 20000,
      });
      // 2) AI 生图 → webp
      const image = await withRetry(
        () =>
          this.imageGen.generate(`${theme.scenePrompt}, ${COLLECTIBLE_STYLE_SUFFIX}`, {
            size: config.sentence.imageSize,
            ratio: config.sentence.imageRatio,
          }),
        { maxAttempts: 4, baseDelayMs: 5000, maxDelayMs: 30000 },
      );
      const webp = await sharp(image.buffer)
        .resize({ width: config.sentence.imageMaxWidth, withoutEnlargement: true })
        .webp({ quality: config.sentence.imageQuality })
        .toBuffer();
      const saved = await this.fileService.save(`collectible-${bizDate}.webp`, 'image/webp', webp, null);

      // 3) 入库（bizDate 唯一 → upsert，重复触发覆盖为最新成功结果）
      const data = {
        title: theme.title,
        titleZh: theme.titleZh || theme.title,
        sentenceEn: theme.sentenceEn,
        translationZh: theme.translationZh,
        scenePrompt: theme.scenePrompt,
        imageFileId: BigInt(saved.file.id),
        status: 'ready',
      };
      await this.prisma.dailyCollectible.upsert({
        where: { bizDate },
        create: { bizDate, ...data },
        update: data,
      });
      this.logger.log(`[Collectible] ${bizDate} 藏品生成完成：${theme.title}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Collectible] ${bizDate} 藏品生成失败：${message}`);
      // 落一条 failed 记录（便于运营排查 / 手动重试）；记录失败不影响向上抛出
      await this.prisma.dailyCollectible
        .upsert({
          where: { bizDate },
          create: {
            bizDate,
            title: '',
            titleZh: '',
            sentenceEn: '',
            translationZh: '',
            scenePrompt: '',
            status: 'failed',
          },
          update: { status: 'failed' },
        })
        .catch(() => undefined);
      throw error;
    }
  }

  /** 领取今日藏品（幂等；未完成每日目标或今日藏品未就绪则返回 null）。 */
  async claimToday(userId: number): Promise<CollectibleView | null> {
    const bizDate = this.today();
    // 1) 校验今日目标是否完成
    const checkin = await this.prisma.userCheckin.findUnique({
      where: { userId_checkinDate: { userId: BigInt(userId), checkinDate: bizDate } },
      select: { doneCount: true, goalCount: true },
    });
    if (!checkin || checkin.goalCount <= 0 || checkin.doneCount < checkin.goalCount) {
      return null;
    }
    // 2) 今日藏品须就绪
    const collectible = await this.prisma.dailyCollectible.findUnique({ where: { bizDate } });
    if (!collectible || collectible.status !== 'ready') {
      return null;
    }
    // 3) 幂等领取（userId + collectibleId 唯一）
    const grant = await this.prisma.userCollectible.upsert({
      where: {
        userId_collectibleId: { userId: BigInt(userId), collectibleId: collectible.id },
      },
      create: { userId: BigInt(userId), collectibleId: collectible.id },
      update: {},
      select: { obtainedAt: true },
    });
    const imageUrl = await this.imageUrlOf(collectible.imageFileId);
    return this.toView(collectible, grant.obtainedAt, imageUrl);
  }

  /** 我的藏品列表（按获得时间倒序）。 */
  async listMine(userId: number): Promise<CollectibleView[]> {
    const rows = await this.prisma.userCollectible.findMany({
      where: { userId: BigInt(userId) },
      orderBy: { obtainedAt: 'desc' },
      select: { obtainedAt: true, collectible: true },
    });
    // 批量取图片 URL，避免 N+1
    const ids = [...new Set(rows.map((row) => row.collectible.imageFileId).filter((id) => id > 0n))];
    const files = ids.length
      ? await this.prisma.file.findMany({ where: { id: { in: ids } }, select: { id: true, fileUrl: true } })
      : [];
    const urlMap = new Map(files.map((file) => [String(file.id), file.fileUrl]));
    return rows.map((row) =>
      this.toView(row.collectible, row.obtainedAt, urlMap.get(String(row.collectible.imageFileId)) ?? null),
    );
  }

  /** 组装视图。 */
  private toView(
    collectible: {
      id: bigint;
      bizDate: string;
      title: string;
      titleZh: string;
      sentenceEn: string;
      translationZh: string;
    },
    obtainedAt: Date | null,
    imageUrl: string | null,
  ): CollectibleView {
    return {
      id: Number(collectible.id),
      bizDate: collectible.bizDate,
      title: collectible.title,
      titleZh: collectible.titleZh,
      sentenceEn: collectible.sentenceEn,
      translationZh: collectible.translationZh,
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
