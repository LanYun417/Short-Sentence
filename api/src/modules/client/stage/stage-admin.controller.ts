/**
 * 情景闯关管理控制器（/api/stages）——运营后台用。
 *
 * 与客户端 StageController 共用同一个 StageService，放在同一目录。
 * 路由刻意不用 /client 前缀，和后台其它模块（/api/chains 等）一致；
 * 客户端走 /api/client/stages，两者路径天然不冲突。
 *
 * 权限码：stage:view（查询）/ stage:handle（强制结束会话，超管直通）。
 */
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../../../common/auth/permission.guard.js';
import { OperationLog } from '../../../common/log/operation-log.decorator.js';
import type { ResponseEnvelope } from '../../../common/http/response.interceptor.js';
import { IdParamDto } from '../../../common/dto/id-param.dto.js';
import { buildPageResult, parsePagination } from '../../../common/utils/utils.js';
import { GenerateStageCoverDto } from './stage.dto.js';
import {
  StageService,
  type StageAdminChapter,
  type StageChapterCoverItem,
  type StageSessionAdminDetail,
} from './stage.service.js';

@Controller('stages')
export class StageAdminController {
  constructor(private readonly stages: StageService) {}

  /** 关卡总览（章节 + 关卡 + 参与/通关/领奖统计）。 */
  @Get()
  @RequirePermissions('stage:view')
  overview(): Promise<StageAdminChapter[]> {
    return this.stages.adminOverview();
  }

  /** 对话会话分页列表（筛选：categoryId / status / userId / noTranslation / keyword=昵称）。 */
  @Get('sessions')
  @RequirePermissions('stage:view')
  async sessions(@Query() query: Record<string, unknown>) {
    const { page, pageSize } = parsePagination(query);
    const { list, total } = await this.stages.adminSessionList(query);
    return buildPageResult(list, total, page, pageSize);
  }

  /** 会话详情：完整消息流，用于抽查 AI 质量与客诉。 */
  @Get('sessions/:id')
  @RequirePermissions('stage:view')
  sessionDetail(@Param() params: IdParamDto): Promise<StageSessionAdminDetail> {
    return this.stages.adminSessionDetail(params.id);
  }

  /** 强制结束进行中的会话（不改通关与进度，只把 active 置为 ended）。 */
  @Post('sessions/:id/close')
  @RequirePermissions('stage:handle')
  @OperationLog('情景闯关', '强制结束会话')
  async closeSession(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    await this.stages.adminCloseSession(params.id);
    return { __raw: true, data: null, message: '已结束该会话' };
  }

  /** 章节封面管理列表：每章一行，含封面 URL / 生成时间 / 提示词。 */
  @Get('covers')
  @RequirePermissions('stage:view')
  covers(): Promise<StageChapterCoverItem[]> {
    return this.stages.adminCovers();
  }

  /**
   * 生成章节封面（AI 生图 → webp 入库 → upsert 封面行）。
   * chapterKey 缺省时补齐全部「尚无封面」的章节；regenerate=true 时强制重生成。
   */
  @Post('covers/generate')
  @RequirePermissions('stage:handle')
  @OperationLog('情景闯关', '生成章节封面')
  async generateCover(@Body() body: GenerateStageCoverDto) {
    if (body.chapterKey) {
      const result = await this.stages.generateChapterCover(body.chapterKey, Boolean(body.regenerate));
      return { __raw: true, data: result, message: '封面已生成' };
    }
    const result = body.regenerate
      ? await Promise.all(
          (await this.stages.adminCovers()).map((item) => this.stages.generateChapterCover(item.chapterKey, true)),
        )
      : await this.stages.generateMissingChapterCovers();
    return { __raw: true, data: result, message: '封面生成完成' };
  }
}
