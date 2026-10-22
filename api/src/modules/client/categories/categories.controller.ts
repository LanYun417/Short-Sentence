/**
 * 场景分类控制器（/api/client/categories）。
 */
import { Controller, Get } from '@nestjs/common';
import { Public } from '../../../common/auth/auth.guard.js';
import { PrismaService } from '../../../prisma/prisma.service.js';

/** 分类对外结构。 */
export interface ClientCategory {
  id: number;
  name: string;
  nameEn: string | null;
  icon: string | null;
}

@Controller('client/categories')
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  /** 启用中的分类（按 sort 升序）。游客可访问（首页展示用）。 */
  @Public()
  @Get()
  async list(): Promise<ClientCategory[]> {
    const rows = await this.prisma.sentenceCategory.findMany({
      where: { status: 1 },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, nameEn: true, icon: true },
    });
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      nameEn: row.nameEn,
      icon: row.icon,
    }));
  }
}
