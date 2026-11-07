/**
 * 客户端用户管理控制器（/api/client-users）。
 * 权限口径：RBAC 权限码 client:user:*（超管直通）；写操作留痕。
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { RawResponse, type ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import type { PageResult } from '../../common/types.js';
import { writeCsvStream } from '../../common/utils/csv-stream.js';
import { AiQuotaService, type AiQuotaUsage } from '../../common/ai/ai-quota.service.js';
import { ClientUsersService, type ClientUserDetail, type ClientUserItem } from './client-users.service.js';
import { ClientUserResetPasswordDto, ClientUserStatusDto, GrantSentenceCardDto } from './dto.js';
import { GamifyService, type GamifyOverview } from '../client/gamify/gamify.service.js';
import {
  SentenceCardService,
  type MissingSentenceCards,
  type SentenceCardView,
} from '../client/sentence-card/sentence-card.service.js';

/** 补发漏签结果。 */
export interface BackfillSentenceCardsResult {
  /** 本次实际补发的张数（已拥有的不计） */
  granted: number;
  /** 本次补发的业务日期（YYYY-MM-DD） */
  bizDates: string[];
}

@Controller('client-users')
export class ClientUsersController {
  constructor(
    private readonly clientUsers: ClientUsersService,
    private readonly gamify: GamifyService,
    private readonly sentenceCard: SentenceCardService,
    private readonly aiQuota: AiQuotaService,
  ) {}

  /**
   * 分页列表（关键词 / 状态 / 性别）。
   *
   * 查询参数用 `Record<string, unknown>` 而非 DTO：全局 ValidationPipe 开了 whitelist，
   * DTO 里未声明的字段（page / pageSize）会被剥掉，导致分页参数丢失——翻页时永远回第 1 页
   * （症状：列表里翻不到的人，一搜关键词却能搜到）。故与日志 / 任务模块保持一致，
   * 筛选条件的解析全部放在 service 层。
   */
  @Get()
  @RequirePermissions('client:user:list')
  list(@Query() query: Record<string, unknown>): Promise<PageResult<ClientUserItem>> {
    return this.clientUsers.list(query);
  }

  /** 详情（含学习数据与最近答题）。 */
  @Get(':id')
  @RequirePermissions('client:user:query')
  detail(@Param() params: IdParamDto): Promise<ClientUserDetail> {
    return this.clientUsers.detail(params.id);
  }

  /** 导出客户端用户 CSV（流式；筛选与列表共用同一套条件）。 */
  @Get('export')
  @RequirePermissions('client:user:query')
  @RawResponse()
  async exportUsers(@Query() query: Record<string, unknown>, @Res() res: Response): Promise<void> {
    const task = await this.clientUsers.createUserExport(query);
    await writeCsvStream(res, task.filename, task.header, task.rows);
  }

  /** 今日 AI 额度用量（运营排查「这个人是不是把 AI 刷爆了」用）。 */
  @Get(':id/ai-quota')
  @RequirePermissions('client:user:query')
  getAiQuota(@Param() params: IdParamDto): Promise<AiQuotaUsage> {
    return this.aiQuota.usage(params.id);
  }

  /** 成长概览（XP / 等级 / 成就 / 场景地图）——与客户端个人中心「成长」同源。 */
  /** 成长概览（微游戏化）。 */
  @Get(':id/growth')
  @RequirePermissions('client:user:query')
  async growth(@Param() params: IdParamDto): Promise<GamifyOverview> {
    await this.clientUsers.ensureExists(params.id);
    return this.gamify.overview(params.id);
  }

  /** 已获得的句签列表（按获得时间倒序）。 */
  @Get(':id/sentence-cards')
  @RequirePermissions('client:user:query')
  async sentenceCards(@Param() params: IdParamDto): Promise<SentenceCardView[]> {
    await this.clientUsers.ensureExists(params.id);
    return this.sentenceCard.listMine(params.id);
  }

  /** 补发过往漏领的句签（历史达标日 + 当日句签已就绪；幂等，重复调用不重复发）。 */
  @Post(':id/sentence-cards/backfill')
  @RequirePermissions('client:user:edit')
  @OperationLog('客户端用户', '补发句签')
  async backfillSentenceCards(@Param() params: IdParamDto): Promise<ResponseEnvelope<BackfillSentenceCardsResult>> {
    await this.clientUsers.ensureExists(params.id);
    const result = await this.sentenceCard.backfillMissed(params.id);
    const message = result.granted > 0 ? `已补发 ${result.granted} 张漏签句签` : '没有漏签的句签（该用户均已领取）';
    return { __raw: true, data: result, message };
  }

  /** 未拥有的句签（已就绪 − 已获得；total + 最近一批，供详情弹窗「未拥有」区展示）。 */
  @Get(':id/sentence-cards/missing')
  @RequirePermissions('client:user:query')
  async missingSentenceCards(@Param() params: IdParamDto): Promise<MissingSentenceCards> {
    await this.clientUsers.ensureExists(params.id);
    return this.sentenceCard.listMissing(params.id);
  }

  /** 一键解锁指定句签（幂等；重复解锁返回 alreadyOwned=true）。 */
  @Post(':id/sentence-cards/grant')
  @RequirePermissions('client:user:edit')
  @OperationLog('客户端用户', '解锁句签')
  async grantSentenceCard(
    @Param() params: IdParamDto,
    @Body() dto: GrantSentenceCardDto,
  ): Promise<ResponseEnvelope<{ view: SentenceCardView; alreadyOwned: boolean }>> {
    await this.clientUsers.ensureExists(params.id);
    const result = await this.sentenceCard.grantCard(params.id, dto.cardId);
    return {
      __raw: true,
      data: result,
      message: result.alreadyOwned ? '该用户已拥有此句签' : `已解锁句签「${result.view.titleZh || result.view.title}」`,
    };
  }

  /** 启用 / 禁用。 */
  @Put(':id/status')
  @RequirePermissions('client:user:edit')
  @OperationLog('客户端用户', '修改状态')
  async setStatus(@Param() params: IdParamDto, @Body() dto: ClientUserStatusDto): Promise<ResponseEnvelope<null>> {
    await this.clientUsers.setStatus(params.id, dto.status);
    return { __raw: true, data: null, message: dto.status === 1 ? '已启用' : '已禁用' };
  }

  /** 重置密码（同时强制下线）。 */
  @Put(':id/password')
  @RequirePermissions('client:user:reset')
  @OperationLog('客户端用户', '重置密码')
  async resetPassword(
    @Param() params: IdParamDto,
    @Body() dto: ClientUserResetPasswordDto,
  ): Promise<ResponseEnvelope<null>> {
    await this.clientUsers.resetPassword(params.id, dto.newPassword);
    return { __raw: true, data: null, message: '密码已重置，用户需重新登录' };
  }

  /** 强制下线（不改密码，仅令旧令牌失效）。 */
  @Post(':id/offline')
  @RequirePermissions('client:user:offline')
  @OperationLog('客户端用户', '强制下线')
  async forceOffline(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    await this.clientUsers.forceOffline(params.id);
    return { __raw: true, data: null, message: '已强制下线' };
  }

  /** 删除用户（级联清理学习数据；日志类表不动，保留审计痕迹）。 */
  @Delete(':id')
  @RequirePermissions('client:user:delete')
  @OperationLog('客户端用户', '删除用户')
  async remove(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    await this.clientUsers.remove(params.id);
    return { __raw: true, data: null, message: '已删除' };
  }
}
