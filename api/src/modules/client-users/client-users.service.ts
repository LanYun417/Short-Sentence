/**
 * 客户端用户管理服务（运营后台）。
 * 模块职责：分页查询 / 详情（含学习数据）/ 启停 / 重置密码 / 强制下线。
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
} from '../../common/auth/password-policy.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { buildPageResult, hashPassword, parsePagination } from '../../common/utils/utils.js';
import type { PageResult } from '../../common/types.js';

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
  async list(query: Record<string, unknown>): Promise<PageResult<ClientUserItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const keyword = String(query.keyword ?? '').trim();
    const status = query.status === undefined || query.status === '' ? undefined : Number(query.status);
    const gender = String(query.gender ?? '').trim();

    const where: Record<string, unknown> = {};
    if (keyword) {
      where.OR = [{ email: { contains: keyword } }, { nickname: { contains: keyword } }];
    }
    if (status === 0 || status === 1) {
      where.status = status;
    }
    if (gender) {
      where.gender = gender;
    }

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
    if (newPassword.length < 6 || newPassword.length > 32) {
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

  /** 存在性校验（返回基础字段）。 */
  private async ensureExists(id: number): Promise<{ email: string }> {
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
