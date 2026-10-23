-- 重命名「藏品」为「句签」（保留数据，避免 DROP 丢数据）
RENAME TABLE `daily_collectible` TO `daily_sentence_card`;
RENAME TABLE `user_collectible` TO `user_sentence_card`;

-- 列重命名：collectible_id -> sentence_card_id
ALTER TABLE `user_sentence_card` CHANGE COLUMN `collectible_id` `sentence_card_id` BIGINT NOT NULL;

-- 索引重命名
ALTER TABLE `daily_sentence_card` RENAME INDEX `daily_collectible_biz_date_key` TO `daily_sentence_card_biz_date_key`;
ALTER TABLE `daily_sentence_card` RENAME INDEX `daily_collectible_status_biz_date_idx` TO `daily_sentence_card_status_biz_date_idx`;
ALTER TABLE `user_sentence_card` RENAME INDEX `user_collectible_user_id_obtained_at_idx` TO `user_sentence_card_user_id_obtained_at_idx`;
ALTER TABLE `user_sentence_card` RENAME INDEX `user_collectible_user_id_collectible_id_key` TO `user_sentence_card_user_id_sentence_card_id_key`;

-- 外键重命名（约束名同步）
ALTER TABLE `user_sentence_card` DROP FOREIGN KEY `user_collectible_collectible_id_fkey`;
ALTER TABLE `user_sentence_card` ADD CONSTRAINT `user_sentence_card_sentence_card_id_fkey` FOREIGN KEY (`sentence_card_id`) REFERENCES `daily_sentence_card`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
