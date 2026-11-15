/**
 * 客户端用户管理服务（运营后台）。
 * 模块职责：分页查询 / 详情（含学习数据）/ 启停 / 重置密码 / 强制下线 / 删除（级联清理）。
 *
 * 与系统用户（sys_user）完全隔离：这里操作的是 client_user（「短句」App 用户）。
 * 强制下线利用「改密后旧 Token 失效」的既有机制：只把 passwordChangedAt 推到当前时刻，
 * 不改密码——用户用原密码重新登录即可。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_REGEX,
  PASSWORD_LENGTH_MESSAGE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../common/auth/password-policy.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { buildPageResult, formatDateTimeInZone, hashPassword, parsePagination } from '../../common/utils/utils.js';
import type { PageResult } from '../../common/types.js';
import type { CsvExportTask } from '../../common/utils/csv-stream.js';
import { assertExportable } from '../../common/utils/csv-stream.js';
import { config } from '../../common/config/config.js';

/** 客户端用户导出表头（与列表列顺序一致）。 */
const CLIENT_USER_CSV_HEADER = [
  'ID',
  '邮箱',
  '昵称',
  '性别',
  '状态',
  '生日',
  '个性签名',
  '经验值',
  '最后登录',
  '注册时间',
];

/** 性别文案（导出用；与注册表单的取值一致）。 */
const USER_GENDER_LABEL: Record<string, string> = {
  male: '男',
  female: '女',
  secret: '保密',
};

/** 注销记录项（**不含用户标识**——注销即与身份脱钩，表里本来就没有）。 */
export interface ClientDeletionItem {
  id: number;
  /** 原因类型：no_time / too_hard / content / bugs / privacy / other / unspecified */
  reasonType: string;
  /** 用户自填的补充说明 */
  reasonDetail: string | null;
  /** 注销时的经验值快照 */
  xp: number;
  /** 注销时的累计打卡天数 */
  checkinDays: number;
  /** 注销时的答题数（近 30 天，答题记录只保留 30 天） */
  answerCount: number;
  /** 注册时间 */
  registeredAt: Date;
  /** 注销时间 */
  createdAt: Date;
  /** 账号存活天数（注册 → 注销），用来回答「用了多久才走」 */
  lifespanDays: number;
}

/** 注销记录列表（分页 + 全量原因分布）。 */
export interface ClientDeletionList extends PageResult<ClientDeletionItem> {
  /** 近 30 天注销数 */
  last30Days: number;
  /** 各原因计数（全量，不受分页影响），按数量倒序 */
  reasonStats: Array<{ reasonType: string; count: number }>;
}

/** 列表项。 */
export interface ClientUserItem {
  id: number;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  gender: string;
  /** 1 启用 / 0 禁用 */
  status: number;
  birthday: string | null;
  signature: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  /** 累计答题数 */
  answerCount: number;
  /** 累计答对数 */
  correctCount: number;
  /** 收藏数 */
  favoriteCount: number;
  /** 当前连续打卡天数 */
  streak: number;
}

/** 详情（含最近答题）。 */
export interface ClientUserDetail extends ClientUserItem {
  /** 累计打卡天数 */
  checkinDays: number;
  /** 最近答题记录 */
  recentAnswers: Array<{
    sentenceId: number;
    sentenceEn: string;
    translationZh: string;
    isCorrect: boolean;
    createdAt: Date;
  }>;
}

@Injectable()
export class ClientUsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** 分页查询（关键词匹配邮箱/昵称）。 */
  /**
   * 客户端用户筛选条件（列表与导出共用同一套，理由同题库）。
   */
  private buildUserWhere(query: Record<string, unknown>): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    const keyword = String(query.keyword ?? '').trim();
    if (keyword) {
      where.OR = [{ email: { contains: keyword } }, { nickname: { contains: keyword } }];
    }
    const status = query.status === undefined || query.status === '' ? undefined : Number(query.status);
    if (status === 0 || status === 1) {
      where.status = status;
    }
    const gender = String(query.gender ?? '').trim();
    if (gender) {
      where.gender = gender;
    }
    return where;
  }

  async list(query: Record<string, unknown>): Promise<PageResult<ClientUserItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where = this.buildUserWhere(query);

    const [rows, total] = await Promise.all([
      this.prisma.clientUser.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          email: true,
          nickname: true,
          avatarFileId: true,
          gender: true,
          status: true,
          birthday: true,
          signature: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      this.prisma.clientUser.count({ where }),
    ]);

    const stats = await this.batchStats(rows.map((row) => Number(row.id)));
    const list: ClientUserItem[] = [];
    for (const row of rows) {
      const id = Number(row.id);
      const stat = stats.get(id);
      list.push({
        id,
        email: row.email,
        nickname: row.nickname,
        avatarUrl: await this.resolveAvatar(row.avatarFileId),
        gender: row.gender,
        status: row.status,
        birthday: row.birthday ? row.birthday.toISOString().slice(0, 10) : null,
        signature: row.signature,
        lastLoginAt: row.lastLoginAt,
        createdAt: row.createdAt,
        answerCount: stat?.answerCount ?? 0,
        correctCount: stat?.correctCount ?? 0,
        favoriteCount: stat?.favoriteCount ?? 0,
        streak: stat?.streak ?? 0,
      });
    }
    return buildPageResult(list, total, page, pageSize);
  }

  /**
   * 账号注销记录（分页 + 原因分布）。
   *
   * 表里刻意没有 userId / 邮箱——注销即与身份脱钩。因此这里也**不能**按用户搜，
   * 只能按时间与原因看趋势；想追某个人是否注销了，看 client_user.deleted_at。
   */
  async deletions(query: Record<string, unknown>): Promise<ClientDeletionList> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const [rows, total, grouped, last30Days] = await Promise.all([
      this.prisma.clientAccountDeletion.findMany({
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.clientAccountDeletion.count(),
      this.prisma.clientAccountDeletion.groupBy({ by: ['reasonType'], _count: { _all: true } }),
      this.prisma.clientAccountDeletion.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

    const list: ClientDeletionItem[] = rows.map((row) => ({
      id: Number(row.id),
      reasonType: row.reasonType,
      reasonDetail: row.reasonDetail,
      xp: row.xp,
      checkinDays: row.checkinDays,
      answerCount: row.answerCount,
      registeredAt: row.registeredAt,
      createdAt: row.createdAt,
      lifespanDays: Math.max(
        0,
        Math.floor((row.createdAt.getTime() - row.registeredAt.getTime()) / (24 * 60 * 60 * 1000)),
      ),
    }));

    return {
      ...buildPageResult(list, total, page, pageSize),
      last30Days,
      reasonStats: grouped
        .map((item) => ({ reasonType: item.reasonType, count: item._count._all }))
        .sort((a, b) => b.count - a.count),
    };
  }

  /** 创建任务（流式 CSV；筛选与列表共用 buildUserWhere）。 */
  async createUserExport(query: Record<string, unknown>): Promise<CsvExportTask> {
    const where = this.buildUserWhere(query);
    const total = await this.prisma.clientUser.count({ where });
    assertExportable(total, '客户端用户');
    return {
      filename: `client-users-${Date.now()}.csv`,
      header: CLIENT_USER_CSV_HEADER,
      total,
      rows: this.userExportBatches(where, config.export.batchSize),
    };
  }

  private async *userExportBatches(where: Record<string, unknown>, batchSize: number): AsyncGenerator<unknown[][]> {
    let cursorId: bigint | undefined;
    for (;;) {
      const rows = await this.prisma.clientUser.findMany({
        where,
        orderBy: { id: 'desc' },
        take: batchSize,
        select: {
          id: true,
          email: true,
          nickname: true,
          gender: true,
          status: true,
          birthday: true,
          signature: true,
          xp: true,
          lastLoginAt: true,
          createdAt: true,
        },
        ...(cursorId === undefined ? {} : { cursor: { id: cursorId }, skip: 1 }),
      });
      if (rows.length === 0) {
        return;
      }
      cursorId = rows[rows.length - 1]!.id;
      yield rows.map((row) => [
        Number(row.id),
        row.email,
        row.nickname,
        USER_GENDER_LABEL[row.gender] ?? row.gender,
        row.status === 1 ? '启用' : '禁用',
        row.birthday ? row.birthday.toISOString().slice(0, 10) : '',
        row.signature ?? '',
        Number(row.xp),
        row.lastLoginAt ? formatDateTimeInZone(row.lastLoginAt) : '',
        formatDateTimeInZone(row.createdAt),
      ]);
      if (rows.length < batchSize) {
        return;
      }
    }
  }

  /** 详情（含最近 10 条答题）。 */
  async detail(id: number): Promise<ClientUserDetail> {
    const row = await this.prisma.clientUser.findUnique({
      where: { id: BigInt(id) },
      select: {
        id: true,
        email: true,
        nickname: true,
        avatarFileId: true,
        gender: true,
        status: true,
        birthday: true,
        signature: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!row) {
      throw AppException.notFound('用户不存在');
    }

    const userId = BigInt(id);
    const [stats, checkinDays, recent] = await Promise.all([
      this.batchStats([id]),
      this.prisma.userCheckin.count({ where: { userId } }),
      this.prisma.sentenceRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          sentenceId: true,
          isCorrect: true,
          createdAt: true,
          sentence: { select: { sentenceEn: true, translationZh: true } },
        },
      }),
    ]);

    const stat = stats.get(id);
    return {
      id,
      email: row.email,
      nickname: row.nickname,
      avatarUrl: await this.resolveAvatar(row.avatarFileId),
      gender: row.gender,
      status: row.status,
      birthday: row.birthday ? row.birthday.toISOString().slice(0, 10) : null,
      signature: row.signature,
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
      answerCount: stat?.answerCount ?? 0,
      correctCount: stat?.correctCount ?? 0,
      favoriteCount: stat?.favoriteCount ?? 0,
      streak: stat?.streak ?? 0,
      checkinDays,
      recentAnswers: recent.map((item) => ({
        sentenceId: Number(item.sentenceId),
        sentenceEn: item.sentence?.sentenceEn ?? '',
        translationZh: item.sentence?.translationZh ?? '',
        isCorrect: item.isCorrect === 1,
        createdAt: item.createdAt,
      })),
    };
  }

  /** 启用 / 禁用（禁用后登录直接 401）。 */
  async setStatus(id: number, status: number): Promise<void> {
    if (status !== 0 && status !== 1) {
      throw AppException.badRequest('状态值非法');
    }
    await this.ensureExists(id);
    await this.prisma.clientUser.update({
      where: { id: BigInt(id) },
      data: { status },
    });
  }

  /** 重置密码（同时令旧令牌失效）。 */
  async resetPassword(id: number, newPassword: string): Promise<void> {
    if (newPassword.length < PASSWORD_MIN_LENGTH || newPassword.length > PASSWORD_MAX_LENGTH) {
      throw AppException.badRequest(PASSWORD_LENGTH_MESSAGE);
    }
    if (!PASSWORD_COMPLEXITY_REGEX.test(newPassword)) {
      throw AppException.badRequest(PASSWORD_COMPLEXITY_MESSAGE);
    }
    const row = await this.ensureExists(id);
    if (newPassword.toLowerCase().includes(row.email.split('@')[0]!.toLowerCase())) {
      throw AppException.badRequest('密码不能包含账号信息');
    }
    await this.prisma.clientUser.update({
      where: { id: BigInt(id) },
      data: { password: await hashPassword(newPassword), passwordChangedAt: new Date() },
    });
  }

  /** 强制下线：只推进 passwordChangedAt，不改密码（旧令牌全部失效）。 */
  async forceOffline(id: number): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.clientUser.update({
      where: { id: BigInt(id) },
      data: { passwordChangedAt: new Date() },
    });
  }

  /**
   * 删除用户（级联清理学习数据）。
   *
   * 只删 client_user 自身拥有的业务表：答题 / 收藏 / 举报 / 打卡 / 句签 / 经验账本 / 成就。
   * **不动日志表**（login_log / http_log / operation_log / ai_call_log）：其 user_id 列与
   * 系统用户共用（同一列两种身份），且日志属审计痕迹——删用户不应抹掉历史操作记录。
   * 全部放在一个事务里，避免删到一半失败留下「半残用户」。
   */
  async remove(id: number): Promise<void> {
    await this.ensureExists(id);
    const userId = BigInt(id);
    await this.prisma.$transaction([
      this.prisma.sentenceRecord.deleteMany({ where: { userId } }),
      this.prisma.sentenceFavorite.deleteMany({ where: { userId } }),
      this.prisma.sentenceReport.deleteMany({ where: { userId } }),
      this.prisma.userCheckin.deleteMany({ where: { userId } }),
      this.prisma.userSentenceCard.deleteMany({ where: { userId } }),
      this.prisma.clientXpLog.deleteMany({ where: { userId } }),
      this.prisma.userAchievement.deleteMany({ where: { userId } }),
      this.prisma.clientUser.delete({ where: { id: userId } }),
    ]);
  }

  /** 批量统计（一次查询取齐，避免 N+1）。 */
  private async batchStats(
    ids: number[],
  ): Promise<Map<number, { answerCount: number; correctCount: number; favoriteCount: number; streak: number }>> {
    const map = new Map<number, { answerCount: number; correctCount: number; favoriteCount: number; streak: number }>();
    if (ids.length === 0) {
      return map;
    }
    const userIds = ids.map((id) => BigInt(id));
    const [answers, corrects, favorites, checkins] = await Promise.all([
      this.prisma.sentenceRecord.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
      this.prisma.sentenceRecord.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, isCorrect: 1 },
        _count: { _all: true },
      }),
      this.prisma.sentenceFavorite.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
      // 取每个用户最近一条打卡，用于展示「当前连续天数」
      this.prisma.userCheckin.findMany({
        where: { userId: { in: userIds } },
        orderBy: [{ userId: 'asc' }, { checkinDate: 'desc' }],
        select: { userId: true, streak: true, checkinDate: true },
      }),
    ]);

    for (const id of ids) {
      map.set(id, { answerCount: 0, correctCount: 0, favoriteCount: 0, streak: 0 });
    }
    for (const row of answers) {
      const stat = map.get(Number(row.userId));
      if (stat) {
        stat.answerCount = row._count._all;
      }
    }
    for (const row of corrects) {
      const stat = map.get(Number(row.userId));
      if (stat) {
        stat.correctCount = row._count._all;
      }
    }
    for (const row of favorites) {
      const stat = map.get(Number(row.userId));
      if (stat) {
        stat.favoriteCount = row._count._all;
      }
    }
    const seen = new Set<number>();
    for (const row of checkins) {
      const userId = Number(row.userId);
      if (seen.has(userId)) {
        continue;
      }
      seen.add(userId);
      const stat = map.get(userId);
      if (stat) {
        stat.streak = row.streak;
      }
    }
    return map;
  }

  /** 头像 URL（文件缺失返回 null）。 */
  private async resolveAvatar(avatarFileId: bigint): Promise<string | null> {
    if (avatarFileId <= 0n) {
      return null;
    }
    const file = await this.prisma.file.findUnique({
      where: { id: avatarFileId },
      select: { fileUrl: true },
    });
    return file?.fileUrl ?? null;
  }

  /** 存在性校验（返回基础字段）。公开给 controller 做成长 / 句签等接口的前置校验。 */
  async ensureExists(id: number): Promise<{ email: string }> {
    const row = await this.prisma.clientUser.findUnique({
      where: { id: BigInt(id) },
      select: { email: true },
    });
    if (!row) {
      throw AppException.notFound('用户不存在');
    }
    return row;
  }
}
