-- CreateTable
CREATE TABLE `sys_ip_ban` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `ip` VARCHAR(64) NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `type` VARCHAR(16) NOT NULL,
    `scope` VARCHAR(24) NOT NULL,
    `expires_at` DATETIME(3) NULL,
    `unbanned_at` DATETIME(3) NULL,
    `operator` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sys_ip_ban_ip_key`(`ip`),
    INDEX `sys_ip_ban_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
