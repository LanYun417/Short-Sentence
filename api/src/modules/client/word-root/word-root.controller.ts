/**
 * 词根词典控制器（/api/client/word-roots）。
 * 权限口径：需登录（client 令牌）；数据是公共词典，按用户仅做热度统计。
 */
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { WordRootService, type WordRootAnalysis, type WordRootItem } from './word-root.service.js';
import { ClientWordRootCollectDto } from './dto.js';

/** 收录结果。 */
export interface WordRootCollectResult {
  /** 最终词条（新建的或已存在的） */
  item: WordRootItem;
  /** 本次是否新入库（false = 词库已有，未覆盖） */
  created: boolean;
}

@Controller('client/word-roots')
export class WordRootController {
  constructor(private readonly wordRoot: WordRootService) {}

  /** 搜索词根词典（q 为空时返回热门词）。 */
  @Get()
  search(@Query('q') q?: string): Promise<WordRootItem[]> {
    return this.wordRoot.search(q ?? '');
  }

  /** 查词：命中缓存直接返回，未命中实时 AI 解析并入库。 */
  @Get(':word')
  lookup(@Param('word') word: string): Promise<WordRootItem> {
    return this.wordRoot.lookup(word);
  }

  /** 收录词条：把「AI 词根拆解」的结果落库（词库已有则不覆盖，幂等）。 */
  @Post()
  collect(@Body() dto: ClientWordRootCollectDto): Promise<WordRootCollectResult> {
    return this.wordRoot.collect(dto.word, (dto.analysis ?? {}) as WordRootAnalysis);
  }
}
