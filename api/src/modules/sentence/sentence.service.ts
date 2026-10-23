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
import type { PageResult } from '../../common/types.js';
import { SENTENCE_STATUS, SaveCategoryDto, SaveSentenceDto } from './sentence.dto.js';

/** 列表条目（含配图 URL 与分类名）。 */
export interface SentenceItem {
  id: number;
  categoryId: number;
  categoryName: string | null;
  sentenceEn: string;
  translationZh: string;
  ipa: string | null;
  scenePrompt: string;
  difficulty: number;
  imageFileId: number;
  imageUrl: string | null;
  source: string;
  status: string;
  genTaskId: number;
  createdAt: Date;
  updatedAt: Date;
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

  /** 分页筛选（状态/分类/难度/关键词）。 */
  async list(query: Record<string, unknown>): Promise<PageResult<SentenceItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where: Record<string, unknown> = {};
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
        scenePrompt: row.scenePrompt,
        difficulty: row.difficulty,
        imageFileId: Number(row.imageFileId),
        imageUrl:
          row.imageFileId > 0n ? ((await this.fileService.findById(Number(row.imageFileId)))?.fileUrl ?? null) : null,
        source: row.source,
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
      scenePrompt: row.scenePrompt,
      difficulty: row.difficulty,
      imageFileId: Number(row.imageFileId),
      imageUrl:
        row.imageFileId > 0n ? ((await this.fileService.findById(Number(row.imageFileId)))?.fileUrl ?? null) : null,
      source: row.source,
      status: row.status,
      genTaskId: Number(row.genTaskId),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
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

  private defaultScenePrompt(sentenceEn: string): string {
    return `Two people having a natural conversation in a everyday setting, one of them saying "${sentenceEn.slice(0, 120)}", warm natural light, 16:9 composition, no text in image`;
  }
}
