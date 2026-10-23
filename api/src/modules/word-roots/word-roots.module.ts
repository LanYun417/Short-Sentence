/**
 * 词根词典管理模块（运营后台）。
 * 模块职责：注册 /api/word-roots 路由；解析与入库能力复用客户端域的 WordRootService。
 */
import { Module } from '@nestjs/common';
import { WordRootModule } from '../client/word-root/word-root.module.js';
import { WordRootsController } from './word-roots.controller.js';
import { WordRootsService } from './word-roots.service.js';

@Module({
  imports: [WordRootModule],
  controllers: [WordRootsController],
  providers: [WordRootsService],
})
export class WordRootsModule {}
