-- AlterTable
ALTER TABLE `client_xp_log` ADD COLUMN `remark` VARCHAR(200) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `study_team` ADD COLUMN `code` VARCHAR(8) NULL,
    ADD COLUMN `owner_id` BIGINT NULL,
    ADD COLUMN `source` VARCHAR(10) NOT NULL DEFAULT 'random';

-- AlterTable
ALTER TABLE `sys_config` MODIFY `config_value` TEXT NOT NULL;

-- CreateTable
CREATE TABLE `user_submission` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `sentence_en` VARCHAR(300) NOT NULL,
    `translation_zh` VARCHAR(300) NOT NULL,
    `note` VARCHAR(300) NULL,
    `platform` VARCHAR(20) NOT NULL DEFAULT 'web',
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `review_note` VARCHAR(300) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_submission_status_created_at_idx`(`status`, `created_at`),
    INDEX `user_submission_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ipa_phoneme` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `symbol` VARCHAR(10) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `example_words` TEXT NOT NULL,
    `tips` VARCHAR(200) NOT NULL DEFAULT '',
    `sort` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ipa_phoneme_symbol_key`(`symbol`),
    INDEX `ipa_phoneme_type_sort_idx`(`type`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ipa_learning_record` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `phoneme_id` BIGINT NOT NULL,
    `learned_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ipa_learning_record_user_id_learned_at_idx`(`user_id`, `learned_at`),
    UNIQUE INDEX `ipa_learning_record_user_id_phoneme_id_key`(`user_id`, `phoneme_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `study_team_message` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `team_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `content` VARCHAR(500) NOT NULL,
    `quote_id` BIGINT NULL,
    `status` VARCHAR(10) NOT NULL DEFAULT 'normal',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `study_team_message_team_id_created_at_idx`(`team_id`, `created_at`),
    INDEX `study_team_message_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `study_team_code_key` ON `study_team`(`code`);

-- AddForeignKey
ALTER TABLE `ipa_learning_record` ADD CONSTRAINT `ipa_learning_record_phoneme_id_fkey` FOREIGN KEY (`phoneme_id`) REFERENCES `ipa_phoneme`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `study_team_message` ADD CONSTRAINT `study_team_message_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `study_team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

