-- 节日题库：句子增加节日标记与退场时间；生成批次记录本批对应的节日。

-- AlterTable
ALTER TABLE `sentence`
    ADD COLUMN `festival_name` VARCHAR(50) NULL,
    ADD COLUMN `festival_date` VARCHAR(10) NULL,
    ADD COLUMN `retired_at` DATETIME(3) NULL;

-- CreateIndex：练习流按 status + retiredAt 过滤（retiredAt 非空 = 不再出现）
CREATE INDEX `sentence_status_retired_at_idx` ON `sentence`(`status`, `retired_at`);

-- CreateIndex：按节日查批次 / 退休旧批次
CREATE INDEX `sentence_festival_name_festival_date_idx` ON `sentence`(`festival_name`, `festival_date`);

-- AlterTable
ALTER TABLE `sentence_gen_task`
    ADD COLUMN `festival_name` VARCHAR(50) NULL,
    ADD COLUMN `festival_date` VARCHAR(10) NULL;
