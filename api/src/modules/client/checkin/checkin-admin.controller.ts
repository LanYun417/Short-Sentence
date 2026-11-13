/**
 * 打卡管理控制器（/api/checkins）——运营后台用。
 *
 * 与客户端控制器共用同一个 `CheckinService`（streak 口径只有一份）。
 * 只读：日历统计 + 记录审计；写操作：补签 / 撤销（幂等 + 重算 streak + @OperationLog 审计）。
 *
 * 权限码 sentence:checkin / sentence:checkin:handle（超管直通）。
 */
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../../../common/auth/permission.guard.js';
import { OperationLog } from '../../../common/log/operation-log.decorator.js';
import type { ResponseEnvelope } from '../../../common/http/response.interceptor.js';
import { buildPageResult, parsePagination, readNumber, readString } from '../../../common/utils/utils.js';
import { CheckinBackfillDto } from './dto.js';
import { CheckinService } from './checkin.service.js';

@Controller('checkins')
export class CheckinAdminController {
  constructor(private readonly checkin: CheckinService) {}

  /** 近 N 天打卡日历统计（热力图）+ 今日汇总 + 启用用户总数。 */
  @Get('stats')
  @RequirePermissions('sentence:checkin')
  stats(@Query() query: Record<string, unknown>) {
    return this.checkin.adminStats(readNumber(query.days) ?? 30);
  }

  /** 打卡记录分页审计（关键字 / 日期范围 / 是否完成）。 */
  @Get('records')
  @RequirePermissions('sentence:checkin')
  async records(@Query() query: Record<string, unknown>) {
    const { page, pageSize } = parsePagination(query);
    const { list, total } = await this.checkin.adminRecords({
      keyword: readString(query.keyword),
      dateFrom: readString(query.dateFrom),
      dateTo: readString(query.dateTo),
      completed: readString(query.completed),
      page,
      pageSize,
    });
    return buildPageResult(list, total, page, pageSize);
  }

  /** 补签：把某天 doneCount 补到目标值并重算连续天数（幂等）。 */
  @Post('backfill')
  @RequirePermissions('sentence:checkin:handle')
  @OperationLog('打卡管理', '补签')
  async backfill(@Body() dto: CheckinBackfillDto): Promise<ResponseEnvelope<unknown>> {
    const result = await this.checkin.adminBackfill(dto.email, dto.date);
    return { __raw: true, data: result, message: result.created ? '已补签' : '当日已有记录，已补齐目标' };
  }

  /** 撤销某天打卡（幂等；删行后重算连续天数）。 */
  @Post('revoke')
  @RequirePermissions('sentence:checkin:handle')
  @OperationLog('打卡管理', '撤销打卡')
  async revoke(@Body() dto: CheckinBackfillDto): Promise<ResponseEnvelope<unknown>> {
    const result = await this.checkin.adminRevoke(dto.email, dto.date);
    return { __raw: true, data: result, message: result.revoked ? '已撤销' : '当日无打卡记录' };
  }
}
