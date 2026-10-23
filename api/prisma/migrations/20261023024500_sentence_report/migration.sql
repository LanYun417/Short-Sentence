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

ALTER TABLE `sentence_report` ADD CONSTRAINT `sentence_report_sentence_id_fkey` FOREIGN KEY (`sentence_id`) REFERENCES `sentence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
