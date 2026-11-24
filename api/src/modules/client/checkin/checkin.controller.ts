/**
 * 打卡控制器（/api/client/checkin）。
 */
import { Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import { type ResponseEnvelope } from '../../../common/http/response.interceptor.js';
import type { ClientUserContext } from '../../../common/types.js';
import { CheckinService, type CheckinHistoryDay, type TodayCheckin } from './checkin.service.js';

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

  /** 最近 N 天打卡记录（学习热力图数据源；days 夹在 1~400，默认 371 天 ≈ 53 周）。 */
  @Get('history')
  async history(
    @CurrentClientUser() user: ClientUserContext,
    @Query('days') days?: string,
  ): Promise<CheckinHistoryDay[]> {
    return this.checkinService.getHistory(user.userId, days ? Number(days) : undefined);
  }

  /** 打卡（幂等；返回海报数据）。 */
  @Post()
  async checkin(@CurrentClientUser() user: ClientUserContext): Promise<ResponseEnvelope<unknown>> {
    const result = await this.checkinService.checkin(user.userId);
    return { __raw: true, data: result, message: result.completed ? '今日目标已完成' : '已打卡' };
  }
}
