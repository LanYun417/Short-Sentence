/**
 * 句子接龙控制器（/api/client/chains）。
 * 权限口径：需登录（client 令牌）。作者身份不下发，只给按 userId 派生的匿名化名。
 */
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import type { ClientUserContext } from '../../../common/types.js';
import { CreateChainEntryDto, ReportChainEntryDto } from './chain.dto.js';
import { ChainService, type ChainEntryView, type ChainTopicDetail, type ChainTopicView } from './chain.service.js';

@Controller('client/chains')
export class ChainController {
  constructor(private readonly chains: ChainService) {}

  /** 接龙主题列表。 */
  @Get()
  list(@CurrentClientUser() user: ClientUserContext): Promise<ChainTopicView[]> {
    return this.chains.listTopics(user.userId);
  }

  /** 主题详情 + 接龙内容。 */
  @Get(':id')
  detail(@CurrentClientUser() user: ClientUserContext, @Param('id') id: string): Promise<ChainTopicDetail> {
    return this.chains.getTopic(user.userId, Number(id));
  }

  /** 提交一条续写。 */
  @Post(':id/entries')
  create(
    @CurrentClientUser() user: ClientUserContext,
    @Param('id') id: string,
    @Body() dto: CreateChainEntryDto,
  ): Promise<ChainEntryView> {
    return this.chains.createEntry(user.userId, Number(id), dto);
  }

  /** 点赞 / 取消点赞（同一入口，幂等）。 */
  @Post('entries/:entryId/like')
  like(
    @CurrentClientUser() user: ClientUserContext,
    @Param('entryId') entryId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    return this.chains.toggleLike(user.userId, Number(entryId));
  }

  /** 举报（一人一条一次，累计达阈值自动隐藏）。 */
  @Post('entries/:entryId/report')
  report(
    @CurrentClientUser() user: ClientUserContext,
    @Param('entryId') entryId: string,
    @Body() dto: ReportChainEntryDto,
  ): Promise<{ reportCount: number; hidden: boolean }> {
    return this.chains.report(user.userId, Number(entryId), dto.reason ?? 'inappropriate');
  }
}
