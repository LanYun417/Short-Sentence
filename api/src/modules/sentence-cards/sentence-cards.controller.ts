/**
 * 句签管理控制器（/api/sentence-cards）。
 * 权限口径：RBAC 权限码 sentence:card:*（超管直通）；写操作 @OperationLog 留痕。
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { type ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { SentenceCardsService } from './sentence-cards.service.js';
import { GenerateSentenceCardDto, UpdateSentenceCardDto } from './sentence-cards.dto.js';

@Controller('sentence-cards')
export class SentenceCardsController {
  constructor(private readonly cards: SentenceCardsService) {}

  /** 分页列表（筛选：status / 日期区间 / 关键词）。 */
  @Get()
  @RequirePermissions('sentence:card:list')
  list(@Query() query: Record<string, unknown>) {
    return this.cards.list(query);
  }

  /**
   * 按日期重新生成（同步等待 AI 文案 + 生图，通常 10~40s）。
   * ⚠️ 必须声明在 `@Get(':id')` 之前不是必需的（方法不同），但保持与其他模块一致的可读性。
   */
  @Post('generate')
  @RequirePermissions('sentence:card:gen')
  @OperationLog('句签管理', '重新生成')
  async generate(
    @Body() dto: GenerateSentenceCardDto,
  ): Promise<ResponseEnvelope<{ bizDate: string; generated: boolean }>> {
    const result = await this.cards.regenerate(dto);
    return {
      __raw: true,
      data: result,
      message: result.generated ? '生成成功' : '该日期句签已就绪，已跳过',
    };
  }

  /** 详情（含最近领取用户）。 */
  @Get(':id')
  @RequirePermissions('sentence:card:list')
  detail(@Param() params: IdParamDto) {
    return this.cards.detail(params.id);
  }

  /** 编辑文案。 */
  @Put(':id')
  @RequirePermissions('sentence:card:edit')
  @OperationLog('句签管理', '编辑文案')
  async update(@Param() params: IdParamDto, @Body() dto: UpdateSentenceCardDto): Promise<ResponseEnvelope<null>> {
    await this.cards.update(params.id, dto);
    return { __raw: true, data: null, message: '保存成功' };
  }

  /** 删除（连带领取记录）。 */
  @Delete(':id')
  @RequirePermissions('sentence:card:remove')
  @OperationLog('句签管理', '删除')
  async remove(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    await this.cards.remove(params.id);
    return { __raw: true, data: null, message: '已删除' };
  }
}
