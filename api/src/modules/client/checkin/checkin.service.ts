/**
 * 打卡服务（客户端）。
 * 模块职责：每日完成计数、连续天数（streak）计算、今日进度查询。
 */
import { Injectable } from '@nestjs/common';
import { config } from '../../../common/config/config.js';
import { PrismaService } from '../../../prisma/prisma.service.js';

/** 今日进度。 */
export interface TodayCheckin {
  /** 打卡日期（YYYY-MM-DD，本地时区） */
  date: string;
  doneCount: number;
  goalCount: number;
  streak: number;
  /** 是否已完成当日目标 */
  completed: boolean;
}

@Injectable()
export class CheckinService {
  constructor(private readonly prisma: PrismaService) {}

  /** 查询今日进度（无记录时返回零值，不落库）。 */
  async getToday(userId: number): Promise<TodayCheckin | null> {
    const date = this.today();
    const row = await this.prisma.userCheckin.findUnique({
      where: { userId_checkinDate: { userId: BigInt(userId), checkinDate: date } },
      select: { doneCount: true, goalCount: true, streak: true },
    });
    if (!row) {
      return null;
    }
    return {
      date,
      doneCount: row.doneCount,
      goalCount: row.goalCount,
      streak: row.streak,
      completed: row.doneCount >= row.goalCount,
    };
  }

  /** 记录一次作答（upsert 今日打卡行；streak 在「当天首次作答」时结算）。 */
  async recordAnswer(userId: number): Promise<void> {
    const date = this.today();
    const goal = config.sentence.dailyGoal;
    const existing = await this.prisma.userCheckin.findUnique({
      where: { userId_checkinDate: { userId: BigInt(userId), checkinDate: date } },
      select: { id: true, doneCount: true },
    });
    if (existing) {
      await this.prisma.userCheckin.update({
        where: { id: existing.id },
        data: { doneCount: existing.doneCount + 1 },
      });
      return;
    }
    // 当天首次作答：streak = 昨天有打卡 ? 昨天 streak + 1 : 1
    const yesterday = await this.prisma.userCheckin.findUnique({
      where: { userId_checkinDate: { userId: BigInt(userId), checkinDate: this.shiftDate(date, -1) } },
      select: { streak: true },
    });
    await this.prisma.userCheckin.create({
      data: {
        userId: BigInt(userId),
        checkinDate: date,
        doneCount: 1,
        goalCount: goal,
        streak: yesterday ? yesterday.streak + 1 : 1,
      },
    });
  }

  /** 打卡（幂等；返回 streak）。 */
  async checkin(userId: number): Promise<TodayCheckin> {
    const date = this.today();
    await this.recordAnswer(userId);
    const row = await this.prisma.userCheckin.findUnique({
      where: { userId_checkinDate: { userId: BigInt(userId), checkinDate: date } },
      select: { doneCount: true, goalCount: true, streak: true },
    });
    if (!row) {
      // recordAnswer 刚写入，理论上必然存在；防御性兜底
      return { date, doneCount: 0, goalCount: config.sentence.dailyGoal, streak: 1, completed: false };
    }
    return {
      date,
      doneCount: row.doneCount,
      goalCount: row.goalCount,
      streak: row.streak,
      completed: row.doneCount >= row.goalCount,
    };
  }

  /** 本地时区的今天（YYYY-MM-DD）。 */
  private today(): string {
    return this.formatDate(new Date());
  }

  /** 日期字符串平移（YYYY-MM-DD → YYYY-MM-DD）。 */
  private shiftDate(date: string, days: number): string {
    const base = new Date(`${date}T00:00:00`);
    base.setDate(base.getDate() + days);
    return this.formatDate(base);
  }

  /** 格式化为本地时区日期串。 */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
