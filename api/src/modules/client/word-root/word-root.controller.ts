/**
 * 词根词典控制器（/api/client/word-roots）。
 * 权限口径：需登录（client 令牌）；数据是公共词典，按用户仅做热度统计。
 */
import { Controller, Get, Param, Query } from '@nestjs/common';
import { WordRootService, type WordRootItem } from './word-root.service.js';

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
}
