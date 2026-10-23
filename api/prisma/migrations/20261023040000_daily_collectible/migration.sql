-- CreateTable
CREATE TABLE `daily_collectible` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `biz_date` VARCHAR(10) NOT NULL,
    `title` VARCHAR(80) NOT NULL,
    `title_zh` VARCHAR(80) NOT NULL,
    `sentence_en` VARCHAR(200) NOT NULL,
    `translation_zh` VARCHAR(200) NOT NULL,
    `scene_prompt` VARCHAR(500) NOT NULL,
    `image_file_id` BIGINT NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `daily_collectible_biz_date_key`(`biz_date`),
    INDEX `daily_collectible_status_biz_date_idx`(`status`, `biz_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_collectible` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `collectible_id` BIGINT NOT NULL,
    `obtained_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_collectible_user_id_obtained_at_idx`(`user_id`, `obtained_at`),
    UNIQUE INDEX `user_collectible_user_id_collectible_id_key`(`user_id`, `collectible_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_collectible` ADD CONSTRAINT `user_collectible_collectible_id_fkey` FOREIGN KEY (`collectible_id`) REFERENCES `daily_collectible`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
