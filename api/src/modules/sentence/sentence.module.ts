/**
 * 题库管理模块（管理端 + 生成流水线）。
 * 模块职责：管理端 CRUD（/api/sentences）与每日批量生成（SentenceGenService）。
 */
import { Module } from '@nestjs/common';
import { SentenceController } from './sentence.controller.js';
import { SentenceService } from './sentence.service.js';
import { SentenceGenService } from './sentence-gen.service.js';

@Module({
  controllers: [SentenceController],
  providers: [SentenceService, SentenceGenService],
  // SentenceGenService 需要导出：client 模块的未来扩展（如用户端「等待更新」提示）可能查询批次状态
  exports: [SentenceGenService],
})
export class SentenceModule {}
