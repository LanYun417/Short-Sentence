/**
 * 客户端用户管理控制器（/api/client-users）。
 * 权限口径：RBAC 权限码 client:user:*（超管直通）；写操作留痕。
 */
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { type ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import type { PageResult } from '../../common/types.js';
import { ClientUsersService, type ClientUserDetail, type ClientUserItem } from './client-users.service.js';
import { ClientUserQueryDto, ClientUserResetPasswordDto, ClientUserStatusDto } from './dto.js';

@Controller('client-users')
export class ClientUsersController {
  constructor(private readonly clientUsers: ClientUsersService) {}

  /** 分页列表（关键词 / 状态 / 性别）。 */
  @Get()
  @RequirePermissions('client:user:list')
  list(@Query() query: ClientUserQueryDto): Promise<PageResult<ClientUserItem>> {
    return this.clientUsers.list(query as unknown as Record<string, unknown>);
  }

  /** 详情（含学习数据与最近答题）。 */
  @Get(':id')
  @RequirePermissions('client:user:query')
  detail(@Param() params: IdParamDto): Promise<ClientUserDetail> {
    return this.clientUsers.detail(params.id);
  }

  /** 启用 / 禁用。 */
  @Put(':id/status')
  @RequirePermissions('client:user:edit')
  @OperationLog('客户端用户', '修改状态')
  async setStatus(@Param() params: IdParamDto, @Body() dto: ClientUserStatusDto): Promise<ResponseEnvelope<null>> {
    await this.clientUsers.setStatus(params.id, dto.status);
    return { __raw: true, data: null, message: dto.status === 1 ? '已启用' : '已禁用' };
  }

  /** 重置密码（同时强制下线）。 */
  @Put(':id/password')
  @RequirePermissions('client:user:reset')
  @OperationLog('客户端用户', '重置密码')
  async resetPassword(
    @Param() params: IdParamDto,
    @Body() dto: ClientUserResetPasswordDto,
  ): Promise<ResponseEnvelope<null>> {
    await this.clientUsers.resetPassword(params.id, dto.newPassword);
    return { __raw: true, data: null, message: '密码已重置，用户需重新登录' };
  }

  /** 强制下线（不改密码，仅令旧令牌失效）。 */
  @Post(':id/offline')
  @RequirePermissions('client:user:offline')
  @OperationLog('客户端用户', '强制下线')
  async forceOffline(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    await this.clientUsers.forceOffline(params.id);
    return { __raw: true, data: null, message: '已强制下线' };
  }
}
