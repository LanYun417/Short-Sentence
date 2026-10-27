/**
 * 产品反馈模块（管理端）。
 * 模块职责：装配运营侧「查看与处理用户产品反馈」的控制器与服务。
 * 客户端侧的「提交 / 我的反馈」在 ClientModule（/api/client/feedback）。
 */
import { Module } from '@nestjs/common';
import { FeedbackController } from './feedback.controller.js';
import { FeedbackService } from './feedback.service.js';

@Module({
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
