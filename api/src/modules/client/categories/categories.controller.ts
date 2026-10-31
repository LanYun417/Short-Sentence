/**
 * 场景分类控制器（/api/client/categories）。
 */
import { Controller, Get } from '@nestjs/common';
import { Public } from '../../../common/auth/auth.guard.js';
import { isFestivalName } from '../../../common/calendar/festivals.js';
import { PrismaService } from '../../../prisma/prisma.service.js';

/** 分类对外结构。 */
export interface ClientCategory {
  id: number;
  name: string;
  nameEn: string | null;
  icon: string | null;
  /** 就绪且未退场的题目数（题库页「按场景刷」入口展示用） */
  count: number;
}

@Controller('client/categories')
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 启用中的**日常场景**分类（按 sort 升序），附各分类的可刷题数。
   * 游客可访问（首页展示用）。
   *
   * - **排除节日分类**：节日有专属题库接口（/client/questions/festivals），
   *   混进来会在题库页出现两份「元旦」。
   * - 题数一次 groupBy 拿全量再内存合并：分类就两位数，不值得每行发一条 count。
   */
  @Public()
  @Get()
  async list(): Promise<ClientCategory[]> {
    const [rows, counts] = await Promise.all([
      this.prisma.sentenceCategory.findMany({
        where: { status: 1 },
        orderBy: [{ sort: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true, nameEn: true, icon: true },
      }),
      this.prisma.sentence.groupBy({
        by: ['categoryId'],
        where: { status: 'ready', retiredAt: null },
        _count: { _all: true },
      }),
    ]);
    const countById = new Map(counts.map((row) => [Number(row.categoryId), row._count._all]));
    return rows
      .filter((row) => !isFestivalName(row.name))
      .map((row) => ({
        id: Number(row.id),
        name: row.name,
        nameEn: row.nameEn,
        icon: row.icon,
        count: countById.get(Number(row.id)) ?? 0,
      }));
  }
}
