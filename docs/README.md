# 开发规范文档（docs/）

本目录是 short-sentence 仓库**当前生效的代码开发规范与 Git 提交规范**，覆盖四端工程（api / admin / client / android）。
与 `knowledge/`（LYAdmin 基座历史规范）的关系：`knowledge/` 记录基座设计 rationale，
本目录是其延续与更新；两者冲突时**以本目录为准**。

## 文档索引

| 文档                                          | 适用范围         | 内容                                                                     |
| --------------------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| [api-nestjs-规范](./api-nestjs-规范.md)       | `api/` 后端      | 分层、DTO、响应、数据层、AI 能力接入、任务与限流、SSE、测试门禁          |
| [admin-vue-规范](./admin-vue-规范.md)         | `admin/` 中后台  | Vue3.5 + Vite8 + Element Plus + Tailwind 的既有约定与运营页面规范        |
| [client-nuxt-规范](./client-nuxt-规范.md)     | `client/` 用户端 | Nuxt4 + `@nuxt/ui` + Tailwind、刷题卡交互、SSE 消费、海报、鉴权隔离      |
| [android-app-规范](./android-app-规范.md)     | `android/` App   | Flutter 设计系统（色板 / 动效令牌 / 图标映射）、页面与弹窗结构、验收标准 |
| [git-提交规范](./git-提交规范.md)             | 全仓库           | Conventional Commits、分支模型、双远端推送、评审清单                     |
| [db-backup-recovery](./db-backup-recovery.md) | 全仓库 / 运维    | 一键备份与恢复演练（唯一不可挽回点的兜底）                               |

## 快速定位

- 新接手后端：先读 [api-nestjs-规范](./api-nestjs-规范.md) 的第 1、3、4、7 章；
- 新接手前端（中后台）：先读 [admin-vue-规范](./admin-vue-规范.md)；
- 新接手用户端 Web（短句）：先读 [client-nuxt-规范](./client-nuxt-规范.md)；
- 新接手移动端（Flutter App）：先读 [android-app-规范](./android-app-规范.md)；
- 准备提交代码：读 [git-提交规范](./git-提交规范.md) 的提交前自检清单。

## 通用工程约定（三端一致）

| 项         | 约定                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| Node       | >= 24（`.nvmrc` 固定 24），CI/部署需满足                                 |
| 包管理器   | 仅 npm（`.npmrc` 指向 npmmirror），`package-lock.json` 必须入库          |
| 运行时依赖 | 默认零新增；确需新增须 `npm run guard:deps -- --update` 并在评审中说明   |
| 格式       | Prettier（根 `.prettierrc.json`：semi、singleQuote、printWidth 120）     |
| 提交       | Conventional Commits，中文 subject，由 commitlint + husky 强制           |
| 密钥       | 只进 `.env`（`api/.env`），经 `config.ts` 单一入口读取，禁入库禁下发前端 |
