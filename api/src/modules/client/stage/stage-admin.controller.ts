/**
 * 情景闯关管理控制器（/api/stages）——运营后台用。
 *
 * 层级：场景（sentence_category，在「场景分类」页管理）→ 剧本（stage_script）→ 关卡（stage_story）。
 * 与客户端 StageController 共用同一个 StageService，放在同一目录。
 * 路由刻意不用 /client 前缀，和后台其它模块（/api/chains 等）一致；
 * 客户端走 /api/client/stages，两者路径天然不冲突。
 *
 * 权限码：stage:view（查询）/ stage:handle（增删改、生成封面，超管直通）。
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { RequirePermissions } from '../../../common/auth/permission.guard.js';
import { OperationLog } from '../../../common/log/operation-log.decorator.js';
import type { ResponseEnvelope } from '../../../common/http/response.interceptor.js';
import { IdParamDto } from '../../../common/dto/id-param.dto.js';
import { buildPageResult, parsePagination } from '../../../common/utils/utils.js';
import {
  AiGenerateStageStoryDto,
  CreateStageScriptDto,
  CreateStageStoryDto,
  GenerateScriptCoverDto,
  ReorderStageStoriesDto,
  SetStageScriptStatusDto,
  SetStageStoryStatusDto,
  UpdateStageScriptDto,
  UpdateStageStoryDto,
} from './stage.dto.js';
import {
  StageService,
  type StageAdminChapter,
  type StageScriptAdminItem,
  type StageSessionAdminDetail,
  type StageStoryAdminItem,
} from './stage.service.js';

@Controller('stages')
export class StageAdminController {
  constructor(private readonly stages: StageService) {}

  /** 关卡总览（剧本分组 + 关卡 + 参与/通关/领奖统计）。 */
  @Get()
  @RequirePermissions('stage:view')
  overview(): Promise<StageAdminChapter[]> {
    return this.stages.adminOverview();
  }

  /** 对话会话分页列表（筛选：storyId / status / userId / noTranslation / keyword=昵称）。 */
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

  /* ------------------------------ 剧本（stage_script） ------------------------------ */

  /** 剧本列表（含停用的，附场景名/封面/关卡数与统计）。 */
  @Get('scripts')
  @RequirePermissions('stage:view')
  scripts(): Promise<StageScriptAdminItem[]> {
    return this.stages.adminScripts();
  }

  /** 新增剧本（挂在某个场景下）。 */
  @Post('scripts')
  @RequirePermissions('stage:handle')
  @OperationLog('情景闯关', '新增剧本')
  async createScript(@Body() body: CreateStageScriptDto): Promise<ResponseEnvelope<{ id: number }>> {
    const result = await this.stages.createScript(body);
    return { __raw: true, data: result, message: '剧本已创建' };
  }

  /** 补齐缺失封面的静态路由，必须声明在 scripts/:id 之前。 */
  @Post('scripts/covers/generate-missing')
  @RequirePermissions('stage:handle')
  @OperationLog('情景闯关', '补全剧本封面')
  async generateMissingCovers() {
    const result = await this.stages.generateMissingScriptCovers();
    return { __raw: true, data: result, message: '缺失封面已补全' };
  }

  /** 编辑剧本（改名/简介/排序/换场景/启停）。 */
  @Put('scripts/:id')
  @RequirePermissions('stage:handle')
  @OperationLog('情景闯关', '编辑剧本')
  async updateScript(@Param() params: IdParamDto, @Body() body: UpdateStageScriptDto): Promise<ResponseEnvelope<null>> {
    await this.stages.updateScript(params.id, body);
    return { __raw: true, data: null, message: '剧本已更新' };
  }

  /** 启停剧本（停用后整条剧本线客户端不可见，历史保留）。 */
  @Post('scripts/:id/status')
  @RequirePermissions('stage:handle')
  @OperationLog('情景闯关', '启停剧本')
  async setScriptStatus(
    @Param() params: IdParamDto,
    @Body() body: SetStageScriptStatusDto,
  ): Promise<ResponseEnvelope<null>> {
    await this.stages.setScriptStatus(params.id, body.status);
    return { __raw: true, data: null, message: body.status === 1 ? '剧本已启用' : '剧本已停用' };
  }

  /** 删除剧本（连同其下关卡一起删；进度/会话按 storyId 保留）。 */
  @Delete('scripts/:id')
  @RequirePermissions('stage:handle')
  @OperationLog('情景闯关', '删除剧本')
  async deleteScript(@Param() params: IdParamDto): Promise<ResponseEnvelope<{ deletedStories: number }>> {
    const result = await this.stages.deleteScript(params.id);
    return { __raw: true, data: result, message: '剧本已删除' };
  }

  /**
   * 生成剧本封面（AI 生图 → webp 入库 → 回写 cover_file_id）。
   * scriptId 必填；regenerate=true 时强制重生成。
   */
  @Post('scripts/:id/cover')
  @RequirePermissions('stage:handle')
  @OperationLog('情景闯关', '生成剧本封面')
  async generateScriptCover(
    @Param() params: IdParamDto,
    @Body() body: GenerateScriptCoverDto,
  ): Promise<ResponseEnvelope<{ scriptId: number; coverUrl: string }>> {
    const result = await this.stages.generateScriptCover(params.id, Boolean(body.regenerate));
    return { __raw: true, data: result, message: '封面已生成' };
  }

  /* ------------------------------ 关卡（stage_story） ------------------------------ */

  /** 关卡列表（含停用的，带剧本/场景与统计）。 */
  @Get('stories')
  @RequirePermissions('stage:view')
  stories(): Promise<StageStoryAdminItem[]> {
    return this.stages.adminStories();
  }

  /** 新增关卡（挂到某个剧本下）。 */
  @Post('stories')
  @RequirePermissions('stage:handle')
  @OperationLog('情景闯关', '新增关卡')
  async createStory(@Body() body: CreateStageStoryDto): Promise<ResponseEnvelope<{ id: number }>> {
    const result = await this.stages.createStory(body);
    return { __raw: true, data: result, message: '关卡已创建' };
  }

  /** 剧本内重排序（静态路由，必须声明在 stories/:id 之前）。 */
  @Post('stories/reorder')
  @RequirePermissions('stage:handle')
  @OperationLog('情景闯关', '调整关卡顺序')
  async reorderStories(@Body() body: ReorderStageStoriesDto): Promise<ResponseEnvelope<null>> {
    await this.stages.reorderStories(body.scriptId, body.ids);
    return { __raw: true, data: null, message: '顺序已更新' };
  }

  /** AI 生成关卡草稿（静态路由）。不落库：返回整套剧情草稿，运营在编辑弹窗审核后再保存。 */
  @Post('stories/ai-generate')
  @RequirePermissions('stage:handle')
  @OperationLog('情景闯关', 'AI 生成关卡草稿')
  async aiGenerateStory(@Body() body: AiGenerateStageStoryDto) {
    const data = await this.stages.generateStoryDraft(body.scriptId);
    return { __raw: true, data, message: '草稿已生成，请审核后保存' };
  }

  /** 编辑关卡（允许换剧本）。 */
  @Put('stories/:id')
  @RequirePermissions('stage:handle')
  @OperationLog('情景闯关', '编辑关卡')
  async updateStory(@Param() params: IdParamDto, @Body() body: UpdateStageStoryDto): Promise<ResponseEnvelope<null>> {
    await this.stages.updateStory(params.id, body);
    return { __raw: true, data: null, message: '关卡已更新' };
  }

  /** 启停关卡（停用后客户端不可见，历史保留）。 */
  @Post('stories/:id/status')
  @RequirePermissions('stage:handle')
  @OperationLog('情景闯关', '启停关卡')
  async setStoryStatus(
    @Param() params: IdParamDto,
    @Body() body: SetStageStoryStatusDto,
  ): Promise<ResponseEnvelope<null>> {
    await this.stages.setStoryStatus(params.id, body.status);
    return { __raw: true, data: null, message: body.status === 1 ? '关卡已启用' : '关卡已停用' };
  }

  /** 删除关卡（物理删除；进度/会话按 storyId 保留）。 */
  @Delete('stories/:id')
  @RequirePermissions('stage:handle')
  @OperationLog('情景闯关', '删除关卡')
  async deleteStory(@Param() params: IdParamDto): Promise<ResponseEnvelope<{ sessionCount: number }>> {
    const result = await this.stages.deleteStory(params.id);
    return { __raw: true, data: result, message: '关卡已删除' };
  }
}
