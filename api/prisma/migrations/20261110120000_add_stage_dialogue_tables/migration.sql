-- DropIndex
DROP INDEX `study_stage_progress_user_id_category_id_key` ON `study_stage_progress`;

-- DropIndex
DROP INDEX `study_stage_progress_user_id_idx` ON `study_stage_progress`;

-- AlterTable
ALTER TABLE `chain_entry` ADD COLUMN `moderation_note` VARCHAR(100) NULL;

-- AlterTable
ALTER TABLE `chain_topic` ADD COLUMN `source` VARCHAR(20) NOT NULL DEFAULT 'seed',
    ADD COLUMN `week_start` VARCHAR(10) NULL;

-- AlterTable
ALTER TABLE `study_stage_progress` ADD COLUMN `dialogue_cleared_at` DATETIME(3) NULL,
    ADD COLUMN `dialogue_turns` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `story_id` BIGINT NULL;

-- CreateTable
CREATE TABLE `stage_dialogue_session` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `story_id` BIGINT NOT NULL,
    `category_id` BIGINT NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `turn_count` INTEGER NOT NULL DEFAULT 0,
    `goal_reached` BOOLEAN NOT NULL DEFAULT false,
    `cleared` BOOLEAN NOT NULL DEFAULT false,
    `show_translation` BOOLEAN NOT NULL DEFAULT true,
    `translation_used` BOOLEAN NOT NULL DEFAULT false,
    `last_hints` TEXT NULL,
    `summary` TEXT NULL,
    `feedback` TEXT NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ended_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `stage_dialogue_session_user_id_story_id_status_idx`(`user_id`, `story_id`, `status`),
    INDEX `stage_dialogue_session_category_id_idx`(`category_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stage_dialogue_message` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `session_id` BIGINT NOT NULL,
    `role` VARCHAR(10) NOT NULL,
    `speaker` VARCHAR(40) NULL,
    `content_en` VARCHAR(500) NOT NULL,
    `content_zh` VARCHAR(300) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stage_dialogue_message_session_id_id_idx`(`session_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stage_script` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `category_id` BIGINT NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `blurb` VARCHAR(500) NOT NULL DEFAULT '',
    `cover_file_id` BIGINT NOT NULL DEFAULT 0,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` TINYINT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `stage_script_category_id_sort_idx`(`category_id`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stage_story` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `script_id` BIGINT NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `intro` TEXT NOT NULL,
    `outro` TEXT NOT NULL,
    `user_role` VARCHAR(200) NOT NULL,
    `setting` TEXT NOT NULL,
    `goal` TEXT NOT NULL,
    `min_turns` INTEGER NOT NULL,
    `max_turns` INTEGER NOT NULL,
    `target` INTEGER NOT NULL DEFAULT 5,
    `reward_xp` INTEGER NOT NULL,
    `roles` JSON NOT NULL,
    `opening` JSON NOT NULL,
    `starter_hints` JSON NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` TINYINT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `stage_story_script_id_sort_idx`(`script_id`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `chain_topic_source_week_start_idx` ON `chain_topic`(`source`, `week_start`);

-- CreateIndex
CREATE INDEX `study_stage_progress_user_id_category_id_idx` ON `study_stage_progress`(`user_id`, `category_id`);

-- CreateIndex
CREATE UNIQUE INDEX `study_stage_progress_user_id_story_id_key` ON `study_stage_progress`(`user_id`, `story_id`);

-- AddForeignKey
ALTER TABLE `stage_dialogue_message` ADD CONSTRAINT `stage_dialogue_message_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `stage_dialogue_session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

