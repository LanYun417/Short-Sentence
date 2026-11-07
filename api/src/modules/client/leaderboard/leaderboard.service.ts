/**
 * 排行榜服务（客户端）：今日答题数 / 今日答对数前 100。
 *
 * 口径：
 * - 「今日」按**服务器本地日**切分（dayjs startOf/endOf，与 analytics 一致；服务器为东八区）；
 * - 数据来源 sentence_record（答题记录）：答题数 = 记录数，答对数 = is_correct 求和；
 * - 只统计启用（status=1）的客户端用户；头像取 sys_file.file_url（avatar_file_id=0 为默认头像）；
 * - 名次为标准竞赛排名（同分同名次），并列按 userId 升序保证稳定；
 * - 除 top100 外返回当前用户名次 me（未上榜为 null）。
 */
import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { LeaderboardType } from './leaderboard.dto.js';

export interface LeaderboardRow {
  rank: number;
  userId: number;
  nickname: string;
  avatarUrl: string | null;
  count: number;
}

export interface LeaderboardResult {
  type: LeaderboardType;
  /** 榜单所属自然日 YYYY-MM-DD（服务器本地日） */
  date: string;
  top: LeaderboardRow[];
  /** 当前用户名次；今天没产生有效答题（或 0 答对）时为 null */
  me: { rank: number; count: number } | null;
}

/** 聚合行（与 prisma groupBy 结果同构，抽出来便于单测纯排名逻辑）。 */
export interface AggRow {
  userId: bigint;
  /** 今日答题记录数 */
  countAll: number;
  /** 今日答对数（is_correct 求和） */
  sumCorrect: number;
}

export interface UserInfo {
  nickname: string;
  avatarFileId: bigint;
}

/**
 * 纯函数：把聚合行 + 用户信息排成榜单（不查库，便于单测）。
 * @param agg 今日各用户聚合
 * @param users userId -> 昵称/头像文件 id（仅启用用户）
 * @param fileUrls avatarFileId -> fileUrl
 * @param type 榜单类型
 * @param myUserId 当前用户 id（用于 me 名次）
 * @param topN 取前 N（默认 100）
 */
export function computeLeaderboard(
  agg: AggRow[],
  users: Map<bigint, UserInfo>,
  fileUrls: Map<bigint, string>,
  type: LeaderboardType,
  myUserId: number,
  topN = 100,
): LeaderboardResult {
  const date = dayjs().format('YYYY-MM-DD');
  const rows = agg
    .map((r) => {
      const u = users.get(r.userId);
      if (!u) return null;
      const count = type === 'today_correct' ? r.sumCorrect : r.countAll;
      if (count <= 0) return null; // 答对榜下 0 分不上榜
      return {
        userId: Number(r.userId),
        nickname: u.nickname,
        avatarUrl: u.avatarFileId > 0n ? (fileUrls.get(u.avatarFileId) ?? null) : null,
        count,
      };
    })
    .filter((r): r is { userId: number; nickname: string; avatarUrl: string | null; count: number } => r !== null);

  rows.sort((a, b) => b.count - a.count || a.userId - b.userId);

  // 标准竞赛排名：同分同名次（已按 count 降序，count 变化时 rank = 当前下标 + 1）
  let lastCount = -1;
  let lastRank = 0;
  const ranked: LeaderboardRow[] = rows.map((r, i) => {
    const rank = r.count === lastCount ? lastRank : i + 1;
    lastCount = r.count;
    lastRank = rank;
    return { ...r, rank };
  });

  const top = ranked.slice(0, topN);
  const meRow = ranked.find((r) => r.userId === myUserId);
  return {
    type,
    date,
    top,
    me: meRow ? { rank: meRow.rank, count: meRow.count } : null,
  };
}

@Injectable()
export class LeaderboardService {
  static readonly TOP_N = 100;

  constructor(private readonly prisma: PrismaService) {}

  /** 今日榜（答题数 / 答对数）。 */
  async today(type: LeaderboardType, myUserId: number): Promise<LeaderboardResult> {
    const start = dayjs().startOf('day').toDate();
    const end = dayjs().endOf('day').toDate();

    const agg = await this.prisma.sentenceRecord.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: start, lte: end } },
      _count: { _all: true },
      _sum: { isCorrect: true },
    });
    if (agg.length === 0) {
      return { type, date: dayjs().format('YYYY-MM-DD'), top: [], me: null };
    }

    const users = await this.prisma.clientUser.findMany({
      where: { id: { in: agg.map((r) => r.userId) }, status: 1 },
      select: { id: true, nickname: true, avatarFileId: true },
    });
    const userMap = new Map<bigint, UserInfo>(
      users.map((u) => [u.id, { nickname: u.nickname, avatarFileId: u.avatarFileId }]),
    );
    const fileIds = users.map((u) => u.avatarFileId).filter((id) => id > 0n);
    const files = fileIds.length
      ? await this.prisma.file.findMany({ where: { id: { in: fileIds } }, select: { id: true, fileUrl: true } })
      : [];
    const fileMap = new Map<bigint, string>(files.map((f) => [f.id, f.fileUrl]));

    return computeLeaderboard(
      agg.map((r) => ({
        userId: r.userId,
        countAll: r._count._all,
        sumCorrect: r._sum.isCorrect ?? 0,
      })),
      userMap,
      fileMap,
      type,
      myUserId,
      LeaderboardService.TOP_N,
    );
  }
}
