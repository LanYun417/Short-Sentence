-- CreateTable
CREATE TABLE `sys_dict_type` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `dict_name` VARCHAR(100) NOT NULL,
    `dict_type` VARCHAR(100) NOT NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `remark` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sys_dict_type_dict_type_key`(`dict_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_dict_item` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `dict_type` VARCHAR(100) NOT NULL,
    `dict_label` VARCHAR(100) NOT NULL,
    `dict_value` VARCHAR(100) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` TINYINT NOT NULL DEFAULT 1,
    `remark` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sys_dict_item_dict_type_idx`(`dict_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_config` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `config_name` VARCHAR(100) NOT NULL,
    `config_key` VARCHAR(100) NOT NULL,
    `config_value` VARCHAR(500) NOT NULL DEFAULT '',
    `system_flag` TINYINT NOT NULL DEFAULT 0,
    `remark` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sys_config_config_key_key`(`config_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_file` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `origin_name` VARCHAR(255) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `size` INTEGER NOT NULL DEFAULT 0,
    `hash` VARCHAR(64) NULL,
    `uploader_id` BIGINT NULL,
    `biz_type` VARCHAR(50) NULL,
    `biz_id` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sys_file_hash_idx`(`hash`),
    INDEX `sys_file_uploader_id_idx`(`uploader_id`),
    INDEX `sys_file_biz_type_biz_id_idx`(`biz_type`, `biz_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_xp_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `event_key` VARCHAR(160) NOT NULL,
    `user_id` BIGINT NOT NULL,
    `event_type` VARCHAR(32) NOT NULL,
    `amount` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `client_xp_log_event_key_key`(`event_key`),
    INDEX `client_xp_log_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `achievement` (
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `description` VARCHAR(200) NOT NULL,
    `icon` VARCHAR(100) NOT NULL,
    `category` VARCHAR(20) NOT NULL,
    `reward_xp` INTEGER NOT NULL DEFAULT 0,
    `sort` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_achievement` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `achievement_code` VARCHAR(64) NOT NULL,
    `unlocked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_achievement_user_id_idx`(`user_id`),
    UNIQUE INDEX `user_achievement_user_id_achievement_code_key`(`user_id`, `achievement_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_login_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `ip` VARCHAR(50) NULL,
    `user_agent` VARCHAR(500) NULL,
    `location` VARCHAR(100) NULL,
    `status` TINYINT NOT NULL,
    `message` VARCHAR(255) NULL,
    `login_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sys_login_log_login_at_idx`(`login_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_operation_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NULL,
    `username` VARCHAR(50) NULL,
    `module` VARCHAR(50) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `method` VARCHAR(10) NOT NULL,
    `url` VARCHAR(255) NOT NULL,
    `params` TEXT NULL,
    `before_data` VARCHAR(2000) NULL,
    `after_data` VARCHAR(2000) NULL,
    `duration` INTEGER NOT NULL DEFAULT 0,
    `result` TINYINT NOT NULL,
    `error_message` VARCHAR(500) NULL,
    `ip` VARCHAR(50) NULL,
    `location` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sys_operation_log_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_http_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `time` DATETIME(3) NOT NULL,
    `method` VARCHAR(10) NOT NULL,
    `url` VARCHAR(1024) NOT NULL,
    `status_code` SMALLINT NOT NULL,
    `duration` INTEGER NOT NULL DEFAULT 0,
    `ip` VARCHAR(64) NULL,
    `location` VARCHAR(100) NULL,
    `user_agent` VARCHAR(500) NULL,
    `user_id` BIGINT NOT NULL DEFAULT 0,
    `username` VARCHAR(50) NULL,
    `dept_id` BIGINT NOT NULL DEFAULT 0,
    `dept_name` VARCHAR(50) NULL,
    `query` JSON NULL,
    `req_body` TEXT NULL,
    `res_body` TEXT NULL,

    INDEX `sys_http_log_time_idx`(`time`),
    INDEX `sys_http_log_method_idx`(`method`),
    INDEX `sys_http_log_status_code_idx`(`status_code`),
    INDEX `sys_http_log_method_time_idx`(`method`, `time`),
    INDEX `sys_http_log_user_id_idx`(`user_id`),
    INDEX `sys_http_log_dept_id_idx`(`dept_id`),
    INDEX `sys_http_log_username_idx`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_notice` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `content` TEXT NOT NULL,
    `notice_type` TINYINT NOT NULL DEFAULT 1,
    `link` VARCHAR(255) NULL,
    `is_read` TINYINT NOT NULL DEFAULT 0,
    `read_at` DATETIME(3) NULL,
    `created_by` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sys_notice_user_id_is_read_created_at_idx`(`user_id`, `is_read`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_sentence_card` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `biz_date` VARCHAR(10) NOT NULL,
    `title` VARCHAR(80) NOT NULL,
    `title_zh` VARCHAR(80) NOT NULL,
    `sentence_en` VARCHAR(200) NOT NULL,
    `translation_zh` VARCHAR(200) NOT NULL,
    `blessing` VARCHAR(120) NOT NULL DEFAULT '',
    `scene_prompt` VARCHAR(500) NOT NULL,
    `image_file_id` BIGINT NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `daily_sentence_card_biz_date_key`(`biz_date`),
    INDEX `daily_sentence_card_status_biz_date_idx`(`status`, `biz_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_sentence_card` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `sentence_card_id` BIGINT NOT NULL,
    `obtained_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_sentence_card_user_id_obtained_at_idx`(`user_id`, `obtained_at`),
    UNIQUE INDEX `user_sentence_card_user_id_sentence_card_id_key`(`user_id`, `sentence_card_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_user` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(100) NOT NULL,
    `password` VARCHAR(100) NOT NULL,
    `nickname` VARCHAR(50) NOT NULL,
    `avatar_file_id` BIGINT NOT NULL DEFAULT 0,
    `birthday` DATE NULL,
    `gender` VARCHAR(10) NOT NULL DEFAULT 'secret',
    `signature` VARCHAR(200) NULL,
    `bg_card_id` BIGINT NOT NULL DEFAULT 0,
    `xp` INTEGER NOT NULL DEFAULT 0,
    `status` TINYINT NOT NULL DEFAULT 1,
    `last_login_at` DATETIME(3) NULL,
    `password_changed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `client_user_email_key`(`email`),
    INDEX `client_user_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sentence_category` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `name_en` VARCHAR(50) NULL,
    `icon` VARCHAR(100) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` TINYINT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sentence` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `category_id` BIGINT NOT NULL,
    `difficulty` TINYINT NOT NULL DEFAULT 1,
    `sentenceEn` VARCHAR(300) NOT NULL,
    `alternate_answers` VARCHAR(1000) NULL,
    `translation_zh` VARCHAR(300) NOT NULL,
    `ipa` VARCHAR(200) NULL,
    `scene_prompt` VARCHAR(500) NOT NULL,
    `image_file_id` BIGINT NOT NULL DEFAULT 0,
    `source` VARCHAR(20) NOT NULL DEFAULT 'ai',
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending_image',
    `gen_task_id` BIGINT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sentence_sentenceEn_key`(`sentenceEn`),
    INDEX `sentence_status_category_id_idx`(`status`, `category_id`),
    INDEX `sentence_gen_task_id_idx`(`gen_task_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sentence_gen_task` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `biz_date` VARCHAR(10) NOT NULL,
    `target_count` INTEGER NOT NULL DEFAULT 0,
    `text_done` INTEGER NOT NULL DEFAULT 0,
    `image_done` INTEGER NOT NULL DEFAULT 0,
    `fail_count` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `stage` VARCHAR(20) NOT NULL DEFAULT '',
    `last_heartbeat_at` DATETIME(3) NULL,
    `trigger_type` VARCHAR(20) NOT NULL DEFAULT 'cron',
    `error_message` VARCHAR(500) NULL,
    `started_at` DATETIME(3) NULL,
    `finished_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sentence_gen_task_biz_date_key`(`biz_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sentence_record` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `sentence_id` BIGINT NOT NULL,
    `user_answer` VARCHAR(300) NOT NULL,
    `is_correct` TINYINT NOT NULL DEFAULT 0,
    `elapsed_ms` INTEGER NOT NULL DEFAULT 0,
    `review_level` TINYINT NOT NULL DEFAULT 0,
    `next_review_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sentence_record_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `sentence_record_user_id_sentence_id_idx`(`user_id`, `sentence_id`),
    INDEX `sentence_record_user_id_is_correct_next_review_at_idx`(`user_id`, `is_correct`, `next_review_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sentence_favorite` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `sentence_id` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sentence_favorite_user_id_sentence_id_key`(`user_id`, `sentence_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sentence_report` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `sentence_id` BIGINT NOT NULL,
    `reason` VARCHAR(20) NOT NULL,
    `description` VARCHAR(500) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `handle_note` VARCHAR(500) NULL,
    `handled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sentence_report_status_created_at_idx`(`status`, `created_at`),
    INDEX `sentence_report_sentence_id_idx`(`sentence_id`),
    INDEX `sentence_report_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_checkin` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `checkin_date` VARCHAR(10) NOT NULL,
    `done_count` INTEGER NOT NULL DEFAULT 0,
    `goal_count` INTEGER NOT NULL DEFAULT 0,
    `streak` TINYINT NOT NULL DEFAULT 1,
    `poster_file_id` BIGINT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_checkin_user_id_checkin_date_key`(`user_id`, `checkin_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_call_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(20) NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `model` VARCHAR(100) NOT NULL,
    `biz_id` BIGINT NOT NULL DEFAULT 0,
    `prompt_tokens` INTEGER NOT NULL DEFAULT 0,
    `completion_tokens` INTEGER NOT NULL DEFAULT 0,
    `latency_ms` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'success',
    `error_message` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_call_log_type_created_at_idx`(`type`, `created_at`),
    INDEX `ai_call_log_biz_id_idx`(`biz_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_user` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `password` VARCHAR(100) NOT NULL,
    `nickname` VARCHAR(50) NOT NULL DEFAULT '',
    `avatar` VARCHAR(255) NULL,
    `email` VARCHAR(100) NULL,
    `phone` VARCHAR(20) NULL,
    `gender` VARCHAR(20) NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `last_login_at` DATETIME(3) NULL,
    `password_changed_at` DATETIME(3) NULL,
    `remark` VARCHAR(255) NULL,
    `dept_id` BIGINT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sys_user_username_key`(`username`),
    INDEX `sys_user_dept_id_idx`(`dept_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_role` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `role_name` VARCHAR(50) NOT NULL,
    `role_code` VARCHAR(50) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` TINYINT NOT NULL DEFAULT 1,
    `data_scope` TINYINT NOT NULL DEFAULT 1,
    `remark` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sys_role_role_code_key`(`role_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_menu` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `parent_id` BIGINT NOT NULL DEFAULT 0,
    `menu_name` VARCHAR(50) NOT NULL,
    `menu_type` CHAR(1) NOT NULL,
    `path` VARCHAR(200) NULL,
    `component` VARCHAR(255) NULL,
    `icon` VARCHAR(100) NULL,
    `permission` VARCHAR(100) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `visible` TINYINT NOT NULL DEFAULT 1,
    `status` TINYINT NOT NULL DEFAULT 1,
    `redirect` VARCHAR(255) NULL,
    `keep_alive` TINYINT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sys_menu_parent_id_idx`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_dept` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `parent_id` BIGINT NOT NULL DEFAULT 0,
    `dept_type` TINYINT NOT NULL DEFAULT 1,
    `dept_name` VARCHAR(50) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` TINYINT NOT NULL DEFAULT 1,
    `leader` VARCHAR(20) NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sys_dept_parent_id_idx`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_user_role` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `role_id` BIGINT NOT NULL,

    INDEX `sys_user_role_role_id_idx`(`role_id`),
    UNIQUE INDEX `sys_user_role_user_id_role_id_key`(`user_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_role_menu` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `role_id` BIGINT NOT NULL,
    `menu_id` BIGINT NOT NULL,

    INDEX `sys_role_menu_menu_id_idx`(`menu_id`),
    UNIQUE INDEX `sys_role_menu_role_id_menu_id_key`(`role_id`, `menu_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_role_dept` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `role_id` BIGINT NOT NULL,
    `dept_id` BIGINT NOT NULL,

    INDEX `sys_role_dept_dept_id_idx`(`dept_id`),
    UNIQUE INDEX `sys_role_dept_role_id_dept_id_key`(`role_id`, `dept_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_user_menu` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `menu_id` BIGINT NOT NULL,
    `type` TINYINT NOT NULL,

    INDEX `sys_user_menu_menu_id_idx`(`menu_id`),
    UNIQUE INDEX `sys_user_menu_user_id_menu_id_key`(`user_id`, `menu_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_task_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_name` VARCHAR(64) NOT NULL,
    `task_title` VARCHAR(100) NOT NULL,
    `trigger_type` TINYINT NOT NULL,
    `status` TINYINT NOT NULL,
    `started_at` DATETIME(3) NOT NULL,
    `finished_at` DATETIME(3) NULL,
    `duration` INTEGER NOT NULL DEFAULT 0,
    `error_message` VARCHAR(1000) NULL,
    `operator` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sys_task_log_task_name_started_at_idx`(`task_name`, `started_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `word_root` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `word` VARCHAR(64) NOT NULL,
    `phonetic` VARCHAR(120) NULL,
    `meaning` VARCHAR(300) NULL,
    `analysis` JSON NOT NULL,
    `source` VARCHAR(20) NOT NULL DEFAULT 'ai',
    `search_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `word_root_word_key`(`word`),
    INDEX `word_root_search_count_idx`(`search_count`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sys_dict_item` ADD CONSTRAINT `sys_dict_item_dict_type_fkey` FOREIGN KEY (`dict_type`) REFERENCES `sys_dict_type`(`dict_type`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_sentence_card` ADD CONSTRAINT `user_sentence_card_sentence_card_id_fkey` FOREIGN KEY (`sentence_card_id`) REFERENCES `daily_sentence_card`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sentence` ADD CONSTRAINT `sentence_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `sentence_category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sentence_record` ADD CONSTRAINT `sentence_record_sentence_id_fkey` FOREIGN KEY (`sentence_id`) REFERENCES `sentence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sentence_favorite` ADD CONSTRAINT `sentence_favorite_sentence_id_fkey` FOREIGN KEY (`sentence_id`) REFERENCES `sentence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sentence_report` ADD CONSTRAINT `sentence_report_sentence_id_fkey` FOREIGN KEY (`sentence_id`) REFERENCES `sentence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sys_user_role` ADD CONSTRAINT `sys_user_role_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `sys_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sys_user_role` ADD CONSTRAINT `sys_user_role_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `sys_role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sys_role_menu` ADD CONSTRAINT `sys_role_menu_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `sys_role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sys_role_menu` ADD CONSTRAINT `sys_role_menu_menu_id_fkey` FOREIGN KEY (`menu_id`) REFERENCES `sys_menu`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sys_role_dept` ADD CONSTRAINT `sys_role_dept_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `sys_role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sys_role_dept` ADD CONSTRAINT `sys_role_dept_dept_id_fkey` FOREIGN KEY (`dept_id`) REFERENCES `sys_dept`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sys_user_menu` ADD CONSTRAINT `sys_user_menu_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `sys_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sys_user_menu` ADD CONSTRAINT `sys_user_menu_menu_id_fkey` FOREIGN KEY (`menu_id`) REFERENCES `sys_menu`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
