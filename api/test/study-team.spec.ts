import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { TeamService } from '../src/modules/client/team/team.service.js';

/**
 * 弱连接小队的核心不变量：
 * 1. 匹配——节奏同桶的用户会补进同一支未满小队，而不是各建各的；
 * 2. 组队打卡结算——全员达成才 +1 连续天数、给每人发幂等 XP，单人等待池不算；
 * 3. 退队——队伍退空后置 dissolved，不再接收新成员；
 * 4. 提醒文案——「队友已打卡、我还没打」必须是催促级（urge）。
 */

function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function makeService() {
  const teams: Array<Record<string, unknown>> = [];
  const members: Array<Record<string, unknown>> = [];
  const checkins: Array<Record<string, unknown>> = [];
  let teamSeq = 1;
  let memberSeq = 1;
  const xpCalls: Array<{ userId: number; key: string }> = [];

  const prisma: any = {
    studyTeamMember: {
      findUnique: vi.fn(
        async ({ where }: { where: { userId: bigint } }) =>
          members.find((m) => String(m.userId) === String(where.userId)) ?? null,
      ),
      findMany: vi.fn(async ({ where }: { where: { teamId: bigint } }) =>
        members.filter((m) => String(m.teamId) === String(where.teamId)),
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: BigInt(memberSeq++), ...data };
        members.push(row);
        return row;
      }),
      delete: vi.fn(async ({ where }: { where: { id: bigint } }) => {
        const i = members.findIndex((m) => String(m.id) === String(where.id));
        if (i >= 0) members.splice(i, 1);
        return {};
      }),
      count: vi.fn(
        async ({ where }: { where: { teamId: bigint } }) =>
          members.filter((m) => String(m.teamId) === String(where.teamId)).length,
      ),
    },
    studyTeam: {
      findUnique: vi.fn(
        async ({ where }: { where: { id: bigint } }) => teams.find((t) => String(t.id) === String(where.id)) ?? null,
      ),
      findMany: vi.fn(async ({ where }: { where: { status: string; bucket: number } }) =>
        teams
          .filter((t) => t.status === where.status && t.bucket === where.bucket)
          .map((t) => ({
            id: t.id,
            createdAt: t.createdAt,
            members: members.filter((m) => String(m.teamId) === String(t.id)).map((m) => ({ userId: m.userId })),
          })),
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: BigInt(teamSeq++),
          status: 'active',
          bucket: 0,
          streak: 0,
          lastFullDate: null,
          createdAt: new Date(),
          ...data,
        };
        teams.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: bigint }; data: Record<string, unknown> }) => {
        const row = teams.find((t) => String(t.id) === String(where.id))!;
        Object.assign(row, data);
        return row;
      }),
    },
    clientUser: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: bigint[] } } }) =>
        where.id.in.map((id) => ({
          id,
          nickname: `队友${id}`,
          avatarFileId: 0n,
          xp: 100,
        })),
      ),
    },
    userCheckin: {
      findMany: vi.fn(async ({ where }: { where: { userId: { in: bigint[] }; checkinDate: string } }) =>
        checkins.filter(
          (c) => c.checkinDate === where.checkinDate && where.userId.in.some((u) => String(u) === String(c.userId)),
        ),
      ),
    },
    // 固定 12 次 → bucket = 1，保证两个用户同桶
    sentenceRecord: { count: vi.fn(async () => 12) },
  };

  const gamify: any = {
    awardXp: vi.fn(async (userId: number, _type: string, key: string) => {
      xpCalls.push({ userId, key });
      return true;
    }),
    checkAchievements: vi.fn(async () => []),
  };

  const service = new TeamService(prisma as unknown as PrismaService, gamify);
  return { service, prisma, gamify, teams, members, checkins, xpCalls };
}

describe('弱连接小队：匹配', () => {
  it('同桶用户补进同一支队伍，重复 match 幂等返回现状', async () => {
    const { service, members } = makeService();
    expect(await service.getMyTeam(1)).toBeNull();

    const a = await service.match(1);
    const b = await service.match(2);
    const again = await service.match(1);

    expect(a.id).toBe(b.id);
    expect(b.memberCount).toBe(2);
    expect(again.memberCount).toBe(2);
    expect(members).toHaveLength(2); // 没有把同一个人重复塞进队伍
    expect(b.hintTone).toBe('info');
  });
});

describe('弱连接小队：全员结算', () => {
  it('全员达成后连续天数 +1、每人各得一次幂等 XP；单人等待池不结算', async () => {
    const { service, teams, checkins, xpCalls, gamify } = makeService();
    await service.match(1);
    const date = localDate();

    // 只有一人达成 → 不结算
    checkins.push({ userId: 1n, checkinDate: date, doneCount: 20, goalCount: 20 });
    await service.onMemberProgress(1);
    expect(teams[0].streak).toBe(0);

    // 第二人也达成 → 结算
    checkins.push({ userId: 2n, checkinDate: date, doneCount: 20, goalCount: 20 });
    await service.match(2);
    await service.onMemberProgress(2);
    expect(teams[0].streak).toBe(1);
    expect(teams[0].lastFullDate).toBe(date);
    expect(xpCalls).toHaveLength(2);
    expect(new Set(xpCalls.map((c) => c.key)).size).toBe(2); // eventKey 按人区分

    // 同一天再次触发不应重复结算 / 重复发奖
    await service.onMemberProgress(1);
    expect(teams[0].streak).toBe(1);
    expect(xpCalls).toHaveLength(2);
    expect(gamify.checkAchievements).toHaveBeenCalled();
  });

  it('断签后 streak 归 1，连续达成才累加', async () => {
    const { service, teams, checkins } = makeService();
    await service.match(1);
    await service.match(2);
    const today = localDate();
    const yesterday = localDate(-1);
    for (const uid of [1n, 2n]) {
      checkins.push({ userId: uid, checkinDate: today, doneCount: 20, goalCount: 20 });
    }
    await service.onMemberProgress(1);
    expect(teams[0].streak).toBe(1);

    // 模拟「昨天已全员」后再结算今天 → streak=2
    teams[0].lastFullDate = yesterday;
    await service.onMemberProgress(1);
    expect(teams[0].streak).toBe(2);
  });
});

describe('弱连接小队：提醒与退队', () => {
  it('队友已打卡而我未打卡时给出 urge 催促', async () => {
    const { service, checkins } = makeService();
    await service.match(1);
    await service.match(2);
    checkins.push({ userId: 2n, checkinDate: localDate(), doneCount: 20, goalCount: 20 });

    const view = await service.getMyTeam(1);
    expect(view?.myCheckedIn).toBe(false);
    expect(view?.doneCount).toBe(1);
    expect(view?.hintTone).toBe('urge');
    expect(view?.hint).toContain('就差你');
  });

  it('全员退空后队伍置为 dissolved，且不再被匹配命中', async () => {
    const { service, teams } = makeService();
    await service.match(1);
    await service.match(2);
    await service.leave(1);
    expect(teams[0].status).toBe('active'); // 还剩一人
    await service.leave(2);
    expect(teams[0].status).toBe('dissolved');
    expect(await service.getMyTeam(1)).toBeNull();

    const fresh = await service.match(3);
    expect(fresh.id).not.toBe(teams[0].id); // 新队伍，没被拉回已解散的队
  });
});
