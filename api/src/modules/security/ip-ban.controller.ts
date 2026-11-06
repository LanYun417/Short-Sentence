/**
 * IP 黑名单管理控制器（后台 /api/ip-ban）。
 * 模块职责：封禁记录分页查询、人工封禁、解封、概览统计。仅后台 RBAC 可见。
 *
 * 权限码（需在菜单里授权给相应角色）：
 * - `ip:ban:list`   查看封禁列表与统计
 * - `ip:ban:add`    人工封禁 IP
 * - `ip:ban:remove` 解封 IP
 */
import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { type ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { IpBanService, type IpBanRecord } from '../../common/security/ip-ban.service.js';
import { AppException } from '../../common/exception/app.exception.js';
import type { AuthenticatedRequest } from '../../common/auth/auth.guard.js';

/** 封禁列表查询参数。 */
export class IpBanQueryDto {
  @Type(() => Number)
  @IsInt({ message: '页码必须为整数' })
  @Min(1, { message: '页码最小为 1' })
  page = 1;

  @Type(() => Number)
  @IsInt({ message: '每页条数必须为整数' })
  @Min(1, { message: '每页条数最小为 1' })
  @Max(100, { message: '每页条数最大为 100' })
  pageSize = 10;

  /** IP 模糊检索 */
  @IsOptional()
  @IsString({ message: '关键词必须为字符串' })
  keyword?: string;

  /** 仅看生效中 */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  activeOnly?: boolean;
}

/** 人工封禁入参。 */
export class CreateIpBanDto {
  /** 目标 IP（IPv4 / IPv6） */
  @IsString({ message: 'IP 不能为空' })
  ip!: string;

  /** 封禁原因 */
  @IsOptional()
  @IsString({ message: '原因必须为字符串' })
  reason?: string;

  /**
   * 封禁时长（小时）；0 = 永久。
   * 注意：与自动封禁不同，人工封禁默认 24 小时，超长需显式指定。
   */
  @Type(() => Number)
  @IsInt({ message: '封禁时长须为整数' })
  @Min(0, { message: '封禁时长不能小于 0' })
  @Max(8760, { message: '封禁时长不能超过 8760 小时（1 年）' })
  hours = 24;
}

@Controller('ip-ban')
export class IpBanController {
  constructor(private readonly ipBan: IpBanService) {}

  /** 封禁记录分页列表。 */
  @Get()
  @RequirePermissions('ip:ban:list')
  async list(@Query() query: IpBanQueryDto): Promise<ResponseEnvelope<{ list: IpBanRecord[]; total: number }>> {
    const result = await this.ipBan.list({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword?.trim() || undefined,
      activeOnly: query.activeOnly,
    });
    return { __raw: true, data: result, message: 'ok' };
  }

  /** 概览统计。 */
  @Get('stats')
  @RequirePermissions('ip:ban:list')
  async stats(): Promise<ResponseEnvelope<{ total: number; active: number; autoActive: number }>> {
    const data = await this.ipBan.stats();
    return { __raw: true, data, message: 'ok' };
  }

  /** 人工封禁 IP。 */
  @Post()
  @RequirePermissions('ip:ban:add')
  @OperationLog('IP黑名单', '人工封禁')
  async add(@Body() dto: CreateIpBanDto, @Req() req: AuthenticatedRequest): Promise<ResponseEnvelope<IpBanRecord>> {
    const ip = dto.ip.trim();
    if (!ip) {
      throw AppException.badRequest('IP 不能为空');
    }
    const reason = dto.reason?.trim() || '人工封禁';
    const record = await this.ipBan.ban(ip, {
      reason,
      type: 'manual',
      scope: 'manual',
      operator: req.user?.username ?? 'admin',
      hours: dto.hours,
    });
    return { __raw: true, data: record, message: '已封禁' };
  }

  /** 解封 IP。 */
  @Delete(':ip')
  @RequirePermissions('ip:ban:remove')
  @OperationLog('IP黑名单', '解封')
  async remove(@Param('ip') ip: string, @Req() req: AuthenticatedRequest): Promise<ResponseEnvelope<null>> {
    if (!ip) {
      throw AppException.badRequest('IP 不能为空');
    }
    await this.ipBan.unban(decodeURIComponent(ip), req.user?.username ?? 'admin');
    return { __raw: true, data: null, message: '已解封' };
  }
}
