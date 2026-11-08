/**
 * AI 私教控制器（/api/client/ai/coach）。
 * 权限口径：需登录（client 令牌），数据按 userId 隔离；响应为普通 JSON 信封。
 *
 * 与现有 /client/ai/* 的 SSE 端点刻意分开：私教画像是一次性查询、AI 点评是短文本，
 * 都不需要流式传输，前端一个 GET / POST 即可，也避免改动 ClientAiController 的 SSE 逻辑。
 */
import { Controller, Get, Post } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import type { ClientUserContext } from '../../../common/types.js';
import { ClientCoachService, type CoachAdvice, type CoachProfile } from './coach.service.js';

@Controller('client/ai/coach')
export class ClientCoachController {
  constructor(private readonly coach: ClientCoachService) {}

  /** 薄弱点画像 + 今日复习计划（纯计算、始终可用、不消耗 AI 额度）。 */
  @Get('profile')
  profile(@CurrentClientUser() user: ClientUserContext): Promise<CoachProfile> {
    return this.coach.profile(user.userId);
  }

  /** AI 点评（可选增强；不可用时自动降级为规则文案，永远 200）。 */
  @Post('advice')
  advice(@CurrentClientUser() user: ClientUserContext): Promise<CoachAdvice> {
    return this.coach.advice(user.userId);
  }
}
