/**
 * 客户端（「短句」用户端）模块。
 * 模块职责：装配客户端用户体系的所有控制器与服务——鉴权、刷题、收藏/复习、
 * 打卡、AI 造句/词根、分类。与后台模块（/api/* 其余部分）共用同一应用实例，
 * 但用户表（client_user）、令牌类型（tokenType=client）、权限模型（无 RBAC）完全隔离。
 */
import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module.js';
import { WordRootModule } from './word-root/word-root.module.js';
import { SentenceCardModule } from './sentence-card/sentence-card.module.js';
import { GamifyModule } from './gamify/gamify.module.js';
import { ClientAuthController } from './auth/client-auth.controller.js';
import { ClientAuthUserService } from './auth/client-auth.service.js';
import { QuestionsController } from './questions/questions.controller.js';
import { QuestionsService } from './questions/questions.service.js';
import { LibraryController } from './library/library.controller.js';
import { CheckinController } from './checkin/checkin.controller.js';
import { CheckinService } from './checkin/checkin.service.js';
import { ReportController } from './report/report.controller.js';
import { ReportService } from './report/report.service.js';
import { FeedbackController } from './feedback/feedback.controller.js';
import { FeedbackService } from './feedback/feedback.service.js';
import { ClientAiController } from './ai/client-ai.controller.js';
import { ClientAiService } from './ai/client-ai.service.js';
import { CategoriesController } from './categories/categories.controller.js';
import { ClientNoticeController } from './notice/client-notice.controller.js';
import { ClientNoticeService } from './notice/client-notice.service.js';

@Module({
  // FilesModule：客户端头像上传复用 FilesService（幻数校验 / 秒传去重）
  // WordRootModule：词根词典（搜索 / 查词 / 每日入库）
  // SentenceCardModule：每日句签（领取 / 我的句签；生成走 TaskModule 定时任务）
  // GamifyModule：微游戏化（答题/收藏发 XP、解锁成就、成长概览）
  imports: [FilesModule, WordRootModule, SentenceCardModule, GamifyModule],
  controllers: [
    ClientAuthController,
    QuestionsController,
    LibraryController,
    CheckinController,
    ReportController,
    // 产品反馈（对产品本身的意见；后台处理在 FeedbackModule）
    FeedbackController,
    ClientAiController,
    CategoriesController,
    // 客户端公告读取（广播表 client_notice；后台发布在 NoticeModule）
    ClientNoticeController,
  ],
  providers: [
    ClientAuthUserService,
    QuestionsService,
    CheckinService,
    ReportService,
    FeedbackService,
    ClientAiService,
    ClientNoticeService,
  ],
})
export class ClientModule {}
