-- CreateTable
CREATE TABLE `client_feedback` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `content` VARCHAR(1000) NOT NULL,
    `contact` VARCHAR(100) NULL,
    `platform` VARCHAR(20) NOT NULL DEFAULT 'web',
    `app_version` VARCHAR(30) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `reply` VARCHAR(500) NULL,
    `handle_note` VARCHAR(500) NULL,
    `handled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `client_feedback_status_created_at_idx`(`status`, `created_at`),
    INDEX `client_feedback_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
