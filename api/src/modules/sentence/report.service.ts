/**
 * 举报处理服务（管理端）。
 * 模块职责：分页查询题目举报（含句子摘要与举报人昵称），处理（状态流转 + 备注 + 处理时间）。
 * 归属题库管理域：举报是题目质量的运营反馈，与 sentence:* 同域。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { parsePagination } from '../../common/utils/utils.js';
import type { HandleReportDto } from './report.dto.js';

/** 举报列表项。 */
export interface ReportListItem {
  id: number;
  reason: string;
  description: string | null;
  status: string;
  handleNote: string | null;
  handledAt: Date | null;
  createdAt: Date;
  sentence: { id: number; sentenceEn: string; translationZh: string } | null;
  /** 举报人（client_user 不建关系，按 userId 批量查后回填） */
  reporter: { id: number; nickname: string } | null;
}

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  /** 分页列表（筛选 status/reason/keyword）。 */
  async list(query: Record<string, unknown>): Promise<{ list: ReportListItem[]; total: number }> {
    const { offset, limit } = parsePagination(query);
    const status = typeof query.status === 'string' && query.status ? query.status : undefined;
    const reason = typeof query.reason === 'string' && query.reason ? query.reason : undefined;
    const keyword = typeof query.keyword === 'string' && query.keyword.trim() ? query.keyword.trim() : undefined;

    const where = {
      ...(status ? { status } : {}),
      ...(reason ? { reason } : {}),
      ...(keyword
        ? {
            OR: [
              { sentence: { sentenceEn: { contains: keyword } } },
              { sentence: { translationZh: { contains: keyword } } },
              { description: { contains: keyword } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.sentenceReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          userId: true,
          reason: true,
          description: true,
          status: true,
          handleNote: true,
          handledAt: true,
          createdAt: true,
          sentence: { select: { id: true, sentenceEn: true, translationZh: true } },
        },
      }),
      this.prisma.sentenceReport.count({ where }),
    ]);

    // 举报人昵称：client_user 与 sentence_report 不建 Prisma 关系，按 userId 批量查后回填
    const userIds = [...new Set(rows.map((row) => row.userId))];
    const users = userIds.length
      ? await this.prisma.clientUser.findMany({
          where: { id: { in: userIds } },
          select: { id: true, nickname: true },
        })
      : [];
    const nicknameMap = new Map(users.map((u) => [Number(u.id), u.nickname]));

    const list: ReportListItem[] = rows.map((row) => ({
      id: Number(row.id),
      reason: row.reason,
      description: row.description,
      status: row.status,
      handleNote: row.handleNote,
      handledAt: row.handledAt,
      createdAt: row.createdAt,
      sentence: row.sentence
        ? {
            id: Number(row.sentence.id),
            sentenceEn: row.sentence.sentenceEn,
            translationZh: row.sentence.translationZh,
          }
        : null,
      reporter: { id: Number(row.userId), nickname: nicknameMap.get(Number(row.userId)) ?? '未知用户' },
    }));
    return { list, total };
  }

  /** 处理举报（状态流转 + 备注 + 处理时间）。 */
  async handle(id: number, dto: HandleReportDto): Promise<void> {
    const existing = await this.prisma.sentenceReport.findUnique({
      where: { id: BigInt(id) },
      select: { id: true },
    });
    if (!existing) {
      throw AppException.notFound('举报不存在');
    }
    await this.prisma.sentenceReport.update({
      where: { id: BigInt(id) },
      data: {
        status: dto.status,
        handleNote: dto.handleNote?.trim() || null,
        handledAt: new Date(),
      },
    });
  }
}
