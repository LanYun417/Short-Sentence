/**
 * 客户端公告管理控制器（/api/client-notices，后台运营用）。
 *
 * 路径刻意**不复用 `/notices`**：`NoticeController` 上已有 `DELETE /notices/:id`，
 * 再挂 `/notices/client` 会被 `:id` 吃掉（Nest 按声明顺序匹配），排查成本高；
 * 独立资源名最省心。
 *
 * 权限码沿用 `client:*` 前缀（与 `client:user:*` 一致），随菜单种子一起下发。
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { CurrentUser } from '../../common/auth/auth.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { type ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { AppException } from '../../common/exception/app.exception.js';
import type { AuthUserContext } from '../../common/types.js';
import {
  ADMIN_CLIENT_NOTICE_STATUS,
  ADMIN_CLIENT_NOTICE_TYPE,
  AdminClientNoticeService,
} from './client-notice.service.js';

/** 新增/编辑公告入参。 */
export class SaveClientNoticeDto {
  @IsString({ message: '标题必须为字符串' })
  @MinLength(1, { message: '标题不能为空' })
  @MaxLength(200, { message: '标题最长 200 个字符' })
  title!: string;

  @IsString({ message: '正文必须为字符串' })
  @MinLength(1, { message: '正文不能为空' })
  @MaxLength(2000, { message: '正文最长 2000 个字符' })
  content!: string;

  @Type(() => Number)
  @IsInt({ message: '通知类型必须为整数' })
  @IsEnum(Object.values(ADMIN_CLIENT_NOTICE_TYPE) as number[], { message: '通知类型非法' })
  noticeType!: number;

  /** 点击跳转的客户端路由（可空） */
  @IsOptional()
  @IsString({ message: '跳转链接必须为字符串' })
  @MaxLength(255, { message: '跳转链接最长 255 个字符' })
  link?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '置顶标记必须为整数' })
  @IsIn([0, 1], { message: '置顶只能是 0 或 1' })
  pinned?: number;

  /** 保存后是否立即发布（缺省 true；false = 存草稿） */
  @IsOptional()
  publish?: boolean;
}

/** 发布状态切换入参。 */
export class SetClientNoticeStatusDto {
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  @IsIn([ADMIN_CLIENT_NOTICE_STATUS.PUBLISHED, ADMIN_CLIENT_NOTICE_STATUS.WITHDRAWN], {
    message: '只允许发布(1)或撤回(2)',
  })
  status!: 1 | 2;
}

@Controller('client-notices')
export class ClientNoticeAdminController {
  constructor(private readonly notices: AdminClientNoticeService) {}

  /** 公告列表（含草稿/已撤回，带已读人数）。 */
  @Get()
  @RequirePermissions('client:notice:list')
  list(@Query() query: Record<string, unknown>) {
    return this.notices.list(query);
  }

  /** 发布公告。 */
  @Post()
  @RequirePermissions('client:notice:add')
  @OperationLog('客户端通知', '发布公告')
  async create(
    @Body() dto: SaveClientNoticeDto,
    @CurrentUser() user: AuthUserContext,
  ): Promise<ResponseEnvelope<{ id: number }>> {
    const result = await this.notices.create(this.normalize(dto), user.userId);
    return { __raw: true, data: result, message: dto.publish === false ? '已存为草稿' : '已发布' };
  }

  /** 编辑公告。 */
  @Put(':id')
  @RequirePermissions('client:notice:edit')
  @OperationLog('客户端通知', '编辑公告')
  async update(@Param() params: IdParamDto, @Body() dto: SaveClientNoticeDto): Promise<ResponseEnvelope<null>> {
    await this.notices.update(params.id, this.normalize(dto));
    return { __raw: true, data: null, message: '保存成功' };
  }

  /** 发布 / 撤回。 */
  @Put(':id/status')
  @RequirePermissions('client:notice:edit')
  @OperationLog('客户端通知', '发布/撤回公告')
  async setStatus(@Param() params: IdParamDto, @Body() dto: SetClientNoticeStatusDto): Promise<ResponseEnvelope<null>> {
    await this.notices.setStatus(params.id, dto.status);
    return {
      __raw: true,
      data: null,
      message: dto.status === ADMIN_CLIENT_NOTICE_STATUS.PUBLISHED ? '已发布' : '已撤回',
    };
  }

  /** 删除公告。 */
  @Delete(':id')
  @RequirePermissions('client:notice:remove')
  @OperationLog('客户端通知', '删除公告')
  async remove(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    await this.notices.remove(params.id);
    return { __raw: true, data: null, message: '已删除' };
  }

  /** 统一 trim，并拦掉「只有空白」的内容（DTO 的 MinLength 挡不住空格）。 */
  private normalize(dto: SaveClientNoticeDto): {
    title: string;
    content: string;
    noticeType: number;
    link?: string;
    pinned?: number;
    publish?: boolean;
  } {
    const title = dto.title.trim();
    const content = dto.content.trim();
    if (!title) {
      throw AppException.badRequest('标题不能为空');
    }
    if (!content) {
      throw AppException.badRequest('正文不能为空');
    }
    const link = dto.link?.trim();
    return {
      title,
      content,
      noticeType: dto.noticeType,
      link: link ? link.slice(0, 255) : undefined,
      pinned: dto.pinned ?? 0,
      publish: dto.publish,
    };
  }
}
