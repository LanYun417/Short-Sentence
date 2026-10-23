/**
 * 举报/反馈控制器（/api/client/report）。
 * 权限口径：需登录（client 令牌）；不使用权限码，按 userId 记录举报人。
 */
import { Body, Controller, Post } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import { type ResponseEnvelope } from '../../../common/http/response.interceptor.js';
import type { ClientUserContext } from '../../../common/types.js';
import { ReportService } from './report.service.js';
import { CreateReportDto } from './dto.js';

@Controller('client/report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  /** 提交举报/反馈。 */
  @Post()
  async create(
    @CurrentClientUser() user: ClientUserContext,
    @Body() dto: CreateReportDto,
  ): Promise<ResponseEnvelope<{ id: number }>> {
    const result = await this.reportService.create(user.userId, dto);
    return { __raw: true, data: result, message: '已收到，感谢你的反馈' };
  }
}
