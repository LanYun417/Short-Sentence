/**
 * 用户投稿（UGC）服务。
 *
 * 职责边界：
 * - 用户端：提交（pending）、看自己的投稿与审核结果、看「投稿精选」（approved）；
 * - 后台：分页查看（按状态/关键词）、通过 / 驳回。
 *
 * 投稿**不进刷题池**：刷题池的题必须过 AI 生成 + 配图审核，口径不同；
 * 精选是展示位，与题库解耦，避免「无图题」污染刷题体验。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/exception/app.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { buildPageResult, parsePagination, readString } from '../../../common/utils/utils.js';
import type { PageResult } from '../../../common/types.js';
import { CreateSubmissionDto, ReviewSubmissionDto } from './dto.js';
import { checkFreeText, validateEntry } from '../ugc-content.js';

/** 同一用户最多同时挂起的待审核投稿数（防刷屏，也避免运营被灌爆）。 */
const MAX_PENDING_PER_USER = 5;

/** 用户端投稿条目。 */
export interface SubmissionItem {
  id: number;
  sentenceEn: string;
  translationZh: string;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  /** 审核备注（驳回原因）；待审核为 null */
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

/** 精选条目（带作者昵称）。 */
export interface FeaturedSubmissionItem {
  id: number;
  sentenceEn: string;
  translationZh: string;
  note: string | null;
  author: string;
  approvedAt: string | null;
}

/** 后台列表条目（带作者信息）。 */
export interface AdminSubmissionItem extends SubmissionItem {
  userId: number;
  nickname: string;
  platform: string;
}

@Injectable()
export class SubmissionService {
  constructor(private readonly prisma: PrismaService) {}

  /** 提交一条投稿。 */
  async create(userId: number, dto: CreateSubmissionDto): Promise<{ id: number }> {
    const pending = await this.prisma.userSubmission.count({
      where: { userId: BigInt(userId), status: 'pending' },
    });
    if (pending >= MAX_PENDING_PER_USER) {
      throw AppException.badRequest(`你有 ${pending} 条投稿还在排队，先等运营看完再投新的吧`);
    }
    // UGC 入库前闸门（与接龙共用同一套规则）：英文句子 + 中文译文 + 附言都要过。
    // 投稿审核通过后会公开展示，安全口径不能比接龙松。
    const body = validateEntry(dto.sentenceEn, dto.translationZh, { maxEn: 300, maxZh: 300 });
    if (!body.ok) {
      throw AppException.badRequest(body.message ?? '内容不符合要求');
    }
    const note = checkFreeText(dto.note, 300, '附言');
    if (!note.ok) {
      throw AppException.badRequest(note.message ?? '附言不符合要求');
    }
    const row = await this.prisma.userSubmission.create({
      data: {
        userId: BigInt(userId),
        sentenceEn: body.contentEn,
        translationZh: body.contentZh,
        note: note.value.length > 0 ? note.value : null,
        platform: dto.platform ?? 'web',
      },
      select: { id: true },
    });
    return { id: Number(row.id) };
  }

  /** 我的投稿（含审核状态与驳回原因）。 */
  async mine(userId: number, query: Record<string, unknown>): Promise<PageResult<SubmissionItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where = { userId: BigInt(userId) };
    const [rows, total] = await Promise.all([
      this.prisma.userSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          sentenceEn: true,
          translationZh: true,
          note: true,
          status: true,
          reviewNote: true,
          createdAt: true,
          reviewedAt: true,
        },
      }),
      this.prisma.userSubmission.count({ where }),
    ]);
    return buildPageResult(
      rows.map((row) => this.toItem(row)),
      total,
      page,
      pageSize,
    );
  }

  /** 投稿精选（只含已通过；带作者昵称）。 */
  async featured(query: Record<string, unknown>): Promise<PageResult<FeaturedSubmissionItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where = { status: 'approved' };
    const [rows, total] = await Promise.all([
      this.prisma.userSubmission.findMany({
        where,
        orderBy: [{ reviewedAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit,
        select: {
          id: true,
          userId: true,
          sentenceEn: true,
          translationZh: true,
          note: true,
          reviewedAt: true,
        },
      }),
      this.prisma.userSubmission.count({ where }),
    ]);
    const nicknameMap = await this.nicknameMap(rows.map((row) => Number(row.userId)));
    return buildPageResult(
      rows.map((row) => ({
        id: Number(row.id),
        sentenceEn: row.sentenceEn,
        translationZh: row.translationZh,
        note: row.note,
        author: nicknameMap.get(Number(row.userId)) ?? '匿名用户',
        approvedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
      })),
      total,
      page,
      pageSize,
    );
  }

  /** 后台：分页查看投稿（按状态 / 关键词筛选）。 */
  async list(query: Record<string, unknown>): Promise<PageResult<AdminSubmissionItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const status = readString(query.status);
    const keyword = readString(query.keyword);
    const where = {
      ...(status ? { status } : {}),
      ...(keyword
        ? {
            OR: [{ sentenceEn: { contains: keyword } }, { translationZh: { contains: keyword } }],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.userSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          userId: true,
          sentenceEn: true,
          translationZh: true,
          note: true,
          platform: true,
          status: true,
          reviewNote: true,
          createdAt: true,
          reviewedAt: true,
        },
      }),
      this.prisma.userSubmission.count({ where }),
    ]);
    const nicknameMap = await this.nicknameMap(rows.map((row) => Number(row.userId)));
    return buildPageResult(
      rows.map((row) => ({
        ...this.toItem(row),
        userId: Number(row.userId),
        nickname: nicknameMap.get(Number(row.userId)) ?? '未知用户',
        platform: row.platform,
      })),
      total,
      page,
      pageSize,
    );
  }

  /** 后台：审核（通过 / 驳回）。只处理 pending，重复审核直接拒绝。 */
  async review(id: number, dto: ReviewSubmissionDto): Promise<void> {
    const row = await this.prisma.userSubmission.findUnique({
      where: { id: BigInt(id) },
      select: { id: true, status: true },
    });
    if (!row) {
      throw AppException.notFound('投稿不存在');
    }
    if (row.status !== 'pending') {
      throw AppException.badRequest('该投稿已审核过');
    }
    await this.prisma.userSubmission.update({
      where: { id: row.id },
      data: {
        status: dto.action === 'approve' ? 'approved' : 'rejected',
        reviewNote: dto.note?.trim() || null,
        reviewedAt: new Date(),
      },
    });
  }

  /** 行 → 用户端条目。 */
  private toItem(row: {
    id: bigint;
    sentenceEn: string;
    translationZh: string;
    note: string | null;
    status: string;
    reviewNote: string | null;
    createdAt: Date;
    reviewedAt: Date | null;
  }): SubmissionItem {
    return {
      id: Number(row.id),
      sentenceEn: row.sentenceEn,
      translationZh: row.translationZh,
      note: row.note,
      status: row.status as SubmissionItem['status'],
      reviewNote: row.reviewNote,
      createdAt: row.createdAt.toISOString(),
      reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    };
  }

  /** 批量取昵称（投稿列表都要显示作者，逐条查会 N+1）。 */
  private async nicknameMap(userIds: number[]): Promise<Map<number, string>> {
    const ids = [...new Set(userIds)];
    if (ids.length === 0) {
      return new Map();
    }
    const users = await this.prisma.clientUser.findMany({
      where: { id: { in: ids.map((id) => BigInt(id)) } },
      select: { id: true, nickname: true },
    });
    return new Map(users.map((item) => [Number(item.id), item.nickname]));
  }
}
