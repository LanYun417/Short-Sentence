-- 每周学习报告邮件订阅开关：与每日提醒独立，用户主动开启才发
ALTER TABLE `client_user`
  ADD COLUMN `weekly_report_email` TINYINT NOT NULL DEFAULT 0 COMMENT '每周学习报告邮件：1 订阅 / 0 不订阅（用户主动开启才发，与每日提醒独立）';
