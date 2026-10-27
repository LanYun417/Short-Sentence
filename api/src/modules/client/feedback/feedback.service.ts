/**
 * 产品反馈服务（客户端）。
 * 模块职责：接收用户对**产品本身**的意见并落库，供运营在后台核查处理；
 * 同时提供「我的反馈」列表，让用户看到自己提的意见被回应（回复由后台填写）。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/exception/app.exception.js';
import { buildPageResult, parsePagination } from '../../../common/utils/utils.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { PageResult } from '../../../common/types.js';
import type { CreateFeedbackDto } from './dto.js';

/** 用户端可见的反馈项（含运营回复；内部备注 handleNote 刻意不下发）。 */
export interface MyFeedbackItem {
  id: number;
  type: string;
  content: string;
  /** pending 待处理 / resolved 已处理 / dismissed 已驳回 */
  status: string;
  /** 运营回复（空 = 尚未回复） */
  reply: string | null;
  handledAt: string | null;
  createdAt: string;
}

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  /** 提交反馈。 */
  async create(userId: number, dto: CreateFeedbackDto): Promise<{ id: number }> {
    // DTO 的 MinLength 挡不住「全是空格」的内容
    const content = dto.content.trim();
    if (!content) {
      throw AppException.badRequest('反馈内容不能为空');
    }
    const row = await this.prisma.clientFeedback.create({
      data: {
        userId: BigInt(userId),
        type: dto.type,
        content: content.slice(0, 1000),
        contact: dto.contact?.trim() || null,
        platform: dto.platform ?? 'web',
        appVersion: dto.appVersion?.trim() || null,
      },
      select: { id: true },
    });
    return { id: Number(row.id) };
  }

  /** 我的反馈（时间倒序，含处理状态与运营回复）。 */
  async mine(userId: number, query: Record<string, unknown>): Promise<PageResult<MyFeedbackItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where = { userId: BigInt(userId) };

    const [rows, total] = await Promise.all([
      this.prisma.clientFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          type: true,
          content: true,
          status: true,
          reply: true,
          handledAt: true,
          createdAt: true,
        },
      }),
      this.prisma.clientFeedback.count({ where }),
    ]);

    return buildPageResult(
      rows.map((row) => ({
        id: Number(row.id),
        type: row.type,
        content: row.content,
        status: row.status,
        reply: row.reply,
        handledAt: row.handledAt ? row.handledAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    );
  }
}
