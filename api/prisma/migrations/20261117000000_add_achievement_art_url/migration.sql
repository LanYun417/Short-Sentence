-- 成就增加 AI 卡通大图 URL（详情大图优先显示；空值回落 lucide icon）
ALTER TABLE `achievement` ADD COLUMN `art_url` VARCHAR(500) NULL;
