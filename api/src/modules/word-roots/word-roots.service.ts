/**
 * 词根词典管理服务（运营后台）。
 * 模块职责：词条列表 / 详情 / 编辑（音标·释义·结构化解析）/ 删除 / 按单词立即解析入库。
 *
 * 「批量补词」不在这里做：那是一条 100 词 × 4s 的长任务（约 7 分钟），
 * 同步接口必然超时，交给既有的定时任务页（系统管理 → 定时任务 → word-root-ingest）手动执行。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { buildPageResult, parsePagination, readString } from '../../common/utils/utils.js';
import type { PageResult } from '../../common/types.js';
import { WordRootService, type WordPart } from '../client/word-root/word-root.service.js';
import type { UpdateWordRootDto } from './word-roots.dto.js';

/** 结构化解析（落在 WordRoot.analysis 的 JSON 形状）。 */
interface WordRootAnalysisShape {
  parts: WordPart[];
  explanation: string;
  related: string[];
}

/** 列表项。 */
export interface WordRootAdminItem extends WordRootAnalysisShape {
  id: number;
  word: string;
  phonetic: string | null;
  meaning: string | null;
  source: string;
  searchCount: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class WordRootsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wordRoot: WordRootService,
  ) {}

  /** 分页列表（热度优先，热度相同按更新时间）。 */
  async list(query: Record<string, unknown>): Promise<PageResult<WordRootAdminItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where: Record<string, unknown> = {};

    const keyword = readString(query.keyword);
    if (keyword) {
      where.word = { contains: keyword.trim().toLowerCase() };
    }
    const source = readString(query.source);
    if (source) {
      where.source = source;
    }

    const [rows, total] = await Promise.all([
      this.prisma.wordRoot.findMany({
        where,
        orderBy: [{ searchCount: 'desc' }, { updatedAt: 'desc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.wordRoot.count({ where }),
    ]);
    return buildPageResult(
      rows.map((row) => this.toItem(row)),
      total,
      page,
      pageSize,
    );
  }

  /** 详情。 */
  async detail(id: number): Promise<WordRootAdminItem> {
    const row = await this.prisma.wordRoot.findUnique({ where: { id: BigInt(id) } });
    if (!row) {
      throw AppException.notFound('词条不存在');
    }
    return this.toItem(row);
  }

  /** 编辑（只允许改音标 / 释义 / 解析结果，单词本身是业务键不可改）。 */
  async update(id: number, dto: UpdateWordRootDto): Promise<null> {
    const existing = await this.prisma.wordRoot.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!existing) {
      throw AppException.notFound('词条不存在');
    }

    const data: Record<string, unknown> = {};
    if (dto.phonetic !== undefined) {
      data.phonetic = dto.phonetic.trim() || null;
    }
    if (dto.meaning !== undefined) {
      data.meaning = dto.meaning.trim() || null;
    }
    if (dto.analysisJson !== undefined) {
      data.analysis = this.parseAnalysis(dto.analysisJson);
    }
    if (Object.keys(data).length === 0) {
      return null;
    }

    await this.prisma.wordRoot.update({ where: { id: BigInt(id) }, data });
    return null;
  }

  /** 删除。 */
  async remove(id: number): Promise<null> {
    const existing = await this.prisma.wordRoot.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!existing) {
      throw AppException.notFound('词条不存在');
    }
    await this.prisma.wordRoot.delete({ where: { id: BigInt(id) } });
    return null;
  }

  /**
   * 按单词立即解析并入库（命中缓存则直接返回，不重复调 AI）。
   * 单条通常 3~10s，前端按钮转 loading 即可。
   */
  async analyze(word: string): Promise<WordRootAdminItem> {
    const normalized = word.trim().toLowerCase();
    try {
      await this.wordRoot.lookup(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw AppException.badRequest(`解析失败：${message.slice(0, 200)}`);
    }
    const row = await this.prisma.wordRoot.findUnique({ where: { word: normalized } });
    if (!row) {
      throw AppException.badRequest('解析未产出词条，请稍后重试');
    }
    return this.toItem(row);
  }

  /** 校验并解析前端提交的 JSON 文本。 */
  private parseAnalysis(raw: string): WordRootAnalysisShape {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw AppException.badRequest('解析结果不是合法 JSON');
    }
    if (typeof parsed !== 'object' || parsed === null) {
      throw AppException.badRequest('解析结果必须是 JSON 对象');
    }
    const source = parsed as { parts?: unknown; explanation?: unknown; related?: unknown };
    if (!Array.isArray(source.parts)) {
      throw AppException.badRequest('解析结果必须包含 parts 数组');
    }
    const parts = source.parts.filter(
      (part): part is WordPart =>
        typeof part === 'object' &&
        part !== null &&
        typeof (part as WordPart).type === 'string' &&
        typeof (part as WordPart).text === 'string',
    );
    if (parts.length === 0) {
      throw AppException.badRequest('parts 至少需要一项，且每项含 type 与 text');
    }
    return {
      parts,
      explanation: typeof source.explanation === 'string' ? source.explanation : '',
      related: Array.isArray(source.related)
        ? source.related.filter((item): item is string => typeof item === 'string')
        : [],
    };
  }

  /** 行 → 列表项（把 analysis JSON 展开成结构化字段）。 */
  private toItem(row: {
    id: bigint;
    word: string;
    phonetic: string | null;
    meaning: string | null;
    analysis: unknown;
    source: string;
    searchCount: number;
    createdAt: Date;
    updatedAt: Date;
  }): WordRootAdminItem {
    const analysis = row.analysis as Partial<WordRootAnalysisShape> | null;
    return {
      id: Number(row.id),
      word: row.word,
      phonetic: row.phonetic,
      meaning: row.meaning,
      parts: Array.isArray(analysis?.parts) ? analysis.parts : [],
      explanation: typeof analysis?.explanation === 'string' ? analysis.explanation : '',
      related: Array.isArray(analysis?.related) ? analysis.related : [],
      source: row.source,
      searchCount: row.searchCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
