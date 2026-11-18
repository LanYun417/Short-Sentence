-- CreateTable
CREATE TABLE `pay_sku` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(30) NOT NULL,
    `kind` VARCHAR(20) NOT NULL DEFAULT 'vip',
    `price` INTEGER NOT NULL,
    `duration_days` INTEGER NOT NULL DEFAULT 0,
    `benefits` TEXT NULL,
    `status` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pay_sku_code_key`(`code`),
    INDEX `pay_sku_status_sort_idx`(`status`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pay_order` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_no` VARCHAR(32) NOT NULL,
    `user_id` BIGINT NOT NULL,
    `sku_id` BIGINT NOT NULL,
    `sku_code` VARCHAR(30) NOT NULL,
    `title` VARCHAR(60) NOT NULL,
    `amount` INTEGER NOT NULL,
    `channel` VARCHAR(20) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `prepay_id` VARCHAR(64) NULL,
    `transaction_id` VARCHAR(32) NULL,
    `paid_at` DATETIME(3) NULL,
    `refund_no` VARCHAR(32) NULL,
    `refund_id` VARCHAR(64) NULL,
    `refund_amount` INTEGER NOT NULL DEFAULT 0,
    `refund_at` DATETIME(3) NULL,
    `refund_reason` VARCHAR(200) NULL,
    `expired_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pay_order_order_no_key`(`order_no`),
    INDEX `pay_order_status_expired_at_idx`(`status`, `expired_at`),
    INDEX `pay_order_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `pay_order_transaction_id_idx`(`transaction_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pay_callback_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_no` VARCHAR(32) NULL,
    `transaction_id` VARCHAR(32) NULL,
    `event_type` VARCHAR(40) NOT NULL,
    `serial` VARCHAR(64) NOT NULL,
    `verified` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `handled` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `result_note` VARCHAR(200) NULL,
    `plain_text` TEXT NULL,
    `response_code` INTEGER NOT NULL DEFAULT 200,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pay_callback_log_order_no_created_at_idx`(`order_no`, `created_at`),
    INDEX `pay_callback_log_transaction_id_idx`(`transaction_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_entitlement` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `source` VARCHAR(20) NOT NULL,
    `order_id` BIGINT NULL,
    `sku_code` VARCHAR(30) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `started_at` DATETIME(3) NOT NULL,
    `expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `user_entitlement_user_id_kind_status_idx`(`user_id`, `kind`, `status`),
    INDEX `user_entitlement_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
