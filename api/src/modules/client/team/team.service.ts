/**
 * 弱连接学习小队（客户端）。
 *
 * 产品定位：不做好友、不建聊天、不产 UGC。系统按「近 7 天答题量档位」把节奏相近的
 * 陌生人凑成 2~4 人小队，队员只看得到彼此的今日打卡状态与连续天数。
 * 留存来自「轻量社会承诺」：看到别人已打卡，自己更愿意补上；全员达成有连续天数与 XP。
 *
 * 提醒通道取舍：不引入 FCM / 厂商推送（需外部账号与构建配置，也违背零新增运行时依赖），
 * 改用「应用内醒目提醒条（hint）+ 已有每日邮件提醒开关」闭环——
 * 后者在用户今日未达成目标时本来就会发信，组队状态无需改模板即可覆盖。
 *
 * 日期口径与 CheckinService 完全一致（本地时区 YYYY-MM-DD），否则会错判全员打卡。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/exception/app.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { GamifyService } from '../gamify/gamify.service.js';

/** 小队人数上限（凑满即不再接收新成员）。 */
const MAX_MEMBERS = 4;
/** 全员达成时每位成员的 XP 奖励。 */
const FULL_TEAM_XP = 15;
/** 小队名词库（随机取，无唯一约束，重名不影响功能）。 */
const TEAM_NAMES = ['晨光', '星野', '拾光', '青柠', '远航', '暖阳', '松风', '晴川', '萤火', '知更'];
/** 小队名长度（按码点计，emoji 记 1）：schema 是 VarChar(50)，产品上取更紧的区间。 */
const TEAM_NAME_MIN = 2;
const TEAM_NAME_MAX = 20;

/**
 * 归一化小队名：控制字符（含换行 / 制表）**换成空格**而不是直接删掉——
 * 直接删会把「早安\t小队」粘成「早安小队」；换空格后再压缩连续空白，
 * 既能排版干净又不会改变用户原本想表达的分词。
 */
function normalizeTeamName(raw: string): string {
  return (
    (raw ?? '')
      // eslint-disable-next-line no-control-regex -- 故意匹配控制字符（换行/制表等）以便剥掉
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export interface TeamMemberView {
  userId: number;
  nickname: string;
  /** 头像文件 id（0=默认；前端用昵称首字占位，不直接暴露文件地址） */
  avatarFileId: number;
  xp: number;
  /** 今日是否已完成打卡目标 */
  checkedIn: boolean;
  /** 是否为当前登录用户 */
  isMe: boolean;
}

export interface TeamView {
  id: number;
  name: string;
  /** 当前有效的全员连续天数（断签后归零） */
  streak: number;
  memberCount: number;
  maxMembers: number;
  /** 今日已完成人数 */
  doneCount: number;
  /** 今日是否已全员完成 */
  todayFull: boolean;
  /** 我自己今日是否完成 */
  myCheckedIn: boolean;
  /** 应用内提醒文案 */
  hint: string;
  /** 提醒级别：info 普通 / urge 催促 / success 全员达成 */
  hintTone: 'info' | 'urge' | 'success';
  members: TeamMemberView[];
}

/* ------------------------------ 后台管理视图类型 ------------------------------ */

/** 后台-小队概览统计。 */
export interface TeamAdminStats {
  activeTeamCount: number;
  dissolvedTeamCount: number;
  /** 在队用户总数 */
  inTeamUserCount: number;
  /** 平均每队人数（无进行中小队为 null） */
  avgMembers: number | null;
  /** 今日全员达成的小队数（lastFullDate = 今天） */
  todayFullTeamCount: number;
}

/** 后台-小队列表条目。 */
export interface TeamAdminItem {
  id: number;
  name: string;
  status: string;
  /** 匹配分桶（近 7 天答题量档位） */
  bucket: number;
  streak: number;
  lastFullDate: string | null;
  memberCount: number;
  maxMembers: number;
  createdAt: string;
}

/** 后台-小队详情（含成员）。 */
export interface TeamAdminDetail extends Omit<TeamAdminItem, 'memberCount'> {
  members: Array<{
    userId: number;
    nickname: string;
    xp: number;
    joinedDate: string;
    checkedIn: boolean;
  }>;
}

/** Prisma 唯一键冲突。 */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamify: GamifyService,
  ) {}

  /** 我的小队（无队伍返回 null，前端展示「找队友」入口）。 */
  async getMyTeam(userId: number): Promise<TeamView | null> {
    const uid = BigInt(userId);
    const member = await this.prisma.studyTeamMember.findUnique({
      where: { userId: uid },
      select: { teamId: true },
    });
    if (!member) return null;

    const team = await this.prisma.studyTeam.findUnique({
      where: { id: member.teamId },
      select: { id: true, name: true, status: true, streak: true, lastFullDate: true },
    });
    if (!team || team.status !== 'active') return null;

    const members = await this.prisma.studyTeamMember.findMany({
      where: { teamId: team.id },
      select: { userId: true },
      orderBy: { id: 'asc' },
    });
    const uids = members.map((m) => m.userId);
    const [users, checkins] = await Promise.all([
      this.prisma.clientUser.findMany({
        where: { id: { in: uids } },
        select: { id: true, nickname: true, avatarFileId: true, xp: true },
      }),
      this.prisma.userCheckin.findMany({
        where: { userId: { in: uids }, checkinDate: this.today() },
        select: { userId: true, doneCount: true, goalCount: true },
      }),
    ]);
    const userMap = new Map(users.map((u) => [String(u.id), u]));
    const doneSet = new Set(checkins.filter((c) => c.doneCount >= c.goalCount).map((c) => String(c.userId)));

    const views: TeamMemberView[] = members.map((m) => {
      const u = userMap.get(String(m.userId));
      return {
        userId: Number(m.userId),
        nickname: u?.nickname ?? '队友',
        avatarFileId: u ? Number(u.avatarFileId) : 0,
        xp: u?.xp ?? 0,
        checkedIn: doneSet.has(String(m.userId)),
        isMe: String(m.userId) === String(uid),
      };
    });

    const doneCount = views.filter((v) => v.checkedIn).length;
    const memberCount = views.length;
    const todayFull = memberCount >= 2 && doneCount === memberCount;
    const myCheckedIn = views.find((v) => v.isMe)?.checkedIn ?? false;
    const date = this.today();
    const streak = team.lastFullDate === date || team.lastFullDate === this.shiftDate(date, -1) ? team.streak : 0;

    let hint: string;
    let hintTone: TeamView['hintTone'];
    if (memberCount < 2) {
      hint = '正在等待节奏相近的队友加入…';
      hintTone = 'info';
    } else if (todayFull) {
      hint = `今日全员打卡完成，小队已连续 ${streak} 天！`;
      hintTone = 'success';
    } else if (!myCheckedIn && doneCount > 0) {
      hint = `${doneCount} 位队友已就位，就差你啦`;
      hintTone = 'urge';
    } else if (!myCheckedIn) {
      hint = '今天还没打卡，先替小队开个头吧';
      hintTone = 'info';
    } else {
      hint = `你已打卡，还差 ${memberCount - doneCount} 位队友`;
      hintTone = 'info';
    }

    return {
      id: Number(team.id),
      name: team.name,
      streak,
      memberCount,
      maxMembers: MAX_MEMBERS,
      doneCount,
      todayFull,
      myCheckedIn,
      hint,
      hintTone,
      members: views,
    };
  }

  /**
   * 找队友（弱连接匹配）：
   * 1. 近 7 天答题量分桶，只和同桶的陌生人组队——节奏相近才互相带得动；
   * 2. 优先补进「人数最多的未满小队」，让队伍尽快凑齐产生社会承诺；
   * 3. 没有可加入的队伍就新建一个等待池。
   * 一个用户同时只能在一个队（study_team_member.user_id 唯一），并发下靠 P2002 兜底。
   */
  async match(userId: number): Promise<TeamView> {
    const uid = BigInt(userId);
    const existing = await this.getMyTeam(userId);
    if (existing) return existing;

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recent = await this.prisma.sentenceRecord.count({
      where: { userId: uid, createdAt: { gte: since } },
    });
    const bucket = Math.min(4, Math.floor(recent / 10));

    const candidates = await this.prisma.studyTeam.findMany({
      where: { status: 'active', bucket },
      select: { id: true, members: { select: { userId: true } } },
      orderBy: { createdAt: 'asc' },
      take: 40,
    });
    const open = candidates
      .filter((t) => t.members.length > 0 && t.members.length < MAX_MEMBERS)
      .sort((a, b) => b.members.length - a.members.length)[0];

    const date = this.today();
    try {
      if (open) {
        await this.prisma.studyTeamMember.create({
          data: { teamId: open.id, userId: uid, joinedDate: date },
        });
      } else {
        const name = `${TEAM_NAMES[Math.floor(Math.random() * TEAM_NAMES.length)]}小队`;
        const team = await this.prisma.studyTeam.create({ data: { name, bucket } });
        await this.prisma.studyTeamMember.create({
          data: { teamId: team.id, userId: uid, joinedDate: date },
        });
      }
    } catch (error) {
      // 并发下已被别处拉进队伍：直接返回现状，不向用户报错
      if (!isUniqueViolation(error)) throw error;
    }

    const view = await this.getMyTeam(userId);
    if (view) {
      await this.gamify.checkAchievements(userId); // 解锁「首次组队」
      return view;
    }
    // 理论上不可达：刚写入的成员行必定能查到
    return {
      id: 0,
      name: '',
      streak: 0,
      memberCount: 0,
      maxMembers: MAX_MEMBERS,
      doneCount: 0,
      todayFull: false,
      myCheckedIn: false,
      hint: '匹配中，请稍后再试',
      hintTone: 'info',
      members: [],
    };
  }

  /** 退出小队（可重新匹配）；队伍空了则置为已解散，避免无限累积空队。 */
  async leave(userId: number): Promise<void> {
    const uid = BigInt(userId);
    const member = await this.prisma.studyTeamMember.findUnique({
      where: { userId: uid },
      select: { id: true, teamId: true },
    });
    if (!member) return;
    await this.prisma.studyTeamMember.delete({ where: { id: member.id } });
    const rest = await this.prisma.studyTeamMember.count({ where: { teamId: member.teamId } });
    if (rest === 0) {
      await this.prisma.studyTeam.update({
        where: { id: member.teamId },
        data: { status: 'dissolved' },
      });
    }
  }

  /**
   * 修改小队名（任意成员可改，改完全队可见）。
   *
   * 为什么不做「仅创建者可改」： study_team 没有创建者字段，为这一点加列要回填历史数据，
   * 而小队上限 4 人、随时可退出重配，被乱改名的代价很低。输入侧做严归一
   * （丢控制字符 / 压缩空白 / 码点限长）+ Vue 侧天然转义，足够挡住注入与排版破坏。
   */
  async rename(userId: number, raw: string): Promise<TeamView> {
    const name = normalizeTeamName(raw);
    const length = [...name].length;
    if (length < TEAM_NAME_MIN) {
      throw AppException.badRequest(`小队名至少 ${TEAM_NAME_MIN} 个字`);
    }
    if (length > TEAM_NAME_MAX) {
      throw AppException.badRequest(`小队名最多 ${TEAM_NAME_MAX} 个字`);
    }

    const uid = BigInt(userId);
    const member = await this.prisma.studyTeamMember.findUnique({
      where: { userId: uid },
      select: { teamId: true },
    });
    if (!member) throw AppException.badRequest('你还没有小队，先找队友吧');
    const team = await this.prisma.studyTeam.findUnique({
      where: { id: member.teamId },
      select: { id: true, status: true },
    });
    if (!team || team.status !== 'active') throw AppException.badRequest('小队已解散，请重新匹配');

    await this.prisma.studyTeam.update({ where: { id: team.id }, data: { name } });
    const view = await this.getMyTeam(userId);
    // 刚更新过必然查得到；查不到说明状态异常，宁可报错也不要返回空小队
    if (!view) throw AppException.serviceUnavailable('小队状态异常，请刷新后重试');
    return view;
  }

  /**
   * 打卡联动结算：由 CheckinService 在用户「今日刚达成目标」那一刻调用。
   * 全员达成时更新连续天数、给每位成员发幂等 XP、并触发成就检查。
   * 失败由调用方吞掉——组队是增强，绝不能影响打卡主流程。
   */
  async onMemberProgress(userId: number): Promise<void> {
    const uid = BigInt(userId);
    const member = await this.prisma.studyTeamMember.findUnique({
      where: { userId: uid },
      select: { teamId: true },
    });
    if (!member) return;

    const team = await this.prisma.studyTeam.findUnique({
      where: { id: member.teamId },
      select: { id: true, status: true, streak: true, lastFullDate: true },
    });
    if (!team || team.status !== 'active') return;
    const date = this.today();
    if (team.lastFullDate === date) return; // 今日已结算

    const members = await this.prisma.studyTeamMember.findMany({
      where: { teamId: team.id },
      select: { userId: true },
    });
    if (members.length < 2) return; // 单人等待池不算「全员」

    const rows = await this.prisma.userCheckin.findMany({
      where: { userId: { in: members.map((m) => m.userId) }, checkinDate: date },
      select: { userId: true, doneCount: true, goalCount: true },
    });
    const done = new Set(rows.filter((r) => r.doneCount >= r.goalCount).map((r) => String(r.userId)));
    if (done.size < members.length) return;

    const streak = team.lastFullDate === this.shiftDate(date, -1) ? team.streak + 1 : 1;
    await this.prisma.studyTeam.update({
      where: { id: team.id },
      data: { streak, lastFullDate: date },
    });

    for (const m of members) {
      const mid = Number(m.userId);
      await this.gamify.awardXp(mid, 'team_full', `team:full:${team.id}:${date}:${mid}`, FULL_TEAM_XP);
      // 队伍成就（team_full_3 / team_full_7）依赖 teamStreak，结算后统一刷新
      await this.gamify.checkAchievements(mid);
    }
  }

  /* ------------------------------ 后台管理（运营） ------------------------------ */

  /** 后台-概览统计。 */
  async adminStats(): Promise<TeamAdminStats> {
    const today = this.today();
    const [activeCount, dissolvedCount, memberCount, todayFullCount] = await Promise.all([
      this.prisma.studyTeam.count({ where: { status: 'active' } }),
      this.prisma.studyTeam.count({ where: { status: 'dissolved' } }),
      this.prisma.studyTeamMember.count(),
      this.prisma.studyTeam.count({ where: { status: 'active', lastFullDate: today } }),
    ]);
    return {
      activeTeamCount: activeCount,
      dissolvedTeamCount: dissolvedCount,
      inTeamUserCount: memberCount,
      avgMembers: activeCount > 0 ? Math.round((memberCount / activeCount) * 10) / 10 : null,
      todayFullTeamCount: todayFullCount,
    };
  }

  /** 后台-小队分页列表（筛选：status / keyword=队名 / minMembers）。 */
  async adminList(query: Record<string, unknown>): Promise<{ list: TeamAdminItem[]; total: number }> {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20) || 20));
    const status = typeof query.status === 'string' && query.status ? query.status : 'active';
    const keyword = typeof query.keyword === 'string' ? query.keyword.trim() : '';
    const minMembers = Number(query.minMembers ?? 0) || 0;

    const where = {
      ...(status ? { status } : {}),
      ...(keyword ? { name: { contains: keyword } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.studyTeam.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          status: true,
          bucket: true,
          streak: true,
          lastFullDate: true,
          createdAt: true,
          _count: { select: { members: true } },
        },
      }),
      this.prisma.studyTeam.count({ where }),
    ]);

    let list = rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      status: row.status,
      bucket: row.bucket,
      streak: row.streak,
      lastFullDate: row.lastFullDate,
      memberCount: row._count.members,
      maxMembers: MAX_MEMBERS,
      createdAt: row.createdAt.toISOString(),
    }));
    if (minMembers > 0) list = list.filter((row) => row.memberCount >= minMembers);
    return { list, total };
  }

  /** 后台-小队详情：成员（含加入日期、今日打卡）。 */
  async adminDetail(teamId: number): Promise<TeamAdminDetail> {
    const team = await this.prisma.studyTeam.findUnique({
      where: { id: BigInt(teamId) },
      select: { id: true, name: true, status: true, bucket: true, streak: true, lastFullDate: true, createdAt: true },
    });
    if (!team) throw AppException.notFound('小队不存在');

    const members = await this.prisma.studyTeamMember.findMany({
      where: { teamId: team.id },
      orderBy: { id: 'asc' },
      select: { userId: true, joinedDate: true },
    });
    const date = this.today();
    const [users, checkins] = await Promise.all([
      this.prisma.clientUser.findMany({
        where: { id: { in: members.map((m) => m.userId) } },
        select: { id: true, nickname: true, xp: true },
      }),
      this.prisma.userCheckin.findMany({
        where: { userId: { in: members.map((m) => m.userId) }, checkinDate: date },
        select: { userId: true, doneCount: true, goalCount: true },
      }),
    ]);
    const userMap = new Map(users.map((u) => [String(u.id), u]));
    const doneSet = new Set(checkins.filter((c) => c.doneCount >= c.goalCount).map((c) => String(c.userId)));

    return {
      id: Number(team.id),
      name: team.name,
      status: team.status,
      bucket: team.bucket,
      streak: team.streak,
      lastFullDate: team.lastFullDate,
      createdAt: team.createdAt.toISOString(),
      maxMembers: MAX_MEMBERS,
      members: members.map((m) => ({
        userId: Number(m.userId),
        nickname: userMap.get(String(m.userId))?.nickname ?? `用户${Number(m.userId)}`,
        xp: userMap.get(String(m.userId))?.xp ?? 0,
        joinedDate: m.joinedDate,
        checkedIn: doneSet.has(String(m.userId)),
      })),
    };
  }

  /** 后台-解散小队：置 dissolved 并清空成员（成员可重新匹配），事务保证一致。 */
  async adminDissolve(teamId: number): Promise<void> {
    const team = await this.prisma.studyTeam.findUnique({
      where: { id: BigInt(teamId) },
      select: { id: true, status: true },
    });
    if (!team) throw AppException.notFound('小队不存在');
    if (team.status === 'dissolved') throw AppException.badRequest('小队已解散');
    await this.prisma.$transaction(async (tx) => {
      await tx.studyTeamMember.deleteMany({ where: { teamId: team.id } });
      await tx.studyTeam.update({ where: { id: team.id }, data: { status: 'dissolved' } });
    });
  }

  /** 后台-改名（运营修正不当队名；与用户改名同一套归一化与长度校验）。 */
  async adminRename(teamId: number, raw: string): Promise<void> {
    const name = normalizeTeamName(raw);
    const length = [...name].length;
    if (length < TEAM_NAME_MIN) throw AppException.badRequest(`小队名至少 ${TEAM_NAME_MIN} 个字`);
    if (length > TEAM_NAME_MAX) throw AppException.badRequest(`小队名最多 ${TEAM_NAME_MAX} 个字`);
    const team = await this.prisma.studyTeam.findUnique({
      where: { id: BigInt(teamId) },
      select: { id: true, status: true },
    });
    if (!team) throw AppException.notFound('小队不存在');
    if (team.status !== 'active') throw AppException.badRequest('已解散的小队不能改名');
    await this.prisma.studyTeam.update({ where: { id: team.id }, data: { name } });
  }

  /** 本地时区今天（与 CheckinService.today 同口径）。 */
  private today(): string {
    return this.formatDate(new Date());
  }

  /** 日期字符串平移（与 CheckinService.shiftDate 同口径）。 */
  private shiftDate(date: string, days: number): string {
    const base = new Date(`${date}T00:00:00`);
    base.setDate(base.getDate() + days);
    return this.formatDate(base);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
