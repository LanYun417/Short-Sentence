/**
 * 学习小队管理控制器（/api/teams）——运营后台用。
 *
 * 与客户端 TeamController 共用同一个 TeamService，放在同一目录。
 * 路由 /api/teams 与客户端 /api/client/team 不冲突。
 *
 * 权限码：team:view（查询）/ team:handle（解散、改名，超管直通）。
 */
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { RequirePermissions } from '../../../common/auth/permission.guard.js';
import { OperationLog } from '../../../common/log/operation-log.decorator.js';
import type { ResponseEnvelope } from '../../../common/http/response.interceptor.js';
import { IdParamDto } from '../../../common/dto/id-param.dto.js';
import { buildPageResult, parsePagination } from '../../../common/utils/utils.js';
import { RenameTeamDto } from './team.dto.js';
import { TeamService, type TeamAdminDetail, type TeamAdminStats } from './team.service.js';

@Controller('teams')
export class TeamAdminController {
  constructor(private readonly team: TeamService) {}

  /** 概览统计（进行中/已解散小队数、在队用户数、今日全员达成数）。 */
  @Get('stats')
  @RequirePermissions('team:view')
  stats(): Promise<TeamAdminStats> {
    return this.team.adminStats();
  }

  /** 小队分页列表（筛选：status / keyword=队名 / minMembers）。 */
  @Get()
  @RequirePermissions('team:view')
  async list(@Query() query: Record<string, unknown>) {
    const { page, pageSize } = parsePagination(query);
    const { list, total } = await this.team.adminList(query);
    return buildPageResult(list, total, page, pageSize);
  }

  /** 小队详情：成员 + 今日打卡状态。 */
  @Get(':id')
  @RequirePermissions('team:view')
  detail(@Param() params: IdParamDto): Promise<TeamAdminDetail> {
    return this.team.adminDetail(params.id);
  }

  /** 解散小队（清空成员，成员可重新匹配）。 */
  @Post(':id/dissolve')
  @RequirePermissions('team:handle')
  @OperationLog('学习小队', '解散小队')
  async dissolve(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    await this.team.adminDissolve(params.id);
    return { __raw: true, data: null, message: '已解散该小队' };
  }

  /** 运营改名（修正不当队名）。 */
  @Put(':id/name')
  @RequirePermissions('team:handle')
  @OperationLog('学习小队', '修改小队名')
  async rename(@Param() params: IdParamDto, @Body() dto: RenameTeamDto): Promise<ResponseEnvelope<null>> {
    await this.team.adminRename(params.id, dto.name);
    return { __raw: true, data: null, message: '已更新小队名' };
  }
}
