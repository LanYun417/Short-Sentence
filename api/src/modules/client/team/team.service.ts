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
import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../../common/exception/app.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { TextChatProvider } from '../../../common/ai/text-chat.provider.js';
import { GamifyService } from '../gamify/gamify.service.js';

/** 小队人数上限（凑满即不再接收新成员）。 */
const MAX_MEMBERS = 10;
/** 全员达成时每位成员的 XP 奖励。 */
const FULL_TEAM_XP = 15;
/** 组队码长度与字符集（去掉易混淆的 0/O/1/I）。 */
const TEAM_CODE_LENGTH = 6;
const TEAM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** 聊天记录保留天数。 */
const MESSAGE_RETENTION_DAYS = 30;
/** 消息撤回时限（毫秒）：2 分钟。 */
const RECALL_WINDOW_MS = 2 * 60 * 1000;
/** 单条群聊消息最大码点数。 */
const MESSAGE_MAX_CHARS = 500;
/** 群聊游标分页单页上限。 */
const MESSAGE_PAGE_MAX = 50;
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
  /** 组队码（建队时生成，历史队伍读取时惰性补齐） */
  code: string;
  /** 来源：random 随机匹配 / create 自建 */
  source: string;
  /** 我是否为队长（自建队伍的创建者） */
  isOwner: boolean;
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

/** 群聊消息视图。 */
export interface TeamMessageView {
  id: number;
  userId: number;
  nickname: string;
  /** 头像文件 id（0=默认） */
  avatarFileId: number;
  isMe: boolean;
  content: string;
  /** normal / recalled / hidden */
  status: string;
  /** 是否可撤回（本人 + 2 分钟内 + 正常状态） */
  canRecall: boolean;
  /** 引用的消息（被撤回/隐藏时 content 为空） */
  quote: { id: number; nickname: string; content: string; status: string } | null;
  createdAt: string;
}

/** 群聊消息分页结果。 */
export interface TeamMessagePage {
  list: TeamMessageView[];
  hasMore: boolean;
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
  /** 组队码 */
  code: string | null;
  /** 来源：random / create */
  source: string;
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

/** 后台-群聊消息条目（含已隐藏，供运营审核）。 */
export interface TeamAdminMessageItem {
  id: number;
  teamId: number;
  userId: number;
  nickname: string;
  content: string;
  status: string;
  createdAt: string;
}

/** Prisma 唯一键冲突。 */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gamify: GamifyService,
    private readonly moderator: TextChatProvider,
  ) {}

  /** 我的小队（无队伍返回 null，前端展示「找队友」入口）。 */
  async getMyTeam(userId: number): Promise<TeamView | null> {
    const uid = BigInt(userId);
    const member = await this.prisma.studyTeamMember.findUnique({
      where: { userId: uid },
      select: { teamId: true },
    });
    if (!member) return null;

    let team = await this.prisma.studyTeam.findUnique({
      where: { id: member.teamId },
      select: {
        id: true,
        name: true,
        status: true,
        streak: true,
        lastFullDate: true,
        code: true,
        source: true,
        ownerId: true,
      },
    });
    if (!team || team.status !== 'active') return null;

    // 历史队伍没有组队码：读取时惰性补一个，让所有队伍都可被分享
    if (!team.code) {
      const code = await this.generateCode();
      await this.prisma.studyTeam.update({ where: { id: team.id }, data: { code } });
      team = { ...team, code };
    }

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
      code: team.code ?? '',
      source: team.source,
      isOwner: team.ownerId !== null && String(team.ownerId) === String(uid),
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

    const bucket = await this.computeBucket(uid);

    // 随机匹配只进「随机来源」的队伍：自建队伍走组队码邀请，不接陌生人随机加入
    const candidates = await this.prisma.studyTeam.findMany({
      where: { status: 'active', bucket, source: 'random' },
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
        const team = await this.prisma.studyTeam.create({
          data: { name, bucket, source: 'random', code: await this.generateCode() },
        });
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
      code: '',
      source: 'random',
      isOwner: false,
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

  /** 近 7 天答题量分桶（0~4），随机匹配与自建队伍共用。 */
  private async computeBucket(uid: bigint): Promise<number> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recent = await this.prisma.sentenceRecord.count({
      where: { userId: uid, createdAt: { gte: since } },
    });
    return Math.min(4, Math.floor(recent / 10));
  }

  /** 生成不重复的组队码（去掉易混淆字符；唯一冲突重试）。 */
  private async generateCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      let code = '';
      for (let i = 0; i < TEAM_CODE_LENGTH; i += 1) {
        code += TEAM_CODE_ALPHABET[Math.floor(Math.random() * TEAM_CODE_ALPHABET.length)];
      }
      const exists = await this.prisma.studyTeam.findUnique({ where: { code }, select: { id: true } });
      if (!exists) return code;
    }
    // 极端兜底：退化到更长随机串
    return `${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1e6)
      .toString(36)
      .toUpperCase()}`.slice(0, 8);
  }

  /**
   * 自建队伍：建一个新小队（来源 create、记录队长、生成组队码），创建者自动入队。
   * 已在队伍中则直接返回当前队伍（不重复建队）。
   */
  async create(userId: number, raw: string): Promise<TeamView> {
    const existing = await this.getMyTeam(userId);
    if (existing) return existing;

    const name = normalizeTeamName(raw);
    const length = [...name].length;
    if (length < TEAM_NAME_MIN) throw AppException.badRequest(`小队名至少 ${TEAM_NAME_MIN} 个字`);
    if (length > TEAM_NAME_MAX) throw AppException.badRequest(`小队名最多 ${TEAM_NAME_MAX} 个字`);

    const uid = BigInt(userId);
    const bucket = await this.computeBucket(uid);
    const date = this.today();
    try {
      const team = await this.prisma.studyTeam.create({
        data: { name, bucket, source: 'create', ownerId: uid, code: await this.generateCode() },
      });
      await this.prisma.studyTeamMember.create({
        data: { teamId: team.id, userId: uid, joinedDate: date },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    const view = await this.getMyTeam(userId);
    if (view) {
      await this.gamify.checkAchievements(userId); // 解锁「首次组队」
      return view;
    }
    throw AppException.serviceUnavailable('创建失败，请稍后重试');
  }

  /**
   * 凭组队码加入小队：码不存在/已解散报错，队伍已满报错。
   * 已在队伍中则直接返回当前队伍。
   */
  async joinByCode(userId: number, rawCode: string): Promise<TeamView> {
    const existing = await this.getMyTeam(userId);
    if (existing) return existing;

    const code = rawCode.trim().toUpperCase();
    const team = await this.prisma.studyTeam.findUnique({
      where: { code },
      select: { id: true, status: true, _count: { select: { members: true } } },
    });
    if (!team || team.status !== 'active') throw AppException.badRequest('组队码不存在或已失效');
    if (team._count.members >= MAX_MEMBERS) throw AppException.badRequest(`小队已满（${MAX_MEMBERS} 人），换个队吧`);

    const uid = BigInt(userId);
    try {
      await this.prisma.studyTeamMember.create({
        data: { teamId: team.id, userId: uid, joinedDate: this.today() },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    const view = await this.getMyTeam(userId);
    if (view) {
      await this.gamify.checkAchievements(userId);
      return view;
    }
    throw AppException.serviceUnavailable('加入失败，请稍后重试');
  }

  /** 取当前用户所在的有效小队；未组队/已解散时报错。 */
  private async requireTeam(userId: number): Promise<bigint> {
    const uid = BigInt(userId);
    const member = await this.prisma.studyTeamMember.findUnique({
      where: { userId: uid },
      select: { teamId: true },
    });
    if (!member) throw AppException.badRequest('你还没有小队，先组队吧');
    const team = await this.prisma.studyTeam.findUnique({
      where: { id: member.teamId },
      select: { id: true, status: true },
    });
    if (!team || team.status !== 'active') throw AppException.badRequest('小队已解散，请重新组队');
    return team.id;
  }

  /**
   * 群聊消息游标分页（只返回最近 30 天）：before 为上一页最老消息 id，正序取其之前。
   */
  async listMessages(userId: number, before?: number, limit?: number): Promise<TeamMessagePage> {
    const teamId = await this.requireTeam(userId);
    const take = Math.min(MESSAGE_PAGE_MAX, Math.max(1, limit ?? 30));
    const since = new Date(Date.now() - MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.studyTeamMessage.findMany({
      where: {
        teamId,
        createdAt: { gte: since },
        ...(before ? { id: { lt: BigInt(before) } } : {}),
      },
      orderBy: { id: 'desc' },
      take: take + 1,
    });
    const hasMore = rows.length > take;
    const page = rows.slice(0, take);

    // 作者与引用消息的用户信息
    const uids = new Set<bigint>();
    const quoteIds: bigint[] = [];
    for (const r of page) {
      uids.add(r.userId);
      if (r.quoteId) quoteIds.push(r.quoteId);
    }
    const [users, quotes] = await Promise.all([
      this.prisma.clientUser.findMany({
        where: { id: { in: [...uids] } },
        select: { id: true, nickname: true, avatarFileId: true },
      }),
      quoteIds.length > 0
        ? this.prisma.studyTeamMessage.findMany({
            where: { id: { in: quoteIds }, teamId },
            select: { id: true, userId: true, content: true, status: true },
          })
        : Promise.resolve([]),
    ]);
    const userMap = new Map(users.map((u) => [String(u.id), u]));
    const quoteMap = new Map(quotes.map((q) => [String(q.id), q]));
    const uid = BigInt(userId);
    const now = Date.now();

    const list: TeamMessageView[] = page.map((r) => {
      const u = userMap.get(String(r.userId));
      const q = r.quoteId ? quoteMap.get(String(r.quoteId)) : undefined;
      return {
        id: Number(r.id),
        userId: Number(r.userId),
        nickname: u?.nickname ?? '队友',
        avatarFileId: u ? Number(u.avatarFileId) : 0,
        isMe: r.userId === uid,
        content: r.status === 'normal' ? r.content : '',
        status: r.status,
        canRecall: r.userId === uid && r.status === 'normal' && now - r.createdAt.getTime() <= RECALL_WINDOW_MS,
        quote: q
          ? {
              id: Number(q.id),
              nickname: userMap.get(String(q.userId))?.nickname ?? '队友',
              content: q.status === 'normal' ? q.content : '',
              status: q.status,
            }
          : null,
        createdAt: r.createdAt.toISOString(),
      };
    });

    return { list, hasMore };
  }

  /**
   * 发送群聊消息：校验成员身份、长度、引用合法性，入库前过一遍 AI 审核，
   * 明确违规直接拒掉；拿不准/审核不可用则先发后审（小队内可见，运营可后台隐藏）。
   */
  async sendMessage(userId: number, dto: { content: string; quoteId?: number }): Promise<TeamMessageView> {
    const teamId = await this.requireTeam(userId);
    const content = (dto.content ?? '').trim();
    const len = [...content].length;
    if (len === 0) throw AppException.badRequest('消息不能为空');
    if (len > MESSAGE_MAX_CHARS) throw AppException.badRequest(`消息最多 ${MESSAGE_MAX_CHARS} 字`);

    if (dto.quoteId) {
      const q = await this.prisma.studyTeamMessage.findUnique({
        where: { id: BigInt(dto.quoteId) },
        select: { id: true, teamId: true },
      });
      if (!q || q.teamId !== teamId) throw AppException.badRequest('引用的消息不存在');
    }

    // AI 审核：明确 reject 拒绝；approve/review 允许（私密小队，运营后台可兜底隐藏）
    try {
      const verdict = await this.moderator.moderateChainEntry(
        { topicTitle: '', starterEn: '', contentEn: content },
        userId,
      );
      if (verdict.decision === 'reject') {
        throw AppException.badRequest('内容不合规，请文明聊天');
      }
    } catch (error) {
      if (error instanceof AppException) throw error;
      this.logger.warn(`群聊审核不可用，先放行：${error instanceof Error ? error.message : String(error)}`);
    }

    const uid = BigInt(userId);
    const row = await this.prisma.studyTeamMessage.create({
      data: {
        teamId,
        userId: uid,
        content,
        quoteId: dto.quoteId ? BigInt(dto.quoteId) : null,
      },
    });
    const u = await this.prisma.clientUser.findUnique({
      where: { id: uid },
      select: { nickname: true, avatarFileId: true },
    });
    return {
      id: Number(row.id),
      userId,
      nickname: u?.nickname ?? '我',
      avatarFileId: u ? Number(u.avatarFileId) : 0,
      isMe: true,
      content: row.content,
      status: row.status,
      canRecall: true,
      quote: null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** 撤回自己的消息：2 分钟内、正常状态才可撤回。 */
  async recall(userId: number, messageId: number): Promise<TeamMessageView> {
    const teamId = await this.requireTeam(userId);
    const uid = BigInt(userId);
    const msg = await this.prisma.studyTeamMessage.findUnique({
      where: { id: BigInt(messageId) },
      select: { id: true, teamId: true, userId: true, content: true, status: true, createdAt: true, quoteId: true },
    });
    if (!msg || msg.teamId !== teamId) throw AppException.notFound('消息不存在');
    if (msg.userId !== uid) throw AppException.badRequest('只能撤回自己的消息');
    if (msg.status !== 'normal') throw AppException.badRequest('该消息已撤回');
    if (Date.now() - msg.createdAt.getTime() > RECALL_WINDOW_MS) {
      throw AppException.badRequest('超过 2 分钟，无法撤回');
    }
    const updated = await this.prisma.studyTeamMessage.update({
      where: { id: msg.id },
      data: { status: 'recalled' },
    });
    const u = await this.prisma.clientUser.findUnique({
      where: { id: uid },
      select: { nickname: true, avatarFileId: true },
    });
    return {
      id: Number(updated.id),
      userId: Number(uid),
      nickname: u?.nickname ?? '我',
      avatarFileId: u ? Number(u.avatarFileId) : 0,
      isMe: true,
      content: '',
      status: 'recalled',
      canRecall: false,
      quote: null,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /** 定时任务：删除超过 30 天的群聊消息。 */
  async cleanTeamMessages(): Promise<number> {
    const since = new Date(Date.now() - MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const res = await this.prisma.studyTeamMessage.deleteMany({
      where: { createdAt: { lt: since } },
    });
    return res.count;
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
      select: { id: true, name: true, status: true, streak: true, lastFullDate: true },
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
      await this.gamify.awardXp(
        mid,
        'team_full',
        `team:full:${team.id}:${date}:${mid}`,
        FULL_TEAM_XP,
        `小队全员达成：${team.name}（连续 ${streak} 天）`,
      );
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
          code: true,
          source: true,
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
      code: row.code,
      source: row.source,
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
      select: {
        id: true,
        name: true,
        status: true,
        code: true,
        source: true,
        bucket: true,
        streak: true,
        lastFullDate: true,
        createdAt: true,
      },
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
      code: team.code,
      source: team.source,
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

  /** 后台-小队群聊消息分页（含已隐藏/已撤回，供运营审核）。 */
  async adminListMessages(
    teamId: number,
    query: Record<string, unknown>,
  ): Promise<{ list: TeamAdminMessageItem[]; total: number }> {
    const team = await this.prisma.studyTeam.findUnique({
      where: { id: BigInt(teamId) },
      select: { id: true },
    });
    if (!team) throw AppException.notFound('小队不存在');
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 30) || 30));
    const status = typeof query.status === 'string' && query.status ? query.status : undefined;

    const where = { teamId: team.id, ...(status ? { status } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.studyTeamMessage.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, teamId: true, userId: true, content: true, status: true, createdAt: true },
      }),
      this.prisma.studyTeamMessage.count({ where }),
    ]);
    const users = await this.prisma.clientUser.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.userId))] } },
      select: { id: true, nickname: true },
    });
    const userMap = new Map(users.map((u) => [String(u.id), u.nickname]));
    const list = rows.map((r) => ({
      id: Number(r.id),
      teamId: Number(r.teamId),
      userId: Number(r.userId),
      nickname: userMap.get(String(r.userId)) ?? `用户${Number(r.userId)}`,
      content: r.content,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
    return { list, total };
  }

  /** 后台-隐藏/恢复一条群聊消息（审核兜底）。 */
  async adminSetMessageStatus(messageId: number, status: 'normal' | 'hidden'): Promise<void> {
    const msg = await this.prisma.studyTeamMessage.findUnique({
      where: { id: BigInt(messageId) },
      select: { id: true },
    });
    if (!msg) throw AppException.notFound('消息不存在');
    await this.prisma.studyTeamMessage.update({
      where: { id: msg.id },
      data: { status },
    });
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
