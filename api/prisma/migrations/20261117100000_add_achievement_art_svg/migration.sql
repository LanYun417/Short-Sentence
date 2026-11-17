-- 成就徽章 SVG 源文本：随种子入库，服务端据此栅格化 /static/achievements/<code>.png
ALTER TABLE `achievement` ADD COLUMN `art_svg` TEXT NULL;
