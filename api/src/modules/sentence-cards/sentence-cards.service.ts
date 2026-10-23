/**
 * 句签管理服务（运营后台）。
 * 模块职责：句签列表 / 详情（含领取情况）/ 文案编辑 / 按日期重生成 / 删除。
 *
 * 生成逻辑完全复用客户端域 `SentenceCardService.generateForDate`（同一套 AI 文案 + 生图 +
 * 入库链路），后台只负责「看」与「干预」，不重复实现生成——两条链路各写一遍必然漂移。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { buildPageResult, parsePagination, readString } from '../../common/utils/utils.js';
import type { PageResult } from '../../common/types.js';
import { SentenceCardService } from '../client/sentence-card/sentence-card.service.js';
import type { GenerateSentenceCardDto, UpdateSentenceCardDto } from './sentence-cards.dto.js';

/** 列表项。 */
export interface SentenceCardAdminItem {
  id: number;
  bizDate: string;
  title: string;
  titleZh: string;
  sentenceEn: string;
  translationZh: string;
  imageUrl: string | null;
  status: string;
  /** 领取人数（user_sentence_card 记录数） */
  claimCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 详情（多出提示词与最近领取明细）。 */
export interface SentenceCardAdminDetail extends SentenceCardAdminItem {
  /** 生图提示词（运营审核文案与画面是否匹配） */
  scenePrompt: string;
  imageFileId: number;
  /** 最近领取的用户（最多 10 条） */
  claims: Array<{ userId: number; nickname: string | null; email: string | null; obtainedAt: Date }>;
}

@Injectable()
export class SentenceCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sentenceCard: SentenceCardService,
  ) {}

  /** 分页列表（按业务日期倒序）。 */
  async list(query: Record<string, unknown>): Promise<PageResult<SentenceCardAdminItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where: Record<string, unknown> = {};

    const status = readString(query.status);
    if (status) {
      where.status = status;
    }
    const keyword = readString(query.keyword);
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { titleZh: { contains: keyword } },
        { sentenceEn: { contains: keyword } },
        { translationZh: { contains: keyword } },
      ];
    }
    const startDate = readString(query.startDate);
    const endDate = readString(query.endDate);
    if (startDate || endDate) {
      where.bizDate = { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) };
    }

    const [rows, total] = await Promise.all([
      this.prisma.dailySentenceCard.findMany({
        where,
        orderBy: { bizDate: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.dailySentenceCard.count({ where }),
    ]);

    // 图片地址与领取数都批量取，避免逐行查库
    const [urls, claims] = await Promise.all([
      this.fileUrls(rows.map((row) => row.imageFileId)),
      this.claimCounts(rows.map((row) => row.id)),
    ]);

    const list = rows.map((row) =>
      this.toItem(row, urls.get(Number(row.imageFileId)) ?? null, claims.get(Number(row.id)) ?? 0),
    );
    return buildPageResult(list, total, page, pageSize);
  }

  /** 详情（含最近 10 位领取用户）。 */
  async detail(id: number): Promise<SentenceCardAdminDetail> {
    const row = await this.prisma.dailySentenceCard.findUnique({ where: { id: BigInt(id) } });
    if (!row) {
      throw AppException.notFound('句签不存在');
    }

    const [urls, grants, claimCount] = await Promise.all([
      this.fileUrls([row.imageFileId]),
      this.prisma.userSentenceCard.findMany({
        where: { sentenceCardId: row.id },
        orderBy: { obtainedAt: 'desc' },
        take: 10,
        select: { userId: true, obtainedAt: true },
      }),
      this.prisma.userSentenceCard.count({ where: { sentenceCardId: row.id } }),
    ]);

    const users = grants.length
      ? await this.prisma.clientUser.findMany({
          where: { id: { in: grants.map((grant) => grant.userId) } },
          select: { id: true, nickname: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((user) => [Number(user.id), user]));

    return {
      ...this.toItem(row, urls.get(Number(row.imageFileId)) ?? null, claimCount),
      scenePrompt: row.scenePrompt,
      imageFileId: Number(row.imageFileId),
      claims: grants.map((grant) => {
        const user = userMap.get(Number(grant.userId));
        return {
          userId: Number(grant.userId),
          nickname: user?.nickname ?? null,
          email: user?.email ?? null,
          obtainedAt: grant.obtainedAt,
        };
      }),
    };
  }

  /** 编辑文案（只改文字字段；图片与状态走重新生成）。 */
  async update(id: number, dto: UpdateSentenceCardDto): Promise<null> {
    const existing = await this.prisma.dailySentenceCard.findUnique({
      where: { id: BigInt(id) },
      select: { id: true },
    });
    if (!existing) {
      throw AppException.notFound('句签不存在');
    }

    const data: Record<string, string> = {};
    for (const key of ['title', 'titleZh', 'sentenceEn', 'translationZh'] as const) {
      const value = dto[key];
      if (value !== undefined) {
        data[key] = value.trim();
      }
    }
    if (Object.keys(data).length === 0) {
      return null;
    }

    await this.prisma.dailySentenceCard.update({ where: { id: BigInt(id) }, data });
    return null;
  }

  /**
   * 按日期重新生成（force 缺省为 true：后台点「重新生成」就是要覆盖）。
   *
   * 该接口同步等待 AI 文案 + 生图完成（通常 10~40s，受上游限流影响），
   * 前端按钮需转 loading；超时由前端请求层兜底。
   */
  async regenerate(dto: GenerateSentenceCardDto): Promise<{ bizDate: string; generated: boolean }> {
    try {
      const generated = await this.sentenceCard.generateForDate(dto.bizDate, dto.force ?? true);
      return { bizDate: dto.bizDate, generated };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw AppException.badRequest(`句签生成失败：${message.slice(0, 200)}`);
    }
  }

  /** 删除句签（连带领取记录，外键约束要求先删子表）。 */
  async remove(id: number): Promise<null> {
    const existing = await this.prisma.dailySentenceCard.findUnique({
      where: { id: BigInt(id) },
      select: { id: true },
    });
    if (!existing) {
      throw AppException.notFound('句签不存在');
    }
    await this.prisma.$transaction([
      this.prisma.userSentenceCard.deleteMany({ where: { sentenceCardId: BigInt(id) } }),
      this.prisma.dailySentenceCard.delete({ where: { id: BigInt(id) } }),
    ]);
    return null;
  }

  /** 批量取文件访问地址（0 / 缺失返回不在 map 中）。 */
  private async fileUrls(fileIds: bigint[]): Promise<Map<number, string>> {
    const ids = fileIds.filter((id) => id > 0n);
    if (ids.length === 0) {
      return new Map();
    }
    const files = await this.prisma.file.findMany({
      where: { id: { in: ids } },
      select: { id: true, fileUrl: true },
    });
    return new Map(files.map((file) => [Number(file.id), file.fileUrl]));
  }

  /** 批量统计领取人数。 */
  private async claimCounts(cardIds: bigint[]): Promise<Map<number, number>> {
    if (cardIds.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.userSentenceCard.groupBy({
      by: ['sentenceCardId'],
      where: { sentenceCardId: { in: cardIds } },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [Number(row.sentenceCardId), row._count._all]));
  }

  /** 行 → 列表项。 */
  private toItem(
    row: {
      id: bigint;
      bizDate: string;
      title: string;
      titleZh: string;
      sentenceEn: string;
      translationZh: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    },
    imageUrl: string | null,
    claimCount: number,
  ): SentenceCardAdminItem {
    return {
      id: Number(row.id),
      bizDate: row.bizDate,
      title: row.title,
      titleZh: row.titleZh,
      sentenceEn: row.sentenceEn,
      translationZh: row.translationZh,
      imageUrl,
      status: row.status,
      claimCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
