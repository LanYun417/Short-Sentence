# Git 提交规范

依据 [Conventional Commits](https://www.conventionalcommits.org/)。提交信息由 `commit-msg` 钩子 + commitlint 强制校验，不合规直接拒绝提交；`pre-commit` 跑 lint-staged，`pre-push` 跑依赖基线守卫（`npm run guard:deps`）。

## 1. 提交格式

```txt
<type>(<scope>): <subject>

<body>

<footer>
```

- header（首行）必填，不超过 **100** 字符（`commitlint.config.cjs` 的 `header-max-length: 100`）；
- body/footer 可选，与 header 之间必须空一行，每行同样不超过 100 字符；
- 一次提交只做一件事：重构与功能、格式化与逻辑改动不得混在同一次提交里。

## 2. type 类型

| type       | 含义     | 何时使用                                     |
| ---------- | -------- | -------------------------------------------- |
| `feat`     | 新功能   | 用户可感知的新能力                           |
| `fix`      | 修复缺陷 | 修 bug                                       |
| `docs`     | 文档     | 只改文档（含 `docs/`、`knowledge/`、README） |
| `style`    | 格式     | 缩进、分号等，**不改逻辑**                   |
| `refactor` | 重构     | 既非新功能也非修 bug 的代码调整              |
| `perf`     | 性能     | 以性能为目的的改动                           |
| `test`     | 测试     | 新增/修改测试                                |
| `build`    | 构建依赖 | vite / nest 配置、`package.json` 依赖变更    |
| `ci`       | CI       | 流水线变更                                   |
| `chore`    | 杂项     | 不属于以上任何一类                           |
| `revert`   | 回滚     | 回滚某次提交                                 |
| `wip`      | 进行中   | 临时提交，合并前整理为正式 type              |
| `workflow` | 工作流   | 流程/脚本调整                                |
| `types`    | 类型     | 仅类型声明变更                               |
| `release`  | 发版     | 版本发布相关                                 |

> 类型清单由 `commitlint.config.cjs` 的 `type-enum` 定义；最后四项是通用集之外的仓库扩展。`npm run commit`（cz-git）默认列出常用 11 种，其余可直接手写。

## 3. scope 词表

英文小写，可省略；cz-git 支持逗号分隔多 scope（`feat(api,client):`）。

| scope            | 对应范围                                               |
| ---------------- | ------------------------------------------------------ |
| `api`            | 后端整体（`api/`）                                     |
| `admin`          | 中后台前端（`admin/`，旧约定写作 `web`）               |
| `client-web`     | 用户端（`client-web/`，Nuxt）                          |
| `client-android` | Flutter App（`client-android/`，骨架已入库、业务暂缓） |
| `gen`            | 代码生成器（前后端模板与落盘）                         |
| `docs`           | `docs/`、`knowledge/`、`README.md`                     |
| `config`         | 根工程配置（eslint / tsconfig / prettier）             |
| `deps`           | 依赖与锁文件                                           |
| `tooling`        | `scripts/`、husky 钩子                                 |
| `release`        | 发版                                                   |
| `root`           | 跨端且无法归入以上类别                                 |

后端也可直接写模块名（`fix(users):`、`feat(sentence):`），前端可写页面域（`fix(login):`）。

## 4. subject 写法

- **统一使用中文**；祈使句、简短精炼，说清「做了什么」，如「新增句子批量生成任务」；
- 结尾**不加句号**；`subject-case` 已关闭，中文不受大小写规则限制。

## 5. body 与 footer

- body 说明**为什么改**、影响面、取舍；不复述代码；
- footer 关联 issue（`Closes #123`）或标注破坏性变更（`BREAKING CHANGE:` + 迁移说明，header 可加 `!`）。

## 6. 分支与推送

- 主分支是 `main`（2026-11-15 由 `master` 更名，两端已同步）；
- 分支从 `main` 切出：`feature/*` / `fix/*` / `hotfix/*`；
- 仓库是**双远端**：`origin` = Gitee（主远端）、`github` = GitHub 镜像，用 `git pushall` 一次推两边；fetch/pull 只走 `origin`；
- 禁止 `--no-verify` 绕过钩子。

`pushall` 是**本地别名**（不随仓库分发），新克隆后补一次：

```bash
git remote add github https://github.com/LanYun417/Short-Sentence.git
git config alias.pushall '!git push origin main && git push github main'
```

> 不要用 `git remote set-url --add --push` 给 `origin` 挂两个 pushurl 来"一次推两边"：
> 它按顺序执行，第二个失败时第一个已经成功，退出码非 0 却分不清是哪边没成。
> 设计取舍见 [knowledge/Git提交规范/02-分支与发布.md](../knowledge/Git提交规范/02-分支与发布.md)。

## 7. 提交前自检清单

```bash
npm run format:check        # Prettier
npm run lint                # ESLint（--max-warnings 0）
npm run stylelint           # Stylelint
npm run guard:deps          # 依赖基线
npm run guard:locale        # 语言包 key / 占位符一致
npm run guard:imports       # 入库文件的相对导入可解析
npm run guard:scrollbar     # 禁原生纵向滚动条（统一 el-scrollbar）
npm run guard:components   # 禁裸 el-dialog / el-pagination（统一 BasicDialog / Pagination）
(cd api && npm run typecheck && npm run lint && npm run test)   # 后端
(cd admin && npm run type-check)                                # 中后台
(cd client && npm run build)                                    # Nuxt 用户端（构建内含类型检查）
```

全部通过才算完成；后端表结构变更另需 `prisma:push` + `prisma:comments`（见 api 规范第 4 章）。
