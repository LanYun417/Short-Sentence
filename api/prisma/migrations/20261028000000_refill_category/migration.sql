-- 支持「按分类定向补题（填场景）」：一天内允许「一个定时全量批次」+「多个按分类补题批次」并存。
-- 做法：去掉 biz_date 上的单列唯一，改为 (biz_date, category_id) 复合唯一；
-- category_id 用 0 作为「定时全量批次」的哨兵，其余为对应分类 id（NULL 在 MySQL 唯一索引里视为不同值，
-- 不能用 NULL 当哨兵，否则两个定时批次会撞不上唯一约束）。

-- 1. 去掉原单列唯一（baseline 建的 sentence_gen_task_biz_date_key）
ALTER TABLE `sentence_gen_task` DROP INDEX `sentence_gen_task_biz_date_key`;

-- 2. 新增 category_id 列（NOT NULL DEFAULT 0，已有行自动补 0 = 定时全量批次）
ALTER TABLE `sentence_gen_task`
  ADD COLUMN `category_id` BIGINT NOT NULL DEFAULT 0 COMMENT '定向补题的分类 id；0=定时全量批次（哨兵），其余为对应分类 id'
  AFTER `biz_date`;

-- 3. 建复合唯一：(biz_date, category_id)
ALTER TABLE `sentence_gen_task`
  ADD UNIQUE INDEX `sentence_gen_task_biz_date_category_id_key` (`biz_date`, `category_id`);

-- 4. 按分类查询批次时的辅助索引
ALTER TABLE `sentence_gen_task`
  ADD INDEX `sentence_gen_task_category_id_idx` (`category_id`);
