/**
 * 音标管理控制器（/api/ipa）——运营后台用。
 *
 * 音标库是 48 个静态参考数据：后台只开放「内容字段编辑 + 重置种子 + 学习审计」，
 * 不开放增删；symbol 为业务主键（XP 幂等 event_key 含 symbol），不允许修改。
 * 与客户端控制器共用同一个 `IpaService`（客户端只读分发 + 学会了发奖）。
 *
 * 权限码 sentence:ipa / sentence:ipa:edit / sentence:ipa:handle（超管直通）。
 */
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { RequirePermissions } from '../../../common/auth/permission.guard.js';
import { OperationLog } from '../../../common/log/operation-log.decorator.js';
import type { ResponseEnvelope } from '../../../common/http/response.interceptor.js';
import { IdParamDto } from '../../../common/dto/id-param.dto.js';
import { buildPageResult, parsePagination, readString } from '../../../common/utils/utils.js';
import { UpdateIpaPhonemeDto } from './dto.js';
import { IpaService } from './ipa.service.js';

@Controller('ipa')
export class IpaAdminController {
  constructor(private readonly ipa: IpaService) {}

  /** 音标分页列表（带学会人数；支持关键字 / 类型筛选）。 */
  @Get('phonemes')
  @RequirePermissions('sentence:ipa')
  async phonemes(@Query() query: Record<string, unknown>) {
    const { page, pageSize } = parsePagination(query);
    const { list, total } = await this.ipa.adminListPhonemes({
      keyword: readString(query.keyword),
      type: readString(query.type),
      page,
      pageSize,
    });
    return buildPageResult(list, total, page, pageSize);
  }

  /** 编辑音标内容字段（symbol 不可改，见 DTO 注释）。 */
  @Put('phonemes/:id')
  @RequirePermissions('sentence:ipa:edit')
  @OperationLog('音标管理', '编辑音标')
  async updatePhoneme(@Param() params: IdParamDto, @Body() dto: UpdateIpaPhonemeDto): Promise<ResponseEnvelope<null>> {
    await this.ipa.adminUpdatePhoneme(params.id, dto);
    return { __raw: true, data: null, message: '已保存' };
  }

  /** 按内置种子重置全部音标内容（覆盖手动修改；必须声明在 :id 之前——同为 phonemes 前缀但方法不同，仍显式前置）。 */
  @Post('phonemes/reset-seeds')
  @RequirePermissions('sentence:ipa:handle')
  @OperationLog('音标管理', '重置音标种子')
  async resetSeeds(): Promise<ResponseEnvelope<{ updated: number }>> {
    const result = await this.ipa.adminResetSeeds();
    return { __raw: true, data: result, message: `已重置 ${result.updated} 个音标` };
  }

  /** 学习统计总览（totals + 近 7 天趋势 + 学会人数 Top5）。 */
  @Get('stats')
  @RequirePermissions('sentence:ipa')
  stats() {
    return this.ipa.adminStats();
  }

  /** 学习记录分页审计（关键字匹配音标或用户）。 */
  @Get('records')
  @RequirePermissions('sentence:ipa')
  async records(@Query() query: Record<string, unknown>) {
    const { page, pageSize } = parsePagination(query);
    const { list, total } = await this.ipa.adminRecords({
      keyword: readString(query.keyword),
      page,
      pageSize,
    });
    return buildPageResult(list, total, page, pageSize);
  }
}
