/**
 * 题库管理服务（管理端）。
 * 模块职责：句子 CRUD、分页筛选、配图 URL 解析。
 * 生成流水线在 sentence-gen.service.ts（本文件不涉及 AI 调用）。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import { FileService } from '../../common/file/file.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { buildPageResult, parsePagination, readNumber, readString } from '../../common/utils/utils.js';
import type { CsvExportTask } from '../../common/utils/csv-stream.js';
import { assertExportable } from '../../common/utils/csv-stream.js';
import type { PageResult } from '../../common/types.js';
import { config } from '../../common/config/config.js';
import { SENTENCE_STATUS, SaveCategoryDto, SaveSentenceDto, type SentenceStatus } from './sentence.dto.js';

/** 导出表头（与列表列顺序一致，方便运营对照）。 */
const SENTENCE_CSV_HEADER = [
  'ID',
  '英文句子',
  '中文释义',
  '音标',
  '分类',
  '难度',
  '状态',
  '来源',
  '备用答案',
  '生图提示词',
  '生成批次',
];

/** 难度文案（导出用；与后台的 DIFFICULTY_LABEL 一致）。 */
const DIFFICULTY_LABEL: Record<number, string> = { 1: '基础', 2: '进阶', 3: '挑战' };

/** 状态文案（导出用；与后台的 STATUS_TAG 一致）。 */
const SENTENCE_STATUS_LABEL: Record<string, string> = {
  pending_image: '待生成',
  ready: '就绪',
  offline: '已下架',
};

/** 备用答案 JSON 列 → 可读字符串（解析失败原样返回，不丢数据也不中断导出）。 */
function safeAlternates(raw: string | null): string {
  if (!raw) {
    return '';
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').join(' | ') : raw;
  } catch {
    return raw;
  }
}

/** 列表条目（含配图 URL 与分类名）。 */
export interface SentenceItem {
  id: number;
  categoryId: number;
  categoryName: string | null;
  sentenceEn: string;
  translationZh: string;
  ipa: string | null;
  /** 题目解析（语法 / 时态 / 词形；运营可手工修订） */
  explanation: string | null;
  scenePrompt: string;
  difficulty: number;
  imageFileId: number;
  imageUrl: string | null;
  source: string;
  /** AI 生成时实际使用的文本通道：agnes / nim（手工题与旧数据为 null） */
  aiChannel: string | null;
  /** AI 生成时实际使用的文本模型名（同上） */
  aiModel: string | null;
  status: string;
  genTaskId: number;
  createdAt: Date;
  updatedAt: Date;
  /** 逐词释义（JSON 字符串，词 → 本句含义；仅详情接口返回，列表不带以控制体积） */
  wordMeanings?: string | null;
  /** 节日题库所属节日名（仅详情接口返回） */
  festivalName?: string | null;
  /** 节日公历日期 YYYY-MM-DD（仅详情接口返回） */
  festivalDate?: string | null;
}

/** 场景分类条目（含题目数）。 */
export interface CategoryItem {
  id: number;
  name: string;
  nameEn: string | null;
  icon: string | null;
  sort: number;
  status: number;
  /** 该分类下的题目数 */
  sentenceCount: number;
}

@Injectable()
export class SentenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  /**
   * 题库筛选条件（列表与导出共用同一套）。
   *
   * 抽成方法而不是两处各写一遍：一旦漂移，导出的数据和页面上看到的就不一致
   * （运营按页面筛选后导出，却发现多了几条——这种"S 级诡异"最难排查）。
   */
  private buildSentenceWhere(query: Record<string, unknown>): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    const id = readNumber(query.id);
    if (id !== undefined && Number.isInteger(id) && id > 0) {
      // 题目 ID 精确匹配（列表/导出共用；非法值忽略）
      where.id = BigInt(id);
    }
    const status = readString(query.status);
    if (status) {
      where.status = status;
    }
    const categoryId = readNumber(query.categoryId);
    if (categoryId !== undefined) {
      where.categoryId = BigInt(categoryId);
    }
    const difficulty = readNumber(query.difficulty);
    if (difficulty !== undefined) {
      where.difficulty = difficulty;
    }
    const keyword = readString(query.keyword);
    if (keyword) {
      where.OR = [{ sentenceEn: { contains: keyword } }, { translationZh: { contains: keyword } }];
    }
    return where;
  }

  /** 分页筛选（状态/分类/难度/关键词）。 */
  async list(query: Record<string, unknown>): Promise<PageResult<SentenceItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where = this.buildSentenceWhere(query);

    const [rows, total] = await Promise.all([
      this.prisma.sentence.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: offset,
        take: limit,
        include: { category: { select: { name: true } } },
      }),
      this.prisma.sentence.count({ where }),
    ]);

    const list: SentenceItem[] = await Promise.all(
      rows.map(async (row) => ({
        id: Number(row.id),
        categoryId: Number(row.categoryId),
        categoryName: row.category?.name ?? null,
        sentenceEn: row.sentenceEn,
        translationZh: row.translationZh,
        ipa: row.ipa,
        explanation: row.explanation,
        scenePrompt: row.scenePrompt,
        difficulty: row.difficulty,
        imageFileId: Number(row.imageFileId),
        imageUrl:
          row.imageFileId > 0n ? ((await this.fileService.findById(Number(row.imageFileId)))?.fileUrl ?? null) : null,
        source: row.source,
        aiChannel: row.aiChannel,
        aiModel: row.aiModel,
        status: row.status,
        genTaskId: Number(row.genTaskId),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    );
    return buildPageResult(list, total, page, pageSize);
  }

  /** 详情。 */
  async detail(id: number): Promise<SentenceItem> {
    const row = await this.prisma.sentence.findUnique({
      where: { id: BigInt(id) },
      include: { category: { select: { name: true } } },
    });
    if (!row) {
      throw AppException.notFound('题目不存在');
    }
    return {
      id: Number(row.id),
      categoryId: Number(row.categoryId),
      categoryName: row.category?.name ?? null,
      sentenceEn: row.sentenceEn,
      translationZh: row.translationZh,
      ipa: row.ipa,
      explanation: row.explanation,
      scenePrompt: row.scenePrompt,
      difficulty: row.difficulty,
      imageFileId: Number(row.imageFileId),
      imageUrl:
        row.imageFileId > 0n ? ((await this.fileService.findById(Number(row.imageFileId)))?.fileUrl ?? null) : null,
      source: row.source,
      aiChannel: row.aiChannel,
      aiModel: row.aiModel,
      status: row.status,
      genTaskId: Number(row.genTaskId),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      wordMeanings: row.wordMeanings,
      festivalName: row.festivalName,
      festivalDate: row.festivalDate,
    };
  }

  /** 手工创建（source=manual；未传 scenePrompt 时用句子本身构图）。 */
  async create(dto: SaveSentenceDto): Promise<{ id: number }> {
    const duplicate = await this.prisma.sentence.findUnique({
      where: { sentenceEn: dto.sentenceEn.trim() },
      select: { id: true },
    });
    if (duplicate) {
      throw AppException.conflict('相同英文句子已存在');
    }
    const row = await this.prisma.sentence.create({
      data: {
        categoryId: BigInt(dto.categoryId),
        sentenceEn: dto.sentenceEn.trim(),
        translationZh: dto.translationZh.trim(),
        ipa: dto.ipa?.trim() || null,
        explanation: dto.explanation?.trim() || null,
        scenePrompt: dto.scenePrompt?.trim() || this.defaultScenePrompt(dto.sentenceEn),
        difficulty: dto.difficulty ?? 2,
        source: 'manual',
        status: dto.status ?? SENTENCE_STATUS.PENDING_IMAGE,
      },
      select: { id: true },
    });
    return { id: Number(row.id) };
  }

  /** 编辑（句子本体可改，用于勘误；状态可上/下架）。 */
  async update(id: number, dto: SaveSentenceDto): Promise<void> {
    const existing = await this.prisma.sentence.findUnique({
      where: { id: BigInt(id) },
      select: { id: true },
    });
    if (!existing) {
      throw AppException.notFound('题目不存在');
    }
    if (dto.sentenceEn) {
      const duplicate = await this.prisma.sentence.findFirst({
        where: { sentenceEn: dto.sentenceEn.trim(), id: { not: existing.id } },
        select: { id: true },
      });
      if (duplicate) {
        throw AppException.conflict('相同英文句子已存在');
      }
    }
    await this.prisma.sentence.update({
      where: { id: existing.id },
      data: {
        categoryId: BigInt(dto.categoryId),
        sentenceEn: dto.sentenceEn.trim(),
        translationZh: dto.translationZh.trim(),
        ipa: dto.ipa?.trim() || null,
        explanation: dto.explanation?.trim() || null,
        // scenePrompt 非可空：缺省时用句子本身兜底构图（两人对话场景）
        scenePrompt: dto.scenePrompt?.trim() || this.defaultScenePrompt(dto.sentenceEn),
        difficulty: dto.difficulty ?? 2,
        status: dto.status ?? undefined,
      },
    });
  }

  /** 下架（软删除：置 offline，保留记录与图片）。 */
  async remove(id: number): Promise<void> {
    const existing = await this.prisma.sentence.findUnique({
      where: { id: BigInt(id) },
      select: { id: true },
    });
    if (!existing) {
      throw AppException.notFound('题目不存在');
    }
    await this.prisma.sentence.update({
      where: { id: existing.id },
      data: { status: SENTENCE_STATUS.OFFLINE },
    });
  }

  /**
   * 批量上下架（运营清理题库用）。
   *
   * @returns 实际变更条数
   *
   * 上架的额外约束：只对**已有配图**的题目置 ready。否则会把 pending_image
   * （还没生成图片）的题直接放出去，用户刷到一张没有图的闪卡。
   */
  async batchSetStatus(ids: number[], status: SentenceStatus): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }
    if (status === SENTENCE_STATUS.READY) {
      const result = await this.prisma.sentence.updateMany({
        where: { id: { in: ids }, imageFileId: { gt: BigInt(0) }, status: { not: SENTENCE_STATUS.READY } },
        data: { status: SENTENCE_STATUS.READY },
      });
      return result.count;
    }
    if (status === SENTENCE_STATUS.OFFLINE) {
      const result = await this.prisma.sentence.updateMany({
        where: { id: { in: ids }, status: { not: SENTENCE_STATUS.OFFLINE } },
        data: { status: SENTENCE_STATUS.OFFLINE },
      });
      return result.count;
    }
    // 不允许把题目批量改回 pending_image（生图流程的中间态，只应由生图任务推进）
    throw AppException.badRequest('不支持的批量状态');
  }

  /**
   * 题库导出任务（流式 CSV；筛选与列表共用 buildSentenceWhere）。
   *
   * 用游标分页而非 offset：导出期间可能有新题入库，offset 会重复/漏行，
   * 游标按主键推进则稳定。
   */
  async createSentenceExport(query: Record<string, unknown>): Promise<CsvExportTask> {
    const where = this.buildSentenceWhere(query);
    const total = await this.prisma.sentence.count({ where });
    assertExportable(total, '题库');
    return {
      filename: `sentences-${Date.now()}.csv`,
      header: SENTENCE_CSV_HEADER,
      total,
      rows: this.sentenceExportBatches(where, config.export.batchSize),
    };
  }

  private async *sentenceExportBatches(where: Record<string, unknown>, batchSize: number): AsyncGenerator<unknown[][]> {
    let cursorId: bigint | undefined;
    for (;;) {
      const rows = await this.prisma.sentence.findMany({
        where,
        orderBy: { id: 'desc' },
        take: batchSize,
        include: { category: { select: { name: true } } },
        ...(cursorId === undefined ? {} : { cursor: { id: cursorId }, skip: 1 }),
      });
      if (rows.length === 0) {
        return;
      }
      cursorId = rows[rows.length - 1]!.id;
      yield rows.map((row) => [
        Number(row.id),
        row.sentenceEn,
        row.translationZh,
        row.ipa ?? '',
        row.category?.name ?? '',
        DIFFICULTY_LABEL[row.difficulty] ?? String(row.difficulty),
        SENTENCE_STATUS_LABEL[row.status] ?? row.status,
        row.source === 'ai' ? 'AI' : '手工',
        // alternateAnswers 是 JSON 字符串列：解析失败就原样导出，别让一个字卡住整批
        safeAlternates(row.alternateAnswers),
        row.scenePrompt,
        Number(row.genTaskId) > 0 ? Number(row.genTaskId) : '',
      ]);
      if (rows.length < batchSize) {
        return;
      }
    }
  }

  /** 无生图提示词时的兜底构图（仍是两人对话场景）。 */
  /* ------------------------------ 场景分类 ------------------------------ */

  /** 分类列表（含题目数）。 */
  async listCategories(): Promise<CategoryItem[]> {
    const [rows, counts] = await Promise.all([
      this.prisma.sentenceCategory.findMany({ orderBy: { sort: 'asc' } }),
      this.prisma.sentence.groupBy({ by: ['categoryId'], _count: { _all: true } }),
    ]);
    const countMap = new Map(counts.map((row) => [Number(row.categoryId), row._count._all]));
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      nameEn: row.nameEn,
      icon: row.icon,
      sort: row.sort,
      status: row.status,
      sentenceCount: countMap.get(Number(row.id)) ?? 0,
    }));
  }

  /** 新增分类（名称唯一）。 */
  async createCategory(dto: SaveCategoryDto): Promise<{ id: number }> {
    const name = dto.name.trim();
    const existing = await this.prisma.sentenceCategory.findFirst({ where: { name }, select: { id: true } });
    if (existing) {
      throw AppException.conflict('分类名称已存在');
    }
    const row = await this.prisma.sentenceCategory.create({
      data: {
        name,
        nameEn: dto.nameEn?.trim() || null,
        icon: dto.icon?.trim() || null,
        sort: dto.sort ?? 0,
        status: dto.status ?? 1,
      },
      select: { id: true },
    });
    return { id: Number(row.id) };
  }

  /** 编辑分类。 */
  async updateCategory(id: number, dto: SaveCategoryDto): Promise<void> {
    const row = await this.prisma.sentenceCategory.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!row) {
      throw AppException.notFound('分类不存在');
    }
    const name = dto.name.trim();
    const duplicated = await this.prisma.sentenceCategory.findFirst({
      where: { name, id: { not: BigInt(id) } },
      select: { id: true },
    });
    if (duplicated) {
      throw AppException.conflict('分类名称已存在');
    }
    await this.prisma.sentenceCategory.update({
      where: { id: BigInt(id) },
      data: {
        name,
        nameEn: dto.nameEn?.trim() || null,
        icon: dto.icon?.trim() || null,
        sort: dto.sort ?? 0,
        status: dto.status ?? 1,
      },
    });
  }

  /** 删除分类（有题目引用时拒绝，避免题目失去分类）。 */
  async removeCategory(id: number): Promise<void> {
    const row = await this.prisma.sentenceCategory.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!row) {
      throw AppException.notFound('分类不存在');
    }
    const used = await this.prisma.sentence.count({ where: { categoryId: BigInt(id) } });
    if (used > 0) {
      throw AppException.conflict(`该分类下还有 ${used} 道题，请先迁移或下架`);
    }
    await this.prisma.sentenceCategory.delete({ where: { id: BigInt(id) } });
  }

  /**
   * 清理过期的答题记录（默认保留最近 30 天，不论对错）。
   *
   * 只删 `sentence_record`：收藏（用户主动标记）与经验/成就账本（独立表）都不受影响。
   * 副作用：超过保留期的错题不再出现在复习池——这正是「历史只保留一个月」的语义。
   *
   * @returns 删除条数（未启用 / 保留天数为 0 时返回 0）
   */
  async cleanupAnswerRecords(): Promise<number> {
    const days = config.sentence.recordRetentionDays;
    if (!config.sentence.recordRetentionEnabled || days <= 0) {
      return 0;
    }
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.sentenceRecord.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return count;
  }

  private defaultScenePrompt(sentenceEn: string): string {
    return `Two people having a natural conversation in a everyday setting, one of them saying "${sentenceEn.slice(0, 120)}", warm natural light, 16:9 composition, no text in image`;
  }
}
