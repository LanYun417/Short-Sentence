/**
 * 刷题控制器（/api/client/questions）。
 * 权限口径：需登录（client 令牌）；不使用权限码，数据按 userId 隔离。
 */
import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import { type ResponseEnvelope } from '../../../common/http/response.interceptor.js';
import { IdParamDto } from '../../../common/dto/id-param.dto.js';
import type { ClientUserContext } from '../../../common/types.js';
import { QuestionsService } from './questions.service.js';
import { AnswerSentenceDto, NextQuestionQueryDto } from './dto.js';

@Controller('client/questions')
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  /**
   * 下一张卡（8:2 新题/复习混抽；不含答案）。
   * difficulty 仅作用于新题抽取；festival 传了则只从该节日题库抽（专门刷题）。
   * 拼词词块**恒定下发**，便于客户端切换作答模式时无需重抽题。
   */
  @Get('next')
  next(@CurrentClientUser() user: ClientUserContext, @Query() query: NextQuestionQueryDto) {
    return this.questions.next(user.userId, query.difficulty, query.festival);
  }

  /** 可选的节日题库列表（只含有就绪题目的节日；按节日日期倒序）。 */
  @Get('festivals')
  festivals() {
    return this.questions.listFestivals();
  }

  /** 提交答案（返回正确答案，用于翻转面）。 */
  @Post(':id/answer')
  async answer(
    @CurrentClientUser() user: ClientUserContext,
    @Param() params: IdParamDto,
    @Body() dto: AnswerSentenceDto,
  ) {
    return this.questions.answer(user.userId, params.id, dto);
  }

  /** 收藏 / 取消收藏。 */
  @Post(':id/favorite')
  async favorite(
    @CurrentClientUser() user: ClientUserContext,
    @Param() params: IdParamDto,
  ): Promise<ResponseEnvelope<{ favorited: boolean }>> {
    const result = await this.questions.toggleFavorite(user.userId, params.id);
    return { __raw: true, data: result, message: result.favorited ? '已收藏' : '已取消收藏' };
  }

  /** 取消收藏（显式 DELETE，语义优先）。 */
  @Delete(':id/favorite')
  async unfavorite(
    @CurrentClientUser() user: ClientUserContext,
    @Param() params: IdParamDto,
  ): Promise<ResponseEnvelope<{ favorited: boolean }>> {
    const result = await this.questions.toggleFavorite(user.userId, params.id);
    return { __raw: true, data: result, message: '已取消收藏' };
  }
}
