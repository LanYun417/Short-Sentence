/**
 * 弱连接学习小队控制器（/api/client/team）。
 * 权限口径：需登录（client 令牌），数据按 userId 隔离；队员之间只暴露昵称与打卡状态。
 */
import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import type { ResponseEnvelope } from '../../../common/http/response.interceptor.js';
import type { ClientUserContext } from '../../../common/types.js';
import { RenameTeamDto } from './team.dto.js';
import { TeamService, type TeamView } from './team.service.js';

@Controller('client/team')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  /** 我的小队（无队伍返回 null，前端显示「找队友」入口）。 */
  @Get('my')
  my(@CurrentClientUser() user: ClientUserContext): Promise<TeamView | null> {
    return this.team.getMyTeam(user.userId);
  }

  /** 找队友：按近 7 天练习节奏匹配陌生队友，或新建一个等待池。 */
  @Post('match')
  match(@CurrentClientUser() user: ClientUserContext): Promise<TeamView> {
    return this.team.match(user.userId);
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
}
