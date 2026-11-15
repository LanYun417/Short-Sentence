-- CreateTable
CREATE TABLE `client_account_deletion` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `reason_type` VARCHAR(20) NOT NULL DEFAULT 'unspecified',
    `reason_detail` VARCHAR(200) NULL,
    `xp` INTEGER NOT NULL DEFAULT 0,
    `checkin_days` INTEGER NOT NULL DEFAULT 0,
    `answer_count` INTEGER NOT NULL DEFAULT 0,
    `registered_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `client_account_deletion_created_at_idx`(`created_at`),
    INDEX `client_account_deletion_reason_type_idx`(`reason_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
