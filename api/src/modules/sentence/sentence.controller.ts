/**
 * 题库管理控制器（/api/sentences）。
 * 权限口径：RBAC 权限码 sentence:*（超管直通）；写操作 @OperationLog 留痕。
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { RawResponse, type ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { writeCsvStream } from '../../common/utils/csv-stream.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { buildPageResult, parsePagination } from '../../common/utils/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SentenceService } from './sentence.service.js';
import { SentenceGenService } from './sentence-gen.service.js';
import {
  SaveCategoryDto,
  SaveSentenceDto,
  TriggerGenDto,
  SENTENCE_STATUS,
  BatchSentenceStatusDto,
  BatchRegenerateImageDto,
  RegenerateImageDto,
} from './sentence.dto.js';

/** 生成批次列表项。 */
export interface GenTaskItem {
  id: number;
  bizDate: string;
  targetCount: number;
  textDone: number;
  imageDone: number;
  failCount: number;
  status: string;
  /** 当前阶段：generating / polishing / reviewing / imaging / done（空串 = 老数据） */
  stage: string;
  /** 最近心跳时间：前端据此区分「还在跑」与「卡住了」 */
  lastHeartbeatAt: Date | null;
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

  /**
   * 场景分类列表（含题目数）。
   * ⚠️ 必须声明在 `@Get(':id')` 之前：Nest 按声明顺序匹配，否则 `categories` 会被 `:id` 吃掉。
   */
  @Get('categories')
  @RequirePermissions('sentence:list')
  categories() {
    return this.sentenceService.listCategories();
  }

  /** 新增分类。 */
  @Post('categories')
  @RequirePermissions('sentence:category')
  @OperationLog('题库管理', '新增分类')
  async createCategory(@Body() dto: SaveCategoryDto): Promise<ResponseEnvelope<{ id: number }>> {
    const result = await this.sentenceService.createCategory(dto);
    return { __raw: true, data: result, message: '新增成功' };
  }

  /** 编辑分类。 */
  @Put('categories/:id')
  @RequirePermissions('sentence:category')
  @OperationLog('题库管理', '编辑分类')
  async updateCategory(@Param() params: IdParamDto, @Body() dto: SaveCategoryDto): Promise<ResponseEnvelope<null>> {
    await this.sentenceService.updateCategory(params.id, dto);
    return { __raw: true, data: null, message: '保存成功' };
  }

  /** 删除分类（有题目引用时拒绝）。 */
  @Delete('categories/:id')
  @RequirePermissions('sentence:category')
  @OperationLog('题库管理', '删除分类')
  async removeCategory(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    await this.sentenceService.removeCategory(params.id);
    return { __raw: true, data: null, message: '已删除' };
  }

  /**
   * 生成批次列表（运营监控）。
   * ⚠️ 必须声明在 `@Get(':id')` 之前：Nest 按声明顺序匹配，否则 `gen-tasks` 会被 `:id` 吃掉，
   * 触发 IdParamDto 校验 → 报「id 必须为正整数」（2026-10-24 真实缺陷：点「生成题库」后
   * 前端紧接着拉批次列表，于是刚提示成功就弹出这个错）。
   */
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
      stage: row.stage,
      lastHeartbeatAt: row.lastHeartbeatAt,
      triggerType: row.triggerType,
      errorMessage: row.errorMessage,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      createdAt: row.createdAt,
    }));
    return buildPageResult(list, total, page, pageSize);
  }

  /** 暂停批次（在下一个批次边界生效，最长等一个批次，约 1~2 分钟）。 */
  @Post('gen-tasks/:id/pause')
  @RequirePermissions('sentence:gen')
  @OperationLog('题库管理', '暂停生成')
  async pauseGenTask(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    await this.sentenceGen.pause(params.id);
    return { __raw: true, data: null, message: '已请求暂停，将在当前批次完成后停止' };
  }

  /** 继续批次（从已完成进度接着跑，不会重复生成）。 */
  @Post('gen-tasks/:id/resume')
  @RequirePermissions('sentence:gen')
  @OperationLog('题库管理', '继续生成')
  async resumeGenTask(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    await this.sentenceGen.resume(params.id);
    return { __raw: true, data: null, message: '已继续生成' };
  }

  /** 取消批次（终态 cancelled，之后可删除）。 */
  @Post('gen-tasks/:id/cancel')
  @RequirePermissions('sentence:gen')
  @OperationLog('题库管理', '取消生成')
  async cancelGenTask(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    await this.sentenceGen.cancel(params.id);
    return { __raw: true, data: null, message: '已请求取消，将在当前批次完成后停止' };
  }

  /** 删除批次（保留已配图题目，只清理未生成配图的题目）。 */
  @Delete('gen-tasks/:id')
  @RequirePermissions('sentence:gen')
  @OperationLog('题库管理', '删除批次')
  async removeGenTask(@Param() params: IdParamDto): Promise<ResponseEnvelope<{ removedSentences: number }>> {
    const result = await this.sentenceGen.remove(params.id);
    return {
      __raw: true,
      data: result,
      message: result.removedSentences > 0 ? `已删除（清理未配图题目 ${result.removedSentences} 条）` : '已删除',
    };
  }

  /** 详情。 */
  @Get(':id')
  @RequirePermissions('sentence:query')
  detail(@Param() params: IdParamDto) {
    return this.sentenceService.detail(params.id);
  }

  /**
   * 手动触发批量生成（异步执行，进度看批次列表）。
   * 传 difficulty 则本批全部出该难度（定向补某一档），否则按自然分布。
   */
  @Post('gen/batch')
  @RequirePermissions('sentence:gen')
  @OperationLog('题库管理', '触发生成')
  async triggerGen(@Body() dto: TriggerGenDto): Promise<ResponseEnvelope<{ taskId: number }>> {
    const result = await this.sentenceGen.triggerManual(dto.count, dto.difficulty);
    return {
      __raw: true,
      data: result,
      message: dto.difficulty ? `生成任务已启动（本批仅难度 ${dto.difficulty}）` : '生成任务已启动',
    };
  }

  /**
   * 导出题库 CSV（流式；筛选与列表共用同一套条件）。
   *
   * 权限用 `sentence:query` 而不是新增 `sentence:export`：导出是只读操作，
   * 且权限码是种子数据里写死的，为一个导出动作加码需要重跑 seed——收益不抵风险。
   */
  @Get('export')
  @RequirePermissions('sentence:query')
  @RawResponse()
  async exportSentences(@Query() query: Record<string, unknown>, @Res() res: Response): Promise<void> {
    // 任务构造阶段可能抛 400（超上限）；此时还没写响应头，前端能拿到正常 JSON 错误
    const task = await this.sentenceService.createSentenceExport(query);
    await writeCsvStream(res, task.filename, task.header, task.rows);
  }

  /** 批量上下架（运营清理题库用；上架只对已有配图的题生效）。 */
  @Post('batch-status')
  @RequirePermissions('sentence:edit')
  @OperationLog('题库管理', '批量上下架')
  async batchSetStatus(@Body() dto: BatchSentenceStatusDto): Promise<ResponseEnvelope<{ affected: number }>> {
    const affected = await this.sentenceService.batchSetStatus(dto.ids, dto.status);
    return {
      __raw: true,
      data: { affected },
      message:
        affected > 0
          ? `已${dto.status === SENTENCE_STATUS.OFFLINE ? '下架' : '上架'} ${affected} 条`
          : '没有符合条件的题目（上架仅对已生成配图的题生效）',
    };
  }

  /**
   * 批量重新生图（异步，立即返回；单题接口的批量版，换配图风格时用）。
   *
   * 与批量上下架不同，这里**不要求全部成功**：单题不存在、正在生成中、已有生图
   * 任务在跑的会被跳过并在响应里回给前端，其余题照常受理。
   */
  @Post('batch-regenerate-image')
  @RequirePermissions('sentence:gen')
  @OperationLog('题库管理', '批量重新生图')
  async batchRegenerateImage(
    @Body() dto: BatchRegenerateImageDto,
  ): Promise<ResponseEnvelope<{ accepted: number[]; skipped: number[] }>> {
    const result = await this.sentenceGen.regenerateImages(dto.ids);
    const { accepted, skipped } = result;
    return {
      __raw: true,
      data: { accepted, skipped },
      message:
        accepted.length > 0
          ? `已受理 ${accepted.length} 张配图重生成${skipped.length > 0 ? `，跳过 ${skipped.length} 张（不存在或正在生成）` : ''}`
          : '没有可重新生成的题目（不存在或正在生成）',
    };
  }

  /**
   * 单题重新生图（异步，立即返回）。
   *
   * 权限沿用 `sentence:gen`：会消耗 AI 生图配额，与「生成题库」同属生成类操作，
   * 为一个按钮新增权限码还得重跑 seed，不划算。
   * 生图要 10~40 秒，超过管理端 15 秒请求超时，所以这里只负责受理。
   */
  @Post(':id/regenerate-image')
  @RequirePermissions('sentence:gen')
  @OperationLog('题库管理', '重新生图')
  async regenerateImage(@Param() params: IdParamDto, @Body() dto: RegenerateImageDto): Promise<ResponseEnvelope<null>> {
    await this.sentenceGen.regenerateImage(params.id, dto.scenePrompt);
    return { __raw: true, data: null, message: '已开始重新生图，约 10~40 秒后可刷新查看' };
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
