/**
 * 音标学习控制器（/api/client/ipa）。
 * 权限口径：需登录（client 令牌）；数据按 userId 隔离。
 */
import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import type { ClientUserContext } from '../../../common/types.js';
import { IpaService } from './ipa.service.js';
import { IpaLearnedDto } from './dto.js';

@Controller('client/ipa')
export class IpaController {
  constructor(private readonly ipa: IpaService) {}

  /** 音标库（分组分发；与进度同源，统一走 client 令牌鉴权）。 */
  @Get('phonemes')
  listPhonemes() {
    return this.ipa.listPhonemes();
  }

  /** 我的进度（已学会数）。 */
  @Get('progress')
  progress(@CurrentClientUser() user: ClientUserContext) {
    return this.ipa.progress(user.userId);
  }

  /** 标记某个音标「学会了」（首次发 XP）。 */
  @Post('learned')
  markLearned(@CurrentClientUser() user: ClientUserContext, @Body() dto: IpaLearnedDto) {
    return this.ipa.markLearned(user.userId, dto);
  }
}
