/**
 * 举报/反馈服务（客户端）。
 * 模块职责：接收用户对题目的举报/反馈（题目/翻译有误、内容或图片不适当等），
 * 落库供运营在后台核查处理。服务端只记录「谁举报了哪题的什么类型」，不做自动处置。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/exception/app.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { CreateReportDto } from './dto.js';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  /** 提交举报/反馈。 */
  async create(userId: number, dto: CreateReportDto): Promise<{ id: number }> {
    // 校验题目存在：避免对不存在/已删题目产生孤儿举报
    const sentence = await this.prisma.sentence.findUnique({
      where: { id: BigInt(dto.sentenceId) },
      select: { id: true },
    });
    if (!sentence) {
      throw AppException.notFound('题目不存在');
    }
    const row = await this.prisma.sentenceReport.create({
      data: {
        userId: BigInt(userId),
        sentenceId: BigInt(dto.sentenceId),
        reason: dto.reason,
        description: dto.description?.trim() || null,
      },
      select: { id: true },
    });
    return { id: Number(row.id) };
  }
}
