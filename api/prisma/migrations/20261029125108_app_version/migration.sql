-- CreateTable
CREATE TABLE `app_version` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(20) NOT NULL DEFAULT 'android',
    `version` VARCHAR(50) NOT NULL,
    `version_code` INTEGER NOT NULL,
    `file_id` BIGINT NOT NULL,
    `file_size` BIGINT NOT NULL DEFAULT 0,
    `changelog` VARCHAR(1000) NOT NULL,
    `force_update` TINYINT NOT NULL DEFAULT 0,
    `status` TINYINT NOT NULL DEFAULT 1,
    `download_count` INTEGER NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `app_version_platform_status_version_code_idx`(`platform`, `status`, `version_code`),
    UNIQUE INDEX `app_version_platform_version_key`(`platform`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
