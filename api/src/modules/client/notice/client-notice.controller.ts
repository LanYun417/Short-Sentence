/**
 * 客户端通知控制器（/api/client/notices）。
 * 权限口径：登录即可（client 令牌）；不使用权限码——公告是全员可见的公共内容，
 * 已读状态按 userId 天然隔离。
 */
import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import { type ResponseEnvelope } from '../../../common/http/response.interceptor.js';
import { IdParamDto } from '../../../common/dto/id-param.dto.js';
import type { ClientUserContext } from '../../../common/types.js';
import { ClientNoticeService } from './client-notice.service.js';

@Controller('client/notices')
export class ClientNoticeController {
  constructor(private readonly notices: ClientNoticeService) {}

  /** 我的通知列表（已发布；置顶优先，其次按发布时间倒序）。 */
  @Get()
  list(@CurrentClientUser() user: ClientUserContext, @Query() query: Record<string, unknown>) {
    return this.notices.listMine(user.userId, query);
  }

  /** 未读数（客户端红点）。 */
  @Get('unread-count')
  async unreadCount(@CurrentClientUser() user: ClientUserContext): Promise<{ count: number }> {
    return { count: await this.notices.unreadCount(user.userId) };
  }

  /** 标记单条已读（幂等，重复点不报错）。 */
  @Post(':id/read')
  async markRead(
    @CurrentClientUser() user: ClientUserContext,
    @Param() params: IdParamDto,
  ): Promise<ResponseEnvelope<null>> {
    await this.notices.markRead(user.userId, params.id);
    return { __raw: true, data: null, message: '已读' };
  }

  /** 全部标记已读。 */
  @Post('read-all')
  async markAllRead(@CurrentClientUser() user: ClientUserContext): Promise<ResponseEnvelope<{ count: number }>> {
    const count = await this.notices.markAllRead(user.userId);
    return { __raw: true, data: { count }, message: count > 0 ? `已读 ${count} 条` : '没有未读通知' };
  }
}

/** 供其它模块复用的类型导出。 */
export type { ClientNoticeItem } from './client-notice.service.js';
