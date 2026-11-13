/**
 * 打卡服务（客户端）。
 * 模块职责：每日完成计数、连续天数（streak）计算、今日进度查询。
 */
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import { config } from '../../../common/config/config.js';
import { AppException } from '../../../common/exception/app.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { TeamService } from '../team/team.service.js';

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

/** 后台-某日打卡统计。 */
export interface CheckinDayStat {
  date: string;
  /** 当天有打卡记录的用户数 */
  total: number;
  /** 当天完成目标（doneCount >= goalCount）的用户数 */
  completed: number;
  rate: number;
}

/** 后台-打卡记录审计条目。 */
export interface CheckinAdminItem {
  id: number;
  userId: number;
  email: string;
  nickname: string;
  checkinDate: string;
  doneCount: number;
  goalCount: number;
  completed: boolean;
  streak: number;
}

@Injectable()
export class CheckinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly team: TeamService,
  ) {}

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
      select: { id: true, doneCount: true, goalCount: true },
    });
    // 只在「恰好越过当日目标线」那一刻结算小队，避免每次答题都查队伍表
    let justCompleted: boolean;
    if (existing) {
      await this.prisma.userCheckin.update({
        where: { id: existing.id },
        data: { doneCount: existing.doneCount + 1 },
      });
      justCompleted = existing.doneCount < existing.goalCount && existing.doneCount + 1 >= existing.goalCount;
    } else {
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
      justCompleted = 1 >= goal;
    }

    if (justCompleted) {
      // 组队是增强能力：结算异常不得影响打卡主流程
      try {
        await this.team.onMemberProgress(userId);
      } catch {
        // 静默降级（小队状态可在下次查看时自行校准）
      }
    }
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

  /* ------------------------------ 后台管理 ------------------------------ */

  /** 后台：近 N 天打卡日历统计（热力图用；N 硬截断 1~90，默认 30）。 */
  async adminStats(days: number): Promise<{ days: Array<CheckinDayStat>; totalUsers: number; today: CheckinDayStat }> {
    const n = Math.min(Math.max(1, Math.floor(days) || 30), 90);
    const totalUsers = await this.prisma.clientUser.count({ where: { status: 1 } });
    const rows = await this.prisma.userCheckin.findMany({
      where: { checkinDate: { gte: this.shiftDate(this.today(), -(n - 1)) } },
      select: { checkinDate: true, doneCount: true, goalCount: true },
    });
    const byDate = new Map<string, { total: number; completed: number }>();
    for (const r of rows) {
      const cell = byDate.get(r.checkinDate) ?? { total: 0, completed: 0 };
      cell.total += 1;
      if (r.doneCount >= r.goalCount) cell.completed += 1;
      byDate.set(r.checkinDate, cell);
    }
    const daysArr: CheckinDayStat[] = [];
    for (let i = n - 1; i >= 0; i -= 1) {
      const date = this.shiftDate(this.today(), -i);
      const cell = byDate.get(date) ?? { total: 0, completed: 0 };
      daysArr.push({
        date,
        total: cell.total,
        completed: cell.completed,
        rate: totalUsers > 0 ? Math.round((cell.completed / totalUsers) * 100) : 0,
      });
    }
    const todayCell = daysArr[daysArr.length - 1];
    return { days: daysArr, totalUsers, today: todayCell };
  }

  /** 后台：打卡记录分页（关键字匹配用户邮箱/昵称；可按日期范围、是否完成筛选）。 */
  async adminRecords(query: {
    keyword?: string;
    dateFrom?: string;
    dateTo?: string;
    completed?: string;
    page: number;
    pageSize: number;
  }): Promise<{ list: CheckinAdminItem[]; total: number }> {
    const where: Prisma.UserCheckinWhereInput = {};
    if (query.dateFrom || query.dateTo) {
      where.checkinDate = {};
      if (query.dateFrom) where.checkinDate.gte = query.dateFrom;
      if (query.dateTo) where.checkinDate.lte = query.dateTo;
    }
    const keyword = query.keyword?.trim();
    if (keyword) {
      const users = await this.prisma.clientUser.findMany({
        where: { OR: [{ email: { contains: keyword } }, { nickname: { contains: keyword } }] },
        select: { id: true },
      });
      if (!users.length) return { list: [], total: 0 };
      where.userId = { in: users.map((u) => u.id) };
    }
    let rows = await this.prisma.userCheckin.findMany({
      where,
      orderBy: [{ checkinDate: 'desc' }, { id: 'desc' }],
    });
    if (query.completed === '1' || query.completed === '0') {
      const want = query.completed === '1';
      rows = rows.filter((r) => r.doneCount >= r.goalCount === want);
    }
    const total = rows.length;
    const pageRows = rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize);
    const users = await this.prisma.clientUser.findMany({
      where: { id: { in: pageRows.map((r) => r.userId) } },
      select: { id: true, email: true, nickname: true },
    });
    const userMap = new Map(users.map((u) => [String(u.id), u]));
    const list: CheckinAdminItem[] = pageRows.map((r) => {
      const u = userMap.get(String(r.userId));
      return {
        id: Number(r.id),
        userId: Number(r.userId),
        email: u?.email ?? '',
        nickname: u?.nickname ?? '',
        checkinDate: r.checkinDate,
        doneCount: r.doneCount,
        goalCount: r.goalCount,
        completed: r.doneCount >= r.goalCount,
        streak: r.streak,
      };
    });
    return { list, total };
  }

  /**
   * 后台：补签（幂等）。把目标日期的 doneCount 补到 goalCount，然后自该用户全量重算 streak。
   * 注意：不会触发小队结算（TeamService.onMemberProgress 只在真实答题越过目标线时跑），
   * 小队连续天数以答题链路为准，补签不改队伍 streak。
   */
  async adminBackfill(
    email: string,
    date: string,
  ): Promise<{ created: boolean; date: string; doneCount: number; goalCount: number; streak: number }> {
    if (date > this.today()) {
      throw AppException.badRequest('补签日期不能晚于今天');
    }
    const user = await this.prisma.clientUser.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    });
    if (!user) {
      throw AppException.notFound('用户不存在（按邮箱查不到 client_user）');
    }
    const goal = config.sentence.dailyGoal;
    const uid = user.id;
    const existing = await this.prisma.userCheckin.findUnique({
      where: { userId_checkinDate: { userId: uid, checkinDate: date } },
      select: { id: true, doneCount: true },
    });
    let created = false;
    if (existing) {
      if (existing.doneCount < goal) {
        await this.prisma.userCheckin.update({
          where: { id: existing.id },
          data: { doneCount: goal, goalCount: goal },
        });
      }
    } else {
      await this.prisma.userCheckin.create({
        data: { userId: uid, checkinDate: date, doneCount: goal, goalCount: goal, streak: 1 },
      });
      created = true;
    }
    await this.recomputeStreak(uid);
    const row = await this.prisma.userCheckin.findUnique({
      where: { userId_checkinDate: { userId: uid, checkinDate: date } },
      select: { doneCount: true, goalCount: true, streak: true },
    });
    return {
      created,
      date,
      doneCount: row?.doneCount ?? goal,
      goalCount: row?.goalCount ?? goal,
      streak: row?.streak ?? 0,
    };
  }

  /** 后台：撤销某天打卡（幂等；删行后重算 streak）。 */
  async adminRevoke(email: string, date: string): Promise<{ revoked: boolean; date: string }> {
    const user = await this.prisma.clientUser.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    });
    if (!user) {
      throw AppException.notFound('用户不存在（按邮箱查不到 client_user）');
    }
    const existing = await this.prisma.userCheckin.findUnique({
      where: { userId_checkinDate: { userId: user.id, checkinDate: date } },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.userCheckin.delete({ where: { id: existing.id } });
      await this.recomputeStreak(user.id);
      return { revoked: true, date };
    }
    return { revoked: false, date };
  }

  /** 自该用户全部打卡行重算连续天数（补签/撤销后调用；只更新有变化的行）。 */
  private async recomputeStreak(userId: bigint): Promise<void> {
    const rows = await this.prisma.userCheckin.findMany({
      where: { userId },
      orderBy: { checkinDate: 'asc' },
      select: { id: true, checkinDate: true, streak: true },
    });
    let prevDate: string | null = null;
    let streak = 0;
    for (const row of rows) {
      const consecutive = prevDate !== null && this.shiftDate(prevDate, 1) === row.checkinDate;
      streak = consecutive ? streak + 1 : 1;
      if (row.streak !== streak) {
        await this.prisma.userCheckin.update({ where: { id: row.id }, data: { streak } });
      }
      prevDate = row.checkinDate;
    }
  }
}
