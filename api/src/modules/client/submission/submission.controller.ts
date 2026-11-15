/**
 * 投稿控制器（/api/client/submissions）。
 * 权限口径：需登录（client 令牌）；「我的投稿」按 userId 隔离，精选对所有登录用户可见。
 */
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import { type ResponseEnvelope } from '../../../common/http/response.interceptor.js';
import type { ClientUserContext } from '../../../common/types.js';
import { CreateSubmissionDto } from './dto.js';
import { SubmissionService } from './submission.service.js';

@Controller('client/submissions')
export class SubmissionController {
  constructor(private readonly submissions: SubmissionService) {}

  /** 提交一条投稿（英文句子 + 中文译文 + 可选附言）。 */
  @Post()
  async create(
    @CurrentClientUser() user: ClientUserContext,
    @Body() dto: CreateSubmissionDto,
  ): Promise<ResponseEnvelope<{ id: number }>> {
    const result = await this.submissions.create(user.userId, dto);
    return { __raw: true, data: result, message: '已收到投稿，审核通过后会出现在精选里' };
  }

  /** 我的投稿（含审核状态与驳回原因）。 */
  @Get('mine')
  mine(@CurrentClientUser() user: ClientUserContext, @Query() query: Record<string, unknown>) {
    return this.submissions.mine(user.userId, query);
  }

  /** 投稿精选（只含审核通过的；登录可见）。 */
  @Get('featured')
  featured(@Query() query: Record<string, unknown>) {
    return this.submissions.featured(query);
  }
}
