/**
 * 成长体系管理控制器（/api/gamify）——运营后台用。
 *
 * 与客户端控制器共用同一个 `GamifyService`（发奖幂等口径只有一份）。
 * 成就只开放「展示字段编辑」（code 是主键 + 判定键，不可改，也不开放增删）；
 * XP 账本只读审计 + 手动**补偿**（只加不减红线：不提供扣减入口）。
 *
 * 权限码 sentence:gamify / sentence:gamify:edit / sentence:gamify:handle（超管直通）。
 */
import { Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { RequirePermissions } from '../../../common/auth/permission.guard.js';
import type { AuthenticatedRequest } from '../../../common/auth/auth.guard.js';
import { OperationLog } from '../../../common/log/operation-log.decorator.js';
import type { ResponseEnvelope } from '../../../common/http/response.interceptor.js';
import { buildPageResult, parsePagination, readString } from '../../../common/utils/utils.js';
import { GrantXpDto, UpdateAchievementDto } from './dto.js';
import { GamifyService } from './gamify.service.js';

/** code 作为路由参数（成就是字符串主键，不是数字 id）。 */
interface CodeParamDto {
  code: string;
}

@Controller('gamify')
export class GamifyAdminController {
  constructor(private readonly gamify: GamifyService) {}

  /** 成就列表（全部，含解锁人数）。 */
  @Get('achievements')
  @RequirePermissions('sentence:gamify')
  achievements() {
    return this.gamify.adminListAchievements();
  }

  /** 编辑成就展示字段（name/description/icon/category/rewardXp/sort；code 不可改）。 */
  @Put('achievements/:code')
  @RequirePermissions('sentence:gamify:edit')
  @OperationLog('成长管理', '编辑成就')
  async updateAchievement(
    @Param() params: CodeParamDto,
    @Body() dto: UpdateAchievementDto,
  ): Promise<ResponseEnvelope<null>> {
    await this.gamify.adminUpdateAchievement(params.code, dto);
    return { __raw: true, data: null, message: '已保存' };
  }

  /** XP 账本分页审计（关键字匹配用户邮箱/昵称；可按事件类型、日期范围筛选）。 */
  @Get('xp-logs')
  @RequirePermissions('sentence:gamify')
  async xpLogs(@Query() query: Record<string, unknown>) {
    const { page, pageSize } = parsePagination(query);
    const { list, total } = await this.gamify.adminXpLogs({
      keyword: readString(query.keyword),
      eventType: readString(query.eventType),
      dateFrom: readString(query.dateFrom),
      dateTo: readString(query.dateTo),
      page,
      pageSize,
    });
    return buildPageResult(list, total, page, pageSize);
  }

  /** 手动补偿 XP（只加不减：amount 恒为正；绕过每日上限但走唯一 event_key 幂等）。 */
  @Post('xp/grant')
  @RequirePermissions('sentence:gamify:handle')
  @OperationLog('成长管理', '手动补偿XP')
  async grantXp(
    @Body() dto: GrantXpDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ResponseEnvelope<{ granted: boolean; balance: number }>> {
    const result = await this.gamify.adminGrantXp(req.user?.userId ?? 0, dto);
    return { __raw: true, data: result, message: result.granted ? '已补偿' : '重复提交，未重复发放' };
  }

  /** 成长统计总览。 */
  @Get('stats')
  @RequirePermissions('sentence:gamify')
  stats() {
    return this.gamify.adminStats();
  }
}
