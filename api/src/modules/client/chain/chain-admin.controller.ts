/**
 * 接龙内容审核控制器（/api/chains）——运营后台用。
 *
 * 与客户端控制器共用同一个 `ChainService`，所以刻意放在同一目录：
 * 内容安全的「写入规则」只有一份，拆两个模块会让校验口径漂移。
 * 权限码 sentence:chain / sentence:chain:handle（超管直通）。
 */
import { Body, Controller, Delete, Get, Param, Put, Query } from '@nestjs/common';
import { RequirePermissions } from '../../../common/auth/permission.guard.js';
import { OperationLog } from '../../../common/log/operation-log.decorator.js';
import { type ResponseEnvelope } from '../../../common/http/response.interceptor.js';
import { IdParamDto } from '../../../common/dto/id-param.dto.js';
import { buildPageResult, parsePagination } from '../../../common/utils/utils.js';
import { SetChainEntryStatusDto } from './chain.dto.js';
import { ChainService } from './chain.service.js';

@Controller('chains')
export class ChainAdminController {
  constructor(private readonly chains: ChainService) {}

  /** 分页列表（按举报数倒序，优先暴露有问题的条目）。 */
  @Get()
  @RequirePermissions('sentence:chain')
  async list(@Query() query: Record<string, unknown>) {
    const { page, pageSize } = parsePagination(query);
    const { list, total } = await this.chains.adminList(query);
    return buildPageResult(list, total, page, pageSize);
  }

  /** 主题下拉选项。 */
  @Get('topics')
  @RequirePermissions('sentence:chain')
  topics() {
    return this.chains.adminTopics();
  }

  /** 隐藏 / 恢复一条接龙。 */
  @Put(':id/status')
  @RequirePermissions('sentence:chain:handle')
  @OperationLog('题库管理', '审核接龙')
  async setStatus(@Param() params: IdParamDto, @Body() dto: SetChainEntryStatusDto): Promise<ResponseEnvelope<null>> {
    await this.chains.adminSetStatus(params.id, dto.status);
    return { __raw: true, data: null, message: dto.status === 'hidden' ? '已隐藏' : '已恢复' };
  }

  /** 删除一条接龙（级联清点赞与举报记录）。 */
  @Delete(':id')
  @RequirePermissions('sentence:chain:handle')
  @OperationLog('题库管理', '删除接龙')
  async remove(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    await this.chains.adminRemove(params.id);
    return { __raw: true, data: null, message: '已删除' };
  }
}
