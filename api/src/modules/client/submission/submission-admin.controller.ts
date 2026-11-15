/**
 * 投稿后台控制器（/api/submissions）。
 * 权限码：client:submission:list（查看）/ client:submission:review（审核）。
 * 超管直通；其他角色需要在「菜单管理」里配置对应菜单与权限。
 */
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { type ResponseEnvelope } from '../../../common/http/response.interceptor.js';
import { IdParamDto } from '../../../common/dto/id-param.dto.js';
import { RequirePermissions } from '../../../common/auth/permission.guard.js';
import { ReviewSubmissionDto } from './dto.js';
import { SubmissionService } from './submission.service.js';

@Controller('submissions')
export class SubmissionAdminController {
  constructor(private readonly submissions: SubmissionService) {}

  /** 投稿列表（按状态 / 关键词筛选）。 */
  @Get()
  @RequirePermissions('client:submission:list')
  list(@Query() query: Record<string, unknown>) {
    return this.submissions.list(query);
  }

  /** 审核：approve 进精选 / reject 驳回（可带原因，下发给投稿人）。 */
  @Post(':id/review')
  @RequirePermissions('client:submission:review')
  async review(@Param() params: IdParamDto, @Body() dto: ReviewSubmissionDto): Promise<ResponseEnvelope<null>> {
    await this.submissions.review(params.id, dto);
    return { __raw: true, data: null, message: dto.action === 'approve' ? '已通过' : '已驳回' };
  }
}
