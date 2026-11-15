-- AlterTable
ALTER TABLE `client_user` ADD COLUMN `wechat_openid` VARCHAR(64) NULL,
    ADD COLUMN `wechat_unionid` VARCHAR(64) NULL,
    ADD COLUMN `deleted_at` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `client_user_wechat_openid_key` ON `client_user`(`wechat_openid`);
