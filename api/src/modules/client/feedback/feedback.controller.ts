/**
 * 产品反馈控制器（/api/client/feedback）。
 * 权限口径：需登录（client 令牌）；不使用权限码，按 userId 记录提交人。
 */
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import { type ResponseEnvelope } from '../../../common/http/response.interceptor.js';
import type { ClientUserContext } from '../../../common/types.js';
import { FeedbackService } from './feedback.service.js';
import { CreateFeedbackDto } from './dto.js';

@Controller('client/feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  /** 提交产品反馈。 */
  @Post()
  async create(
    @CurrentClientUser() user: ClientUserContext,
    @Body() dto: CreateFeedbackDto,
  ): Promise<ResponseEnvelope<{ id: number }>> {
    const result = await this.feedbackService.create(user.userId, dto);
    return { __raw: true, data: result, message: '已收到你的反馈，感谢！' };
  }

  /** 我的反馈（含处理状态与运营回复）。 */
  @Get('mine')
  mine(@CurrentClientUser() user: ClientUserContext, @Query() query: Record<string, unknown>) {
    return this.feedbackService.mine(user.userId, query);
  }
}
