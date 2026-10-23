/**
 * 词根词典控制器（/api/word-roots）。
 * 权限口径：RBAC 权限码 sentence:wordroot:*（超管直通）；写操作 @OperationLog 留痕。
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { type ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { WordRootsService, type WordRootAdminItem } from './word-roots.service.js';
import { AnalyzeWordDto, UpdateWordRootDto } from './word-roots.dto.js';

@Controller('word-roots')
export class WordRootsController {
  constructor(private readonly wordRoots: WordRootsService) {}

  /** 分页列表（筛选：关键词 / 来源）。 */
  @Get()
  @RequirePermissions('sentence:wordroot:list')
  list(@Query() query: Record<string, unknown>) {
    return this.wordRoots.list(query);
  }

  /** 按单词立即解析并入库（单条，通常 3~10s）。 */
  @Post('analyze')
  @RequirePermissions('sentence:wordroot:gen')
  @OperationLog('词根词典', '立即解析')
  async analyze(@Body() dto: AnalyzeWordDto): Promise<ResponseEnvelope<WordRootAdminItem>> {
    const item = await this.wordRoots.analyze(dto.word);
    return { __raw: true, data: item, message: `已解析：${item.word}` };
  }

  /** 详情。 */
  @Get(':id')
  @RequirePermissions('sentence:wordroot:list')
  detail(@Param() params: IdParamDto) {
    return this.wordRoots.detail(params.id);
  }

  /** 编辑。 */
  @Put(':id')
  @RequirePermissions('sentence:wordroot:edit')
  @OperationLog('词根词典', '编辑')
  async update(@Param() params: IdParamDto, @Body() dto: UpdateWordRootDto): Promise<ResponseEnvelope<null>> {
    await this.wordRoots.update(params.id, dto);
    return { __raw: true, data: null, message: '保存成功' };
  }

  /** 删除。 */
  @Delete(':id')
  @RequirePermissions('sentence:wordroot:remove')
  @OperationLog('词根词典', '删除')
  async remove(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    await this.wordRoots.remove(params.id);
    return { __raw: true, data: null, message: '已删除' };
  }
}
