/**
 * 举报处理控制器（/api/reports）。
 * 权限口径：RBAC 权限码 sentence:report / sentence:report:handle（超管直通）；写操作 @OperationLog 留痕。
 */
import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { type ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { buildPageResult, parsePagination } from '../../common/utils/utils.js';
import { ReportService } from './report.service.js';
import { HandleReportDto } from './report.dto.js';

@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  /** 分页列表（筛选：status/reason/keyword）。 */
  @Get()
  @RequirePermissions('sentence:report')
  async list(@Query() query: Record<string, unknown>) {
    const { page, pageSize } = parsePagination(query);
    const { list, total } = await this.reportService.list(query);
    return buildPageResult(list, total, page, pageSize);
  }

  /** 处理举报（标记已处理/已驳回 + 备注）。 */
  @Put(':id')
  @RequirePermissions('sentence:report:handle')
  @OperationLog('题库管理', '处理举报')
  async handle(@Param() params: IdParamDto, @Body() dto: HandleReportDto): Promise<ResponseEnvelope<null>> {
    await this.reportService.handle(params.id, dto);
    return { __raw: true, data: null, message: '已处理' };
  }
}
