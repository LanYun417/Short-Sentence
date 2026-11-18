/**
 * 客户端（「短句」用户端）模块。
 * 模块职责：装配客户端用户体系的所有控制器与服务——鉴权、刷题、收藏/复习、
 * 打卡、AI 造句/词根、分类。与后台模块（/api/* 其余部分）共用同一应用实例，
 * 但用户表（client_user）、令牌类型（tokenType=client）、权限模型（无 RBAC）完全隔离。
 */
import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module.js';
import { ConfigModule } from '../config/config.module.js';
import { WechatService } from '../../common/auth/wechat.service.js';
import { WordRootModule } from './word-root/word-root.module.js';
import { SentenceCardModule } from './sentence-card/sentence-card.module.js';
import { GamifyModule } from './gamify/gamify.module.js';
import { ClientAuthController } from './auth/client-auth.controller.js';
import { ClientAuthUserService } from './auth/client-auth.service.js';
import { EmailCodeService } from './auth/email-code.service.js';
import { QuestionsController } from './questions/questions.controller.js';
import { QuestionsService } from './questions/questions.service.js';
import { LibraryController } from './library/library.controller.js';
import { CheckinController } from './checkin/checkin.controller.js';
import { CheckinService } from './checkin/checkin.service.js';
import { ReportController } from './report/report.controller.js';
import { ReportService } from './report/report.service.js';
import { FeedbackController } from './feedback/feedback.controller.js';
import { SubmissionController } from './submission/submission.controller.js';
import { SubmissionAdminController } from './submission/submission-admin.controller.js';
import { SubmissionService } from './submission/submission.service.js';
import { FeedbackService } from './feedback/feedback.service.js';
import { ClientAiController } from './ai/client-ai.controller.js';
import { ClientAiService } from './ai/client-ai.service.js';
import { CategoriesController } from './categories/categories.controller.js';
import { ClientNoticeController } from './notice/client-notice.controller.js';
import { ClientNoticeService } from './notice/client-notice.service.js';
import { LeaderboardController } from './leaderboard/leaderboard.controller.js';
import { LeaderboardAdminController } from './leaderboard/leaderboard-admin.controller.js';
import { LeaderboardService } from './leaderboard/leaderboard.service.js';
import { CheckinAdminController } from './checkin/checkin-admin.controller.js';
import { SiteController } from './site/site.controller.js';
import { TeamController } from './team/team.controller.js';
import { TeamService } from './team/team.service.js';
import { ClientCoachController } from './ai/coach.controller.js';
import { ClientCoachService } from './ai/coach.service.js';
import { StageController } from './stage/stage.controller.js';
import { StageAdminController } from './stage/stage-admin.controller.js';
import { StageService } from './stage/stage.service.js';
import { ChainController } from './chain/chain.controller.js';
import { ChainAdminController } from './chain/chain-admin.controller.js';
import { ChainService } from './chain/chain.service.js';
import { IpaController } from './ipa/ipa.controller.js';
import { IpaAdminController } from './ipa/ipa-admin.controller.js';
import { IpaService } from './ipa/ipa.service.js';
import { TeamAdminController } from './team/team-admin.controller.js';
import { ClientPayController } from './pay/client-pay.controller.js';

@Module({
  // FilesModule：客户端头像上传复用 FilesService（幻数校验 / 秒传去重）
  // WordRootModule：词根词典（搜索 / 查词 / 每日入库）
  // SentenceCardModule：每日句签（领取 / 我的句签；生成走 TaskModule 定时任务）
  // GamifyModule：微游戏化（答题/收藏发 XP、解锁成就、成长概览）
  imports: [FilesModule, ConfigModule, WordRootModule, SentenceCardModule, GamifyModule],
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
    // 音标学习（音标库 / 进度 / 学会了；后台管理控制器 /api/ipa）
    IpaController,
    IpaAdminController,
    // 今日排行榜（答题数 / 答对数前 100）——含后台管理控制器 /api/leaderboards
    LeaderboardController,
    LeaderboardAdminController,
    // 打卡后台管理控制器 /api/checkins（客户端走 /api/client/checkin）
    CheckinAdminController,
    // 站点公开配置（备案号）/api/client/site（@Public，页脚 / 关于页用）
    SiteController,
    // 站点公开配置（备案号）/api/client/site（@Public，页脚 / 关于页用）
    SiteController,
    // 弱连接学习小队（自动匹配 / 组队打卡）
    TeamController,
    // AI 私教（薄弱点画像 / 可选 AI 点评，独立 controller 不碰 SSE 端点）
    ClientCoachController,
    // 情景闯关（关卡 = 场景；进度与通关奖励）——含后台管理控制器 /api/stages
    StageController,
    StageAdminController,
    // 句子接龙（匿名共创；后台审核控制器与它共用同一个 service，见下方注释）
    ChainController,
    ChainAdminController,
    // 学习小队后台管理控制器 /api/teams（客户端走 /api/client/team）
    TeamAdminController,
    // 用户投稿（UGC）：提交 / 我的投稿 / 精选；后台审核 /api/submissions
    SubmissionController,
    SubmissionAdminController,
    // 会员购买（/api/client/pay：套餐 / 下单 / 订单状态 / 我的权益；后台与回调在 PayModule）
    ClientPayController,
  ],
  // ChainService 导出给 TaskModule 挂「接龙主题周更」定时任务；
  // StageService 同理导出给「闯关章节封面补生成」；
  // TeamService 导出给「小队群聊记录 30 天清理」定时任务（ClientModule 不依赖 TaskModule，无循环）
  exports: [ChainService, StageService, TeamService],
  providers: [
    ClientAuthUserService,
    // 微信小程序登录（code2session；无外部依赖，纯函数式调用）
    WechatService,
    // 邮箱验证码（注册/登录/重置密码；依赖 Redis + 全局 MailService）
    EmailCodeService,
    QuestionsService,
    CheckinService,
    ReportService,
    FeedbackService,
    ClientAiService,
    ClientNoticeService,
    LeaderboardService,
    // 组队结算由 CheckinService 在「今日刚达成目标」时调用，故必须在此登记
    TeamService,
    ClientCoachService,
    // 情景闯关：进度由 QuestionsService 在答题链路写入，故必须在此登记
    StageService,
    // 接龙：客户端与后台审核共用同一份内容校验规则，故意只放一个 service
    ChainService,
    // 音标学习：判分/发奖走 GamifyModule 的 GamifyService（本模块已 import）
    IpaService,
    // 用户投稿：客户端与后台审核共用一份服务（列表/审核同一套口径）
    SubmissionService,
  ],
})
export class ClientModule {}
