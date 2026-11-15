/**
 * 学习小队控制器（/api/client/team）。
 * 权限口径：需登录（client 令牌），数据按 userId 隔离。
 *
 * 组队三入口：随机匹配（match）/ 自建队伍（create，拿组队码）/ 凭码加入（join）。
 * 队伍内群聊（messages）：游标分页、引用、2 分钟内撤回；记录仅保留 30 天。
 */
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import type { ResponseEnvelope } from '../../../common/http/response.interceptor.js';
import type { ClientUserContext } from '../../../common/types.js';
import { CreateTeamDto, JoinTeamDto, RenameTeamDto, SendTeamMessageDto, TEAM_MESSAGE_PAGE_MAX } from './team.dto.js';
import { TeamService, type TeamMessagePage, type TeamMessageView, type TeamView } from './team.service.js';

@Controller('client/team')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  /** 我的小队（无队伍返回 null，前端显示「找队友」入口）。 */
  @Get('my')
  my(@CurrentClientUser() user: ClientUserContext): Promise<TeamView | null> {
    return this.team.getMyTeam(user.userId);
  }

  /** 找队友：按近 7 天练习节奏随机匹配，或新建一个随机等待池。 */
  @Post('match')
  match(@CurrentClientUser() user: ClientUserContext): Promise<TeamView> {
    return this.team.match(user.userId);
  }

  /** 自建队伍：创建一个新小队并生成组队码（创建者为队长）。 */
  @Post('create')
  create(@CurrentClientUser() user: ClientUserContext, @Body() dto: CreateTeamDto): Promise<TeamView> {
    return this.team.create(user.userId, dto.name);
  }

  /** 凭组队码加入小队。 */
  @Post('join')
  join(@CurrentClientUser() user: ClientUserContext, @Body() dto: JoinTeamDto): Promise<TeamView> {
    return this.team.joinByCode(user.userId, dto.code);
  }

  /** 退出小队（可重新匹配）。 */
  @Post('leave')
  async leave(@CurrentClientUser() user: ClientUserContext): Promise<ResponseEnvelope<{ left: boolean }>> {
    await this.team.leave(user.userId);
    return { __raw: true, data: { left: true }, message: '已退出小队' };
  }

  /** 修改小队名（任意成员可改，改完全队可见）。 */
  @Patch('name')
  rename(@CurrentClientUser() user: ClientUserContext, @Body() dto: RenameTeamDto): Promise<TeamView> {
    return this.team.rename(user.userId, dto.name);
  }

  /**
   * 修改小队名（POST 别名）。
   *
   * 微信小程序的 `wx.request` **不支持 PATCH**，只能 GET/POST/PUT/DELETE，
   * 故为小程序留一条等价入口；Web / Android 继续用上面的 PATCH（语义更准确）。
   */
  @Post('name')
  renameByPost(@CurrentClientUser() user: ClientUserContext, @Body() dto: RenameTeamDto): Promise<TeamView> {
    return this.team.rename(user.userId, dto.name);
  }

  /** 群聊消息游标分页（最近 30 天）；before = 上一页最老消息 id。 */
  @Get('messages')
  messages(
    @CurrentClientUser() user: ClientUserContext,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ): Promise<TeamMessagePage> {
    const beforeId = before ? Number(before) : undefined;
    const size = limit ? Math.min(TEAM_MESSAGE_PAGE_MAX, Number(limit) || 30) : undefined;
    return this.team.listMessages(user.userId, beforeId, size);
  }

  /** 发送群聊消息（可带 quoteId 引用某条）。 */
  @Post('messages')
  sendMessage(@CurrentClientUser() user: ClientUserContext, @Body() dto: SendTeamMessageDto): Promise<TeamMessageView> {
    return this.team.sendMessage(user.userId, dto);
  }

  /** 撤回自己的消息（2 分钟内）。 */
  @Post('messages/:id/recall')
  recall(
    @CurrentClientUser() user: ClientUserContext,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TeamMessageView> {
    return this.team.recall(user.userId, id);
  }
}
