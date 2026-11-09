/**
 * 学习小队后台管理（TeamService.adminXxx）单测。
 * 重点钉住：解散事务（清成员+置 dissolved）、改名校验、详情成员打卡、列表筛选。
 */
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { GamifyService } from '../src/modules/client/gamify/gamify.service.js';
import { TeamService } from '../src/modules/client/team/team.service.js';

function makeService() {
  const teams: Array<Record<string, unknown>> = [];
  const members: Array<Record<string, unknown>> = [];
  const checkins: Array<Record<string, unknown>> = [];
  const users = [
    { id: 1n, nickname: '小明', xp: 100 },
    { id: 2n, nickname: '小红', xp: 200 },
  ];
  let teamSeq = 1n;
  let memberSeq = 1n;

  const prisma: any = {
    studyTeam: {
      count: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) =>
          teams.filter((t) =>
            Object.entries(where).every(([k, v]) => {
              if (k === 'name' && typeof v === 'object' && v !== null && 'contains' in v) {
                return String(t.name).includes(String((v as { contains: string }).contains));
              }
              return t[k] === v;
            }),
          ).length,
      ),
      findUnique: vi.fn(
        async ({ where }: { where: { id: bigint } }) => teams.find((t) => String(t.id) === String(where.id)) ?? null,
      ),
      findMany: vi.fn(async ({ where, skip, take }: any) => {
        let rows = teams.filter((t) => {
          if (where?.status && t.status !== where.status) return false;
          if (where?.name?.contains && !String(t.name).includes(where.name.contains)) return false;
          return true;
        });
        if (skip) rows = rows.slice(skip);
        if (take) rows = rows.slice(0, take);
        return rows.map((t) => ({
          ...t,
          _count: { members: members.filter((m) => String(m.teamId) === String(t.id)).length },
        }));
      }),
      update: vi.fn(async ({ where, data }: { where: { id: bigint }; data: Record<string, unknown> }) => {
        const row = teams.find((t) => String(t.id) === String(where.id));
        if (row) Object.assign(row, data);
        return row;
      }),
    },
    studyTeamMember: {
      count: vi.fn(async () => members.length),
      findMany: vi.fn(async ({ where }: { where: { teamId: bigint } }) =>
        members.filter((m) => String(m.teamId) === String(where.teamId)),
      ),
      deleteMany: vi.fn(async ({ where }: { where: { teamId: bigint } }) => {
        const before = members.length;
        for (let i = members.length - 1; i >= 0; i -= 1) {
          if (String(members[i].teamId) === String(where.teamId)) members.splice(i, 1);
        }
        return { count: before - members.length };
      }),
    },
    clientUser: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: bigint[] } } }) =>
        users.filter((u) => where.id.in.some((id) => id === u.id)),
      ),
    },
    userCheckin: {
      findMany: vi.fn(async ({ where }: { where: { userId: { in: bigint[] }; checkinDate: string } }) =>
        checkins.filter(
          (c) => c.checkinDate === where.checkinDate && where.userId.in.some((u) => String(u) === String(c.userId)),
        ),
      ),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };

  const gamify: any = { awardXp: vi.fn(), checkAchievements: vi.fn() };
  const service = new TeamService(prisma as unknown as PrismaService, gamify as unknown as GamifyService);

  function addTeam(name: string, status = 'active') {
    const team = { id: teamSeq++, name, status, bucket: 1, streak: 0, lastFullDate: null, createdAt: new Date() };
    teams.push(team);
    return team;
  }
  function addMember(teamId: bigint, userId: bigint) {
    const row = { id: memberSeq++, teamId, userId, joinedDate: '2026-11-09' };
    members.push(row);
    return row;
  }
  return { service, prisma, teams, members, checkins, addTeam, addMember };
}

describe('学习小队后台：解散与改名', () => {
  it('解散：事务内清空成员并置 dissolved', async () => {
    const { service, teams, members, addTeam, addMember } = makeService();
    const team = addTeam('晴川小队');
    addMember(team.id, 1n);
    addMember(team.id, 2n);
    await service.adminDissolve(Number(team.id));
    expect(teams[0].status).toBe('dissolved');
    expect(members).toHaveLength(0);
  });

  it('解散：已解散 / 不存在分别报错', async () => {
    const { service, addTeam } = makeService();
    const team = addTeam('已散的队', 'dissolved');
    await expect(service.adminDissolve(Number(team.id))).rejects.toThrow(/已解散/);
    await expect(service.adminDissolve(999)).rejects.toThrow(/不存在/);
  });

  it('改名：走同一套归一化 + 长度校验；已解散拒改', async () => {
    const { service, teams, addTeam } = makeService();
    const team = addTeam('旧名字');
    await service.adminRename(Number(team.id), '  新队名  ');
    expect(teams[0].name).toBe('新队名');
    await expect(service.adminRename(Number(team.id), 'a')).rejects.toThrow(/至少/);
    await expect(service.adminRename(Number(team.id), 'x'.repeat(21))).rejects.toThrow(/最多/);

    teams[0].status = 'dissolved';
    await expect(service.adminRename(Number(team.id), '又改名')).rejects.toThrow(/解散/);
  });
});

describe('学习小队后台：列表与详情', () => {
  it('列表按队名关键词筛选，并带成员数', async () => {
    const { service, addTeam, addMember } = makeService();
    const a = addTeam('晨光小队');
    addMember(a.id, 1n);
    addMember(a.id, 2n);
    addTeam('星野小队');
    const { list, total } = await service.adminList({ keyword: '晨光' });
    expect(total).toBe(1);
    expect(list[0].name).toBe('晨光小队');
    expect(list[0].memberCount).toBe(2);
  });

  it('详情返回成员与今日打卡状态', async () => {
    const { service, checkins, addTeam, addMember } = makeService();
    const team = addTeam('拾光小队');
    addMember(team.id, 1n);
    addMember(team.id, 2n);
    const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    checkins.push({ userId: 1n, checkinDate: today, doneCount: 20, goalCount: 20 });
    const detail = await service.adminDetail(Number(team.id));
    expect(detail.members).toHaveLength(2);
    const me = detail.members.find((m) => m.userId === 1);
    const other = detail.members.find((m) => m.userId === 2);
    expect(me?.checkedIn).toBe(true);
    expect(other?.checkedIn).toBe(false);
    expect(detail.maxMembers).toBe(4);
  });

  it('概览统计：进行中/解散/在队用户/今日全员', async () => {
    const { service, addTeam, addMember } = makeService();
    const a = addTeam('晨光小队');
    addMember(a.id, 1n);
    addMember(a.id, 2n);
    addTeam('旧队', 'dissolved');
    const stats = await service.adminStats();
    expect(stats.activeTeamCount).toBe(1);
    expect(stats.dissolvedTeamCount).toBe(1);
    expect(stats.inTeamUserCount).toBe(2);
    expect(stats.avgMembers).toBe(2);
  });
});
