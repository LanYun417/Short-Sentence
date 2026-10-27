-- CreateTable
CREATE TABLE `client_notice` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `content` TEXT NOT NULL,
    `notice_type` TINYINT NOT NULL DEFAULT 2,
    `link` VARCHAR(255) NULL,
    `status` TINYINT NOT NULL DEFAULT 0,
    `pinned` TINYINT NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NULL,
    `created_by` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `client_notice_status_pinned_published_at_idx`(`status`, `pinned`, `published_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_notice_read` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `notice_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `read_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `client_notice_read_user_id_read_at_idx`(`user_id`, `read_at`),
    UNIQUE INDEX `client_notice_read_notice_id_user_id_key`(`notice_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `client_notice_read` ADD CONSTRAINT `client_notice_read_notice_id_fkey` FOREIGN KEY (`notice_id`) REFERENCES `client_notice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
