-- CreateTable
CREATE TABLE `chain_topic` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(60) NOT NULL,
    `starter_en` VARCHAR(200) NOT NULL,
    `prompt_zh` VARCHAR(200) NOT NULL,
    `category_id` BIGINT NOT NULL DEFAULT 0,
    `status` TINYINT NOT NULL DEFAULT 1,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `chain_topic_status_sort_idx`(`status`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chain_entry` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `topic_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `content_en` VARCHAR(200) NOT NULL,
    `content_zh` VARCHAR(120) NULL,
    `like_count` INTEGER NOT NULL DEFAULT 0,
    `report_count` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'visible',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chain_entry_topic_id_status_like_count_idx`(`topic_id`, `status`, `like_count`),
    INDEX `chain_entry_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chain_entry_like` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `entry_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chain_entry_like_user_id_idx`(`user_id`),
    UNIQUE INDEX `chain_entry_like_entry_id_user_id_key`(`entry_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chain_entry_report` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `entry_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `reason` VARCHAR(20) NOT NULL DEFAULT 'inappropriate',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chain_entry_report_entry_id_idx`(`entry_id`),
    UNIQUE INDEX `chain_entry_report_entry_id_user_id_key`(`entry_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `chain_entry` ADD CONSTRAINT `chain_entry_topic_id_fkey` FOREIGN KEY (`topic_id`) REFERENCES `chain_topic`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chain_entry_like` ADD CONSTRAINT `chain_entry_like_entry_id_fkey` FOREIGN KEY (`entry_id`) REFERENCES `chain_entry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chain_entry_report` ADD CONSTRAINT `chain_entry_report_entry_id_fkey` FOREIGN KEY (`entry_id`) REFERENCES `chain_entry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
