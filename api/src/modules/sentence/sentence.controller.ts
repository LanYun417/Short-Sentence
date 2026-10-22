/**
 * 题库管理控制器（/api/sentences）。
 * 权限口径：RBAC 权限码 sentence:*（超管直通）；写操作 @OperationLog 留痕。
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { type ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { buildPageResult, parsePagination } from '../../common/utils/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SentenceService } from './sentence.service.js';
import { SentenceGenService } from './sentence-gen.service.js';
import { SaveSentenceDto, TriggerGenDto } from './sentence.dto.js';

/** 生成批次列表项。 */
export interface GenTaskItem {
  id: number;
  bizDate: string;
  targetCount: number;
  textDone: number;
  imageDone: number;
  failCount: number;
  status: string;
  triggerType: string;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}

@Controller('sentences')
export class SentenceController {
  constructor(
    private readonly sentenceService: SentenceService,
    private readonly sentenceGen: SentenceGenService,
    private readonly prisma: PrismaService,
  ) {}

  /** 分页列表（筛选：status/categoryId/difficulty/keyword）。 */
  @Get()
  @RequirePermissions('sentence:list')
  list(@Query() query: Record<string, unknown>) {
    return this.sentenceService.list(query);
  }

  /** 详情。 */
  @Get(':id')
  @RequirePermissions('sentence:query')
  detail(@Param() params: IdParamDto) {
    return this.sentenceService.detail(params.id);
  }

  /** 生成批次列表（运营监控）。 */
  @Get('gen-tasks')
  @RequirePermissions('sentence:gen')
  async genTasks(@Query() query: Record<string, unknown>) {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const [rows, total] = await Promise.all([
      this.prisma.sentenceGenTask.findMany({ orderBy: { id: 'desc' }, skip: offset, take: limit }),
      this.prisma.sentenceGenTask.count(),
    ]);
    const list: GenTaskItem[] = rows.map((row) => ({
      id: Number(row.id),
      bizDate: row.bizDate,
      targetCount: row.targetCount,
      textDone: row.textDone,
      imageDone: row.imageDone,
      failCount: row.failCount,
      status: row.status,
      triggerType: row.triggerType,
      errorMessage: row.errorMessage,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      createdAt: row.createdAt,
    }));
    return buildPageResult(list, total, page, pageSize);
  }

  /** 手动触发批量生成（异步执行，进度看批次列表）。 */
  @Post('gen/batch')
  @RequirePermissions('sentence:gen')
  @OperationLog('题库管理', '触发生成')
  async triggerGen(@Body() dto: TriggerGenDto): Promise<ResponseEnvelope<{ taskId: number }>> {
    const result = await this.sentenceGen.triggerManual(dto.count);
    return { __raw: true, data: result, message: '生成任务已启动' };
  }

  /** 手工创建题目。 */
  @Post()
  @RequirePermissions('sentence:add')
  @OperationLog('题库管理', '新增题目')
  async create(@Body() dto: SaveSentenceDto): Promise<ResponseEnvelope<{ id: number }>> {
    const result = await this.sentenceService.create(dto);
    return { __raw: true, data: result, message: '新增成功' };
  }

  /** 编辑题目。 */
  @Put(':id')
  @RequirePermissions('sentence:edit')
  @OperationLog('题库管理', '编辑题目')
  async update(@Param() params: IdParamDto, @Body() dto: SaveSentenceDto): Promise<ResponseEnvelope<null>> {
    await this.sentenceService.update(params.id, dto);
    return { __raw: true, data: null, message: '保存成功' };
  }

  /** 下架题目（软删除）。 */
  @Delete(':id')
  @RequirePermissions('sentence:remove')
  @OperationLog('题库管理', '下架题目')
  async remove(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    await this.sentenceService.remove(params.id);
    return { __raw: true, data: null, message: '已下架' };
  }
}
