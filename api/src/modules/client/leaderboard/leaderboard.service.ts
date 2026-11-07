/**
 * 排行榜服务（客户端）：今日 / 近 7 天 / 近 30 天的答题数与答对数，以及累计打卡天数，各前 100。
 *
 * 口径：
 * - 「今日」按**服务器本地日**切分（dayjs startOf/endOf，与 analytics 一致；服务器为东八区）；
 * - 「周 / 月」是最近 7 / 30 个自然日的滚动窗口，起点同样按本地日零点对齐；
 * - 数据来源 sentence_record（答题记录）：答题数 = 记录数，答对数 = is_correct 求和；
 * - 打卡榜来自 user_checkin（不受答题记录保留期清理），全历史累计；
 * - 只统计启用（status=1）的客户端用户；头像取 sys_file.file_url（avatar_file_id=0 为默认头像）；
 * - 名次为标准竞赛排名（同分同名次），并列按 userId 升序保证稳定；
 * - 除 top100 外返回当前用户名次 me（未上榜为 null）。
 *
 * 缓存：整张榜（top + 全量精简名次）按 type + 本地日缓存 60 秒，Redis 优先、进程内兜底。
 * **缓存内容不含用户维度**：me 在每次请求里从缓存的全量名次中按 userId 取，避免串名次。
 */
import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { RedisService } from '../../../common/redis/redis.service.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { isCorrectLeaderboard, leaderboardDays, leaderboardUnit, type LeaderboardType } from './leaderboard.dto.js';

export interface LeaderboardRow {
  rank: number;
  userId: number;
  nickname: string;
  avatarUrl: string | null;
  count: number;
}

export interface LeaderboardResult {
  type: LeaderboardType;
  /** 榜单展示单位：题 / 天 */
  unit: string;
  /** 榜单统计截止自然日 YYYY-MM-DD（服务器本地日） */
  date: string;
  top: LeaderboardRow[];
  /** 当前用户名次；未上榜为 null */
  me: { rank: number; count: number } | null;
}

/** 可缓存的榜单快照：top 用于展示，ranks 用于给任意用户算 me。 */
export interface LeaderboardBoard {
  type: LeaderboardType;
  unit: string;
  date: string;
  top: LeaderboardRow[];
  /** 全量精简名次 [userId, rank, count]，字段名压短以减小缓存体积 */
  ranks: Array<{ u: number; r: number; c: number }>;
}

/** 聚合行（与 prisma groupBy 结果同构，抽出来便于单测纯排名逻辑）。 */
export interface AggRow {
  userId: bigint;
  /** 窗口内答题记录数 */
  countAll: number;
  /** 窗口内答对数（is_correct 求和） */
  sumCorrect: number;
}

export interface UserInfo {
  nickname: string;
  avatarFileId: bigint;
}

/**
 * 纯函数：把聚合行 + 用户信息排成可缓存的榜单快照（不查库，便于单测）。
 * @param agg 各用户聚合
 * @param users userId -> 昵称/头像文件 id（仅启用用户）
 * @param fileUrls avatarFileId -> fileUrl
 * @param type 榜单类型
 * @param topN 取前 N（默认 100）
 */
export function rankLeaderboard(
  agg: AggRow[],
  users: Map<bigint, UserInfo>,
  fileUrls: Map<bigint, string>,
  type: LeaderboardType,
  topN = 100,
): LeaderboardBoard {
  const date = dayjs().format('YYYY-MM-DD');
  const correct = isCorrectLeaderboard(type);
  const rows = agg
    .map((r) => {
      const u = users.get(r.userId);
      if (!u) return null;
      const count = correct ? r.sumCorrect : r.countAll;
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

  return {
    type,
    unit: leaderboardUnit(type),
    date,
    top: ranked.slice(0, topN),
    ranks: ranked.map((r) => ({ u: r.userId, r: r.rank, c: r.count })),
  };
}

/** 兼容原有纯排名单测：在快照基础上补当前用户的 me。 */
export function computeLeaderboard(
  agg: AggRow[],
  users: Map<bigint, UserInfo>,
  fileUrls: Map<bigint, string>,
  type: LeaderboardType,
  myUserId: number,
  topN = 100,
): LeaderboardResult {
  const { ranks, ...board } = rankLeaderboard(agg, users, fileUrls, type, topN);
  const me = ranks.find((r) => r.u === myUserId);
  return { ...board, me: me ? { rank: me.r, count: me.c } : null };
}

/** 缓存 TTL：60 秒。榜单是聚合读，短暂延迟不影响体感，但能挡住刷新/多端同时拉取。 */
const BOARD_TTL_MS = 60_000;

function parseBoard(raw: string | null | undefined): LeaderboardBoard | null {
  if (!raw) return null;
  try {
    const board = JSON.parse(raw) as LeaderboardBoard;
    if (
      !board ||
      typeof board.date !== 'string' ||
      typeof board.unit !== 'string' ||
      !Array.isArray(board.top) ||
      !Array.isArray(board.ranks)
    ) {
      return null;
    }
    return board;
  } catch {
    return null; // 缓存被写坏/旧格式：按 miss 处理，重建即可
  }
}

@Injectable()
export class LeaderboardService {
  static readonly TOP_N = 100;
  /** 进程内兜底缓存：Redis 未配置或故障也让 60s 缓存生效；键最多 7 个，无需 LRU。 */
  private readonly local = new Map<string, { expiresAt: number; raw: string }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** 取榜：命中缓存直接组装 me，未命中才查库聚合。 */
  async fetch(type: LeaderboardType, myUserId: number): Promise<LeaderboardResult> {
    const board = await this.board(type);
    const me = board.ranks.find((r) => r.u === myUserId);
    return {
      type: board.type,
      unit: board.unit,
      date: board.date,
      top: board.top,
      me: me ? { rank: me.r, count: me.c } : null,
    };
  }

  /** 带缓存的整榜快照（不含用户维度）。 */
  private async board(type: LeaderboardType): Promise<LeaderboardBoard> {
    const key = `leaderboard:v2:${type}:${dayjs().format('YYYY-MM-DD')}`;

    // Redis 优先（多实例共享）；未启用 / 故障时回落进程内缓存
    const shared = this.redis.isReady() ? parseBoard(await this.redis.get(key)) : null;
    if (shared) return shared;
    const local = this.readLocal(key);
    if (local) return local;

    const board = await this.buildBoard(type);
    const raw = JSON.stringify(board);
    this.writeLocal(key, raw);
    if (this.redis.isReady()) {
      // RedisService 是降级优先设计，写入失败不抛错，进程内缓存仍在
      await this.redis.set(key, raw, BOARD_TTL_MS);
    }
    return board;
  }

  private readLocal(key: string): LeaderboardBoard | null {
    const hit = this.local.get(key);
    if (!hit) return null;
    if (hit.expiresAt <= Date.now()) {
      this.local.delete(key);
      return null;
    }
    return parseBoard(hit.raw);
  }

  private writeLocal(key: string, raw: string): void {
    const now = Date.now();
    for (const [k, v] of this.local) {
      if (v.expiresAt <= now) this.local.delete(k);
    }
    this.local.set(key, { expiresAt: now + BOARD_TTL_MS, raw });
  }

  /** 查库聚合：今日/周/月走 sentence_record 窗口，打卡榜走 user_checkin 全历史。 */
  private async buildBoard(type: LeaderboardType): Promise<LeaderboardBoard> {
    const days = leaderboardDays(type);
    let agg: AggRow[];
    if (days === 0) {
      const rows = await this.prisma.userCheckin.groupBy({
        by: ['userId'],
        _count: { _all: true },
      });
      agg = rows.map((r) => ({ userId: r.userId, countAll: r._count._all, sumCorrect: 0 }));
    } else {
      const start = dayjs()
        .subtract(days - 1, 'day')
        .startOf('day')
        .toDate();
      const end = dayjs().endOf('day').toDate();
      const rows = await this.prisma.sentenceRecord.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: start, lte: end } },
        _count: { _all: true },
        _sum: { isCorrect: true },
      });
      agg = rows.map((r) => ({
        userId: r.userId,
        countAll: r._count._all,
        sumCorrect: r._sum.isCorrect ?? 0,
      }));
    }

    if (agg.length === 0) {
      return {
        type,
        unit: leaderboardUnit(type),
        date: dayjs().format('YYYY-MM-DD'),
        top: [],
        ranks: [],
      };
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

    return rankLeaderboard(agg, userMap, fileMap, type, LeaderboardService.TOP_N);
  }
}
