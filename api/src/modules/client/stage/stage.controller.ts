/**
 * 情景闯关控制器（/api/client/stages）。
 * 权限口径：需登录（client 令牌），进度与对话按 userId 隔离。
 */
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import type { ClientUserContext } from '../../../common/types.js';
import { IdParamDto } from '../../../common/dto/id-param.dto.js';
import { StageMessageDto, StageTranslationDto, StartStageDialogueDto } from './stage.dto.js';
import {
  StageService,
  type ClaimResult,
  type StageDialogueView,
  type StageOverview,
  type StageSceneDetail,
  type StageScriptDetail,
  type StageTurnResult,
} from './stage.service.js';

@Controller('client/stages')
export class StageController {
  constructor(private readonly stages: StageService) {}

  /** 闯关地图（场景 + 剧本兼容 chapters + 我的对话进度 + 可领取数）。 */
  @Get()
  list(@CurrentClientUser() user: ClientUserContext): Promise<StageOverview> {
    return this.stages.getStages(user.userId);
  }

  /** 场景详情：该场景下的剧本列表（静态段，必须声明在 ':id/...' 之前）。 */
  @Get('scenes/:id')
  scene(@CurrentClientUser() user: ClientUserContext, @Param() params: IdParamDto): Promise<StageSceneDetail> {
    return this.stages.getScene(user.userId, params.id);
  }

  /** 剧本详情：该剧本下的关卡列表（含解锁/进度）。 */
  @Get('scripts/:id')
  script(@CurrentClientUser() user: ClientUserContext, @Param() params: IdParamDto): Promise<StageScriptDetail> {
    return this.stages.getScript(user.userId, params.id);
  }

  /** 刷新页面时读取进行中的对话（没有则 null）。 */
  @Get(':id/dialogue')
  dialogue(
    @CurrentClientUser() user: ClientUserContext,
    @Param() params: IdParamDto,
  ): Promise<StageDialogueView | null> {
    return this.stages.getDialogue(user.userId, params.id);
  }

  /** 进入关卡：有会话就续聊，没有就新建并落开场白。 */
  @Post(':id/dialogue')
  start(
    @CurrentClientUser() user: ClientUserContext,
    @Param() params: IdParamDto,
    @Body() dto: StartStageDialogueDto,
  ): Promise<StageDialogueView> {
    return this.stages.startDialogue(user.userId, params.id, dto.restart === true);
  }

  /** 发一句 → 1~3 个角色回应 → 可能结束并给出复盘。 */
  @Post(':id/dialogue/messages')
  message(
    @CurrentClientUser() user: ClientUserContext,
    @Param() params: IdParamDto,
    @Body() dto: StageMessageDto,
  ): Promise<StageTurnResult> {
    return this.stages.sendMessage(user.userId, params.id, dto.content, dto.showTranslation);
  }

  /** 切换翻译显示开关（持久化到会话，用于无翻译通关加成反作弊）。 */
  @Patch(':id/dialogue/translation')
  translation(
    @CurrentClientUser() user: ClientUserContext,
    @Param() params: IdParamDto,
    @Body() dto: StageTranslationDto,
  ): Promise<{ showTranslation: boolean }> {
    return this.stages.setTranslation(user.userId, params.id, dto.show);
  }

  /**
   * 切换翻译显示开关（POST 别名）。
   *
   * `wx.request` 不支持 PATCH，小程序侧只能走这条；Web / Android 仍用 PATCH。
   */
  @Post(':id/dialogue/translation')
  translationByPost(
    @CurrentClientUser() user: ClientUserContext,
    @Param() params: IdParamDto,
    @Body() dto: StageTranslationDto,
  ): Promise<{ showTranslation: boolean }> {
    return this.stages.setTranslation(user.userId, params.id, dto.show);
  }

  /** 主动结束对话。 */
  @Post(':id/dialogue/end')
  end(@CurrentClientUser() user: ClientUserContext, @Param() params: IdParamDto): Promise<StageDialogueView> {
    return this.stages.endDialogue(user.userId, params.id);
  }

  /** 领取某关通关奖励（幂等）。 */
  @Post(':id/claim')
  claim(@CurrentClientUser() user: ClientUserContext, @Param() params: IdParamDto): Promise<ClaimResult> {
    return this.stages.claim(user.userId, params.id);
  }
}
