/**
 * 产品反馈处理控制器（/api/client-feedbacks，后台运营用）。
 *
 * 路径刻意与客户端侧 `/client/feedback` 区分（单复数 + 前缀不同）：
 * 一个是「我提意见」，一个是「运营处理意见」，混在同一路径下靠方法区分会很难读。
 * 权限码沿用 `client:*` 前缀（与 `client:notice:*` / `client:user:*` 一致），随菜单种子下发。
 */
import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { type ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { FeedbackService } from './feedback.service.js';
import { HandleFeedbackDto } from './feedback.dto.js';

@Controller('client-feedbacks')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  /** 反馈列表（筛选：status / type / platform / keyword）。 */
  @Get()
  @RequirePermissions('client:feedback:list')
  list(@Query() query: Record<string, unknown>) {
    return this.feedbackService.list(query);
  }

  /** 处理反馈（标记已处理/已驳回 + 回复 + 内部备注）。 */
  @Put(':id')
  @RequirePermissions('client:feedback:handle')
  @OperationLog('客户端反馈', '处理反馈')
  async handle(@Param() params: IdParamDto, @Body() dto: HandleFeedbackDto): Promise<ResponseEnvelope<null>> {
    await this.feedbackService.handle(params.id, dto);
    return { __raw: true, data: null, message: '已处理' };
  }
}
