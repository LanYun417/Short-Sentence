# 数据库备份与恢复演练（db-backup / db-restore）

短句项目的数据库是**唯一不可挽回点**：代码、迁移历史都在仓库里，但用户数据（题库、作答、成长、反馈、文件元数据）只在 MySQL 里。
本工具提供「一键备份 + 一键演练恢复」，确保真出事能恢复。

工具位于 `scripts/`，零第三方依赖（仅 Node 内置模块），与仓库「零第三方运行时依赖」约束一致。

## 前置条件

- 本机已安装 `mysqldump` / `mysql`（MySQL 8.x 客户端），且在 `PATH` 中（可用 `MYSQLDUMP_BIN` / `MYSQL_BIN` 覆盖路径）。
- 数据库连接配置来自 `api/.env`（`DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`），脚本会自动读取；CI / 容器里直接注入同名环境变量即可。
- 密码**只**经 `MYSQL_PWD` 环境变量传给客户端，不进命令行参数（避开 ps 可见，也避开 Windows 上 `--defaults-extra-file` 反斜杠被当转义符的坑）。

## 日常备份

```bash
npm run db:backup            # 备份 DB_NAME 到 backups/（保留最近 14 份，按时间名）
npm run db:backup -- --keep 30
```

产物：`backups/<DB_NAME>-YYYYMMDDHHMMSS.sql.gz`（gzip 压缩的逻辑备份，约 0.6 MB / 1.5 万行量级）。
`backups/` 已被 `.gitignore` 忽略——**备份含用户数据，严禁入库**。
迁移历史（`api/prisma/migrations/`）在仓库里，配合备份即可在新库完整重建（先 `migrate deploy` 再导入数据）。

建议：接入定时任务（cron / CI nightly）每天跑一次；保留份数按磁盘与合规要求调整。

## 恢复演练（默认对线上零影响）

```bash
npm run db:drill             # 最新备份 → 演练库 short_sentence_drill → 校验表/行 → 删除演练库
npm run db:drill -- --no-drop  # 演练但保留演练库供人工抽查，事后手动 DROP
```

演练会：建一个独立的演练库 → 导入最新备份 → 校验表数/行数 → **默认删除演练库**，全程不碰线上库。
脚本已用真实环境验证：35 张表、逐表 `COUNT(*)` 与源库**完全一致**（0 行偏差）。

## 真实恢复（危险，手动执行）

```bash
node scripts/db-restore.mjs --to short_sentence --i-understand
```

⚠️ 直接覆盖线上库是单向操作，脚本**默认拒绝**（`--to` 等于配置里的 `DB_NAME` 会被拦，必须显式加 `--i-understand`）。
执行前务必确认：

1. 已对**当前线上库**再做一次备份（`npm run db:backup`），以便回滚；
2. 目标库应用迁移历史：`npx prisma migrate deploy`（全新库必须先建库 + 跑迁移，再导入数据）；
3. 导入是覆盖式（往已存在表 `INSERT`，不会先 `DROP`）；若目标库已有数据，先评估冲突或清空；
4. 导入后跑一遍冒烟（登录、抽题、成长页）确认可用。

## 灾备组合拳（新环境从零重建）

1. `npx prisma migrate deploy` # 用仓库迁移历史建出全部表结构
2. `npm run db:backup` # 先备份当前线上（若还在）
3. `node scripts/db-restore.mjs --to <新库> --i-understand` # 导入数据

> 表结构以迁移历史为准，数据是逻辑备份，二者分离但互补。切勿只拿备份去建新库（没有迁移历史，约束/索引可能不全）。
