/**
 * 客户端通知管理服务（后台运营侧）。
 * 模块职责：客户端公告的列表（含已读人数）/ 发布 / 编辑 / 发布状态切换 / 删除。
 *
 * 与 `NoticeService`（后台站内信收件箱）的关系：**同一模块、不同表**。
 * 后台站内信是「按人一行」的收件箱；客户端公告是广播表 `client_notice`，
 * 一条内容全员可见，已读按人记在 `client_notice_read`。二者受众与膨胀特性都不同，
 * 因此刻意不合并（理由见 prisma/schema/client-notice.prisma 顶部注释）。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import { buildPageResult, parsePagination, readNumber, readString } from '../../common/utils/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PageResult } from '../../common/types.js';

/** 通知类型（与客户端侧枚举保持一致）。 */
export const ADMIN_CLIENT_NOTICE_TYPE = { SYSTEM: 1, ANNOUNCEMENT: 2, ACTIVITY: 3 } as const;

/** 通知状态。 */
export const ADMIN_CLIENT_NOTICE_STATUS = { DRAFT: 0, PUBLISHED: 1, WITHDRAWN: 2 } as const;

export type ClientNoticeStatus = (typeof ADMIN_CLIENT_NOTICE_STATUS)[keyof typeof ADMIN_CLIENT_NOTICE_STATUS];

/** 后台可见的公告结构（比客户端多状态、置顶与已读人数）。 */
export interface AdminClientNoticeItem {
  id: number;
  title: string;
  content: string;
  noticeType: number;
  link: string | null;
  status: number;
  pinned: number;
  /** 已读人数（撤回后仍可看历史数据） */
  readCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 新增/编辑入参。 */
export interface SaveClientNoticeInput {
  title: string;
  content: string;
  noticeType: number;
  link?: string;
  pinned?: number;
  /** 保存后是否立即发布（false = 存草稿） */
  publish?: boolean;
}

@Injectable()
export class AdminClientNoticeService {
  constructor(private readonly prisma: PrismaService) {}

  /** 公告列表（后台：含草稿与已撤回，带已读人数）。 */
  async list(query: Record<string, unknown>): Promise<PageResult<AdminClientNoticeItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where: Record<string, unknown> = {};
    const status = readNumber(query.status);
    if (status !== undefined && Number.isInteger(status)) {
      where.status = status;
    }
    const noticeType = readNumber(query.noticeType);
    if (noticeType !== undefined && Number.isInteger(noticeType)) {
      where.noticeType = noticeType;
    }
    const title = readString(query.title);
    if (title) {
      where.title = { contains: title };
    }

    const [rows, total] = await Promise.all([
      this.prisma.clientNotice.findMany({
        where,
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        skip: offset,
        take: limit,
        // 已读人数：一条公告的已读记录数（撤回后也保留）
        include: { _count: { select: { reads: true } } },
      }),
      this.prisma.clientNotice.count({ where }),
    ]);

    return buildPageResult(
      rows.map((row) => this.toItem(row)),
      total,
      page,
      pageSize,
    );
  }

  /** 新增公告（`publish=true` 立即发布，否则存草稿）。 */
  async create(input: SaveClientNoticeInput, createdBy: number | null): Promise<{ id: number }> {
    const publish = input.publish !== false;
    const row = await this.prisma.clientNotice.create({
      data: {
        title: input.title,
        content: input.content,
        noticeType: input.noticeType,
        link: input.link ?? null,
        pinned: input.pinned ?? 0,
        status: publish ? ADMIN_CLIENT_NOTICE_STATUS.PUBLISHED : ADMIN_CLIENT_NOTICE_STATUS.DRAFT,
        publishedAt: publish ? new Date() : null,
        createdBy: createdBy === null ? null : BigInt(createdBy),
      },
      select: { id: true },
    });
    return { id: Number(row.id) };
  }

  /** 编辑公告（已发布的内容也允许改，改的是当下可见的正文）。 */
  async update(id: number, input: SaveClientNoticeInput): Promise<void> {
    await this.requireNotice(id);
    await this.prisma.clientNotice.update({
      where: { id: BigInt(id) },
      data: {
        title: input.title,
        content: input.content,
        noticeType: input.noticeType,
        link: input.link ?? null,
        pinned: input.pinned ?? 0,
      },
    });
  }

  /**
   * 切换发布状态（发布 / 撤回）。
   * 撤回不删数据、不删已读记录——重新发布时不刷新 `publishedAt` 之外的信息，
   * 已读的人也保持已读（避免「重复推送同一条已读公告」的骚扰）。
   */
  async setStatus(id: number, status: ClientNoticeStatus): Promise<void> {
    const row = await this.prisma.clientNotice.findUnique({
      where: { id: BigInt(id) },
      select: { publishedAt: true },
    });
    if (!row) {
      throw AppException.notFound('公告不存在');
    }
    await this.prisma.clientNotice.update({
      where: { id: BigInt(id) },
      data: {
        status,
        // 首次发布时写入发布时间；撤回/重新发布保持首次时间，列表顺序才稳定
        publishedAt:
          status === ADMIN_CLIENT_NOTICE_STATUS.PUBLISHED ? (row.publishedAt ?? new Date()) : row.publishedAt,
      },
    });
  }

  /** 删除公告（已读记录随外键级联删除）。 */
  async remove(id: number): Promise<void> {
    const result = await this.prisma.clientNotice.deleteMany({ where: { id: BigInt(id) } });
    if (result.count === 0) {
      throw AppException.notFound('公告不存在');
    }
  }

  /** 存在性校验（统一 404 文案）。 */
  private async requireNotice(id: number): Promise<void> {
    const row = await this.prisma.clientNotice.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!row) {
      throw AppException.notFound('公告不存在');
    }
  }

  /** 数据库行 → 后台结构。 */
  private toItem(row: {
    id: bigint;
    title: string;
    content: string;
    noticeType: number;
    link: string | null;
    status: number;
    pinned: number;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { reads: number };
  }): AdminClientNoticeItem {
    return {
      id: Number(row.id),
      title: row.title,
      content: row.content,
      noticeType: Number(row.noticeType),
      link: row.link,
      status: Number(row.status),
      pinned: Number(row.pinned),
      readCount: row._count.reads,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
