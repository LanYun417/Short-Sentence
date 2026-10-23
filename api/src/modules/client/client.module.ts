/**
 * 客户端（「短句」用户端）模块。
 * 模块职责：装配客户端用户体系的所有控制器与服务——鉴权、刷题、收藏/复习、
 * 打卡、AI 造句/词根、分类。与后台模块（/api/* 其余部分）共用同一应用实例，
 * 但用户表（client_user）、令牌类型（tokenType=client）、权限模型（无 RBAC）完全隔离。
 */
import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module.js';
import { WordRootModule } from './word-root/word-root.module.js';
import { ClientAuthController } from './auth/client-auth.controller.js';
import { ClientAuthUserService } from './auth/client-auth.service.js';
import { QuestionsController } from './questions/questions.controller.js';
import { QuestionsService } from './questions/questions.service.js';
import { LibraryController } from './library/library.controller.js';
import { CheckinController } from './checkin/checkin.controller.js';
import { CheckinService } from './checkin/checkin.service.js';
import { ClientAiController } from './ai/client-ai.controller.js';
import { ClientAiService } from './ai/client-ai.service.js';
import { CategoriesController } from './categories/categories.controller.js';

@Module({
  // FilesModule：客户端头像上传复用 FilesService（幻数校验 / 秒传去重）
  // WordRootModule：词根词典（搜索 / 查词 / 每日入库）
  imports: [FilesModule, WordRootModule],
  controllers: [
    ClientAuthController,
    QuestionsController,
    LibraryController,
    CheckinController,
    ClientAiController,
    CategoriesController,
  ],
  providers: [ClientAuthUserService, QuestionsService, CheckinService, ClientAiService],
})
export class ClientModule {}
