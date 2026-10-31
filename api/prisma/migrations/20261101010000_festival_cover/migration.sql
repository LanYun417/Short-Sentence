-- 节日题库封面：场景分类增加封面图文件 id（仅节日分类使用，0 = 无封面）。
--
-- 为什么挂在分类上：节日题库本身就是「同名场景分类」（ensureFestivalCategory 建），
-- 批次键也用它当 categoryId，封面跟着分类走最自然，不必另建表。

-- AlterTable
ALTER TABLE `sentence_category`
    ADD COLUMN `cover_file_id` BIGINT NOT NULL DEFAULT 0;
