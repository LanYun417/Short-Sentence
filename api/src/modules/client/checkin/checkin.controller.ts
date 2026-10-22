/**
 * 打卡控制器（/api/client/checkin）。
 */
import { Controller, Get, Post } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import { type ResponseEnvelope } from '../../../common/http/response.interceptor.js';
import type { ClientUserContext } from '../../../common/types.js';
import { CheckinService, type TodayCheckin } from './checkin.service.js';

@Controller('client/checkin')
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  /** 今日进度。 */
  @Get('today')
  async today(@CurrentClientUser() user: ClientUserContext): Promise<TodayCheckin> {
    return (
      (await this.checkinService.getToday(user.userId)) ?? {
        date: '',
        doneCount: 0,
        goalCount: 0,
        streak: 0,
        completed: false,
      }
    );
  }

  /** 打卡（幂等；返回海报数据）。 */
  @Post()
  async checkin(@CurrentClientUser() user: ClientUserContext): Promise<ResponseEnvelope<unknown>> {
    const result = await this.checkinService.checkin(user.userId);
    return { __raw: true, data: result, message: result.completed ? '今日目标已完成' : '已打卡' };
  }
}
