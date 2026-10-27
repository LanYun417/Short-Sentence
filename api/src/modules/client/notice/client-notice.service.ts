/**
 * 客户端通知读取服务（用户端）。
 * 模块职责：已发布公告的列表 / 未读数 / 标记已读（单条与全部）。
 *
 * 与后台 `NoticeService`（sys_notice 收件箱）的区别：
 * 那张表是「按人一行的收件箱」，这里读的是**广播表** `client_notice`
 * ——一条内容全员可见，已读状态记在 `client_notice_read`（按人一行）。
 *
 * 设计要点：
 * - 只返回 `status = 已发布` 的通知：草稿与已撤回对用户不存在；
 * - 排序用「置顶 → 发布时间倒序」而**不是「未读优先」**：公告是时间线，
 *   未读优先会让已读的旧公告沉底、时间顺序错乱（未读用小红点表达即可）；
 * - 标记已读**幂等**：`(noticeId, userId)` 唯一键 + upsert，重复点不会报错、不重复计数。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/exception/app.exception.js';
import { buildPageResult, parsePagination, readNumber } from '../../../common/utils/utils.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { PageResult } from '../../../common/types.js';

/** 通知类型（与后台 sys_notice 的枚举语义一致）。 */
export const CLIENT_NOTICE_TYPE = {
  /** 系统通知 */
  SYSTEM: 1,
  /** 公告 */
  ANNOUNCEMENT: 2,
  /** 活动 */
  ACTIVITY: 3,
} as const;

/** 通知状态。 */
export const CLIENT_NOTICE_STATUS = {
  /** 草稿（仅后台可见） */
  DRAFT: 0,
  /** 已发布（客户端可见） */
  PUBLISHED: 1,
  /** 已撤回（客户端不可见，保留数据） */
  WITHDRAWN: 2,
} as const;

/** 客户端通知对外结构。 */
export interface ClientNoticeItem {
  id: number;
  title: string;
  content: string;
  noticeType: number;
  /** 点击跳转的客户端路由（空 = 不跳转） */
  link: string | null;
  /** 0 未读 / 1 已读（按当前用户计算） */
  isRead: number;
  /** 置顶 */
  pinned: number;
  publishedAt: string | null;
  createdAt: string;
}

@Injectable()
export class ClientNoticeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 我的通知列表（只含已发布）。
   * @param userId 当前客户端用户
   * @param query 分页与过滤（noticeType / isRead）
   */
  async listMine(userId: number, query: Record<string, unknown>): Promise<PageResult<ClientNoticeItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where: Record<string, unknown> = { status: CLIENT_NOTICE_STATUS.PUBLISHED };
    const noticeType = readNumber(query.noticeType);
    if (noticeType !== undefined && Number.isInteger(noticeType)) {
      where.noticeType = noticeType;
    }

    // 已读集合先取出来：`isRead` 是「按人」的派生值，不是表上的列，
    // 因此无法交给 SQL 过滤；先按用户读过的通知 id 集合在内存里筛。
    const readIds = await this.readNoticeIds(userId);
    const isReadFilter = readNumber(query.isRead);
    if (isReadFilter === 1) {
      // 一条都没读过时 `in: []` 正好表示「没有结果」，不必特判
      where.id = { in: readIds.map((id) => BigInt(id)) };
    } else if (isReadFilter === 0 && readIds.length > 0) {
      // 全部未读时不需要任何 id 条件（加了反而多一次比较）
      where.id = { notIn: readIds.map((id) => BigInt(id)) };
    }

    const [rows, total] = await Promise.all([
      this.prisma.clientNotice.findMany({
        where,
        // 置顶优先，其次按发布时间倒序（时间是公告的天然顺序）
        orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.clientNotice.count({ where }),
    ]);

    const readSet = new Set(readIds.map((id) => Number(id)));
    return buildPageResult(
      rows.map((row) => this.toItem(row, readSet.has(Number(row.id)))),
      total,
      page,
      pageSize,
    );
  }

  /**
   * 未读数（客户端红点）。
   *
   * 口径：**已发布总数 − 我已读数**（交集算，撤回的通知不计入分子分母），
   * 避免「撤回一条公告后红点变成负数」。
   */
  async unreadCount(userId: number): Promise<number> {
    const [total, read] = await Promise.all([
      this.prisma.clientNotice.count({ where: { status: CLIENT_NOTICE_STATUS.PUBLISHED } }),
      this.prisma.clientNoticeRead.count({
        where: { userId: BigInt(userId), notice: { status: CLIENT_NOTICE_STATUS.PUBLISHED } },
      }),
    ]);
    return Math.max(0, total - read);
  }

  /**
   * 标记已读（幂等）。
   * @param userId 当前用户（**必须带**，否则可以改别人的已读状态）
   */
  async markRead(userId: number, id: number): Promise<void> {
    const notice = await this.prisma.clientNotice.findFirst({
      where: { id: BigInt(id), status: CLIENT_NOTICE_STATUS.PUBLISHED },
      select: { id: true },
    });
    if (!notice) {
      throw AppException.notFound('通知不存在');
    }
    await this.prisma.clientNoticeRead.upsert({
      where: { noticeId_userId: { noticeId: notice.id, userId: BigInt(userId) } },
      create: { noticeId: notice.id, userId: BigInt(userId) },
      // 已读过就什么都不做（不刷新 readAt：首次阅读时间才是有效信息）
      update: {},
    });
  }

  /** 全部标记已读，返回本次新增的已读条数。 */
  async markAllRead(userId: number): Promise<number> {
    const readIds = new Set((await this.readNoticeIds(userId)).map((id) => Number(id)));
    const pending = await this.prisma.clientNotice.findMany({
      where: { status: CLIENT_NOTICE_STATUS.PUBLISHED },
      select: { id: true },
    });
    const targets = pending.filter((row) => !readIds.has(Number(row.id)));
    if (targets.length === 0) {
      return 0;
    }
    const result = await this.prisma.clientNoticeRead.createMany({
      data: targets.map((row) => ({ noticeId: row.id, userId: BigInt(userId) })),
      // 并发下重复插入直接跳过（唯一键兜底）
      skipDuplicates: true,
    });
    return result.count;
  }

  /** 当前用户读过的通知 id 列表。 */
  private async readNoticeIds(userId: number): Promise<bigint[]> {
    const rows = await this.prisma.clientNoticeRead.findMany({
      where: { userId: BigInt(userId) },
      select: { noticeId: true },
    });
    return rows.map((row) => row.noticeId);
  }

  /** 数据库行 → 对外结构。 */
  private toItem(
    row: {
      id: bigint;
      title: string;
      content: string;
      noticeType: number;
      link: string | null;
      pinned: number;
      publishedAt: Date | null;
      createdAt: Date;
    },
    isRead: boolean,
  ): ClientNoticeItem {
    return {
      id: Number(row.id),
      title: row.title,
      content: row.content,
      noticeType: Number(row.noticeType),
      link: row.link,
      isRead: isRead ? 1 : 0,
      pinned: Number(row.pinned),
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
