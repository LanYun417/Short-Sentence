/**
 * 产品反馈处理服务（管理端）。
 * 模块职责：分页查询客户端产品反馈（含提交人昵称）、处理（状态流转 + 回复 + 内部备注）。
 *
 * 与 `sentence` 模块里的 ReportService（题目举报）分开：举报面向「某一道题」，
 * 本服务面向「产品本身」，字段与处理动作都不同（详见 prisma/schema/client-feedback.prisma）。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import { buildPageResult, parsePagination, readString } from '../../common/utils/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PageResult } from '../../common/types.js';
import type { HandleFeedbackDto } from './feedback.dto.js';

/** 把 DB 里的 images（JSON 数组或 null）安全解析成 string[]。 */
function parseImages(value: string | null): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/** 反馈列表项（后台视角：含联系方式、端信息、内部备注）。 */
export interface FeedbackListItem {
  id: number;
  type: string;
  content: string;
  /** 反馈图片 URL 列表（最多 5 张；空数组 = 无图） */
  images: string[];
  contact: string | null;
  platform: string;
  appVersion: string | null;
  status: string;
  /** 给用户的回复（会下发用户端） */
  reply: string | null;
  /** 内部备注（仅后台可见） */
  handleNote: string | null;
  handledAt: string | null;
  createdAt: string;
  /** 提交人（client_user 不建关系，按 userId 批量查后回填） */
  reporter: { id: number; nickname: string } | null;
}

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  /** 分页列表（筛选 status / type / platform / keyword）。 */
  async list(query: Record<string, unknown>): Promise<PageResult<FeedbackListItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const status = readString(query.status);
    const type = readString(query.type);
    const platform = readString(query.platform);
    const keyword = readString(query.keyword);

    const where = {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(platform ? { platform } : {}),
      ...(keyword
        ? {
            OR: [{ content: { contains: keyword } }, { contact: { contains: keyword } }],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.clientFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          userId: true,
          type: true,
          content: true,
          images: true,
          contact: true,
          platform: true,
          appVersion: true,
          status: true,
          reply: true,
          handleNote: true,
          handledAt: true,
          createdAt: true,
        },
      }),
      this.prisma.clientFeedback.count({ where }),
    ]);

    // 提交人昵称：与 client_user 不建 Prisma 关系，按 userId 批量查后回填
    const userIds = [...new Set(rows.map((row) => row.userId))];
    const users = userIds.length
      ? await this.prisma.clientUser.findMany({
          where: { id: { in: userIds } },
          select: { id: true, nickname: true },
        })
      : [];
    const nicknameMap = new Map(users.map((item) => [Number(item.id), item.nickname]));

    return buildPageResult(
      rows.map((row) => ({
        id: Number(row.id),
        type: row.type,
        content: row.content,
        images: parseImages(row.images),
        contact: row.contact,
        platform: row.platform,
        appVersion: row.appVersion,
        status: row.status,
        reply: row.reply,
        handleNote: row.handleNote,
        handledAt: row.handledAt ? row.handledAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        reporter: { id: Number(row.userId), nickname: nicknameMap.get(Number(row.userId)) ?? '未知用户' },
      })),
      total,
      page,
      pageSize,
    );
  }

  /** 处理反馈（状态 + 回复 + 内部备注 + 处理时间）。 */
  async handle(id: number, dto: HandleFeedbackDto): Promise<void> {
    const existing = await this.prisma.clientFeedback.findUnique({
      where: { id: BigInt(id) },
      select: { id: true },
    });
    if (!existing) {
      throw AppException.notFound('反馈不存在');
    }
    await this.prisma.clientFeedback.update({
      where: { id: BigInt(id) },
      data: {
        status: dto.status,
        reply: dto.reply?.trim() || null,
        handleNote: dto.handleNote?.trim() || null,
        handledAt: new Date(),
      },
    });
  }
}
