/**
 * 产品反馈服务（客户端）。
 * 模块职责：接收用户对**产品本身**的意见并落库，供运营在后台核查处理；
 * 同时提供「我的反馈」列表，让用户看到自己提的意见被回应（回复由后台填写）。
 */
import { Injectable } from '@nestjs/common';
import type { Express } from 'express';
import { AppException } from '../../../common/exception/app.exception.js';
import { buildPageResult, parsePagination } from '../../../common/utils/utils.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { FileService } from '../../../common/file/file.service.js';
import type { PageResult } from '../../../common/types.js';
import type { CreateFeedbackDto } from './dto.js';

/** 用户端可见的反馈项（含运营回复；内部备注 handleNote 刻意不下发）。 */
export interface MyFeedbackItem {
  id: number;
  type: string;
  content: string;
  /** 反馈图片 URL 列表（最多 5 张；空数组 = 无图） */
  images: string[];
  /** pending 待处理 / resolved 已处理 / dismissed 已驳回 */
  status: string;
  /** 运营回复（空 = 尚未回复） */
  reply: string | null;
  handledAt: string | null;
  createdAt: string;
}

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

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  /** 提交反馈（文本 + 图片）。 */
  async create(userId: number, dto: CreateFeedbackDto, files: Express.Multer.File[]): Promise<{ id: number }> {
    // DTO 的 MinLength 挡不住「全是空格」的内容
    const content = dto.content.trim();
    if (!content) {
      throw AppException.badRequest('反馈内容不能为空');
    }
    // 仅接受图片：multer 已按白名单校验类型，这里再拦掉非 image/* 的混入
    const imageFiles = files.filter((file) => file.mimetype.startsWith('image/'));
    if (imageFiles.length !== files.length) {
      throw AppException.badRequest('反馈图片仅支持图片格式');
    }
    // 最多 5 张（multer 的 FilesInterceptor('images', 5) 已兜底，这里再显式约束）
    if (imageFiles.length > 5) {
      throw AppException.badRequest('最多上传 5 张图片');
    }
    const imageUrls = imageFiles.length
      ? (
          await Promise.all(
            imageFiles.map((file) => this.fileService.save(file.originalname, file.mimetype, file.buffer, userId)),
          )
        ).map((result) => result.file.fileUrl)
      : [];

    const row = await this.prisma.clientFeedback.create({
      data: {
        userId: BigInt(userId),
        type: dto.type,
        content: content.slice(0, 1000),
        contact: dto.contact?.trim() || null,
        platform: dto.platform ?? 'web',
        appVersion: dto.appVersion?.trim() || null,
        images: imageUrls.length ? JSON.stringify(imageUrls) : null,
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
          images: true,
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
        images: parseImages(row.images),
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
