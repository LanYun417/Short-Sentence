/**
 * 站内通知模块。
 * 模块职责：两套通知共用本模块——
 * - `NoticeService` + `NoticeController`：后台**站内信**（sys_notice，按人一行的收件箱），
 *   导出给 auth/monitor 等模块在关键操作后推送提醒；
 * - `AdminClientNoticeService` + `ClientNoticeAdminController`：面向**客户端用户**的
 *   广播公告（client_notice）后台管理。客户端侧的读取在 ClientModule 里。
 */
import { Module } from '@nestjs/common';
import { NoticeController } from './notice.controller.js';
import { NoticeService } from './notice.service.js';
import { ClientNoticeAdminController } from './client-notice.controller.js';
import { AdminClientNoticeService } from './client-notice.service.js';

@Module({
  controllers: [NoticeController, ClientNoticeAdminController],
  providers: [NoticeService, AdminClientNoticeService],
  exports: [NoticeService],
})
export class NoticeModule {}
