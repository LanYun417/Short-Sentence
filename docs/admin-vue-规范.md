# 中后台前端规范（admin/ · Vue 3.5 + Vite 8 + Element Plus）

适用于 `admin/`（Vue 3.5 + Vite 8 + Element Plus 2.14 + Tailwind 4 + Pinia 4）。本文是基座约定的浓缩，「短句」运营页面同样遵循。

## 1. 硬性约定

- `<script setup lang="ts">` + 组合式 API，**禁止 Options API**；
- Vue / Vue Router / Pinia / VueUse **自动导入，禁止手 import**；Element Plus 命令式 API（ElMessage/ElMessageBox）必须从 `@/utils/element` 桶引入，禁止整库 import；
- Prettier 铁律：`semi: true`、`singleQuote: true`、`printWidth: 120`；
- 样式优先级：**Tailwind 工具类首选**，SCSS 仅兜底且必须 SFC scoped；Tailwind v4 刻意不引入 preflight；
- 响应式优先：固定尺寸弹层（抽屉/弹窗）必须走 `useResponsiveSize` / `BasicDialog`；
- **滚动一律用 `el-scrollbar`，禁止原生滚动条**（细则见 §7）：不要给容器写 `overflow-y-auto` / `overflow-auto`，纵向滚动统一包 `<el-scrollbar max-height="…">`；门禁 `npm run guard:scrollbar` 会拦住这类写法；
- 按钮权限用 `v-permission` 指令；权限码遵循 `:list / :query / :add / :edit / :remove`；
- 新增运行时依赖默认禁止，确需新增走 `guard:deps -- --update` 并在评审说明。

## 2. 目录约定

```
src/
├─ api/          # axios 实例（request.ts）+ 各模块接口（与后端 controller 一一对应）
├─ components/   # 通用组件（BasicDialog / Pagination / SearchForm / MenuTree …）
├─ composables/  # 组合式复用逻辑（useTable / useDict / useTheme …），目录名必须是 composables（非 hooks）
├─ directives/   # v-permission
├─ layout/       # 主布局（Navbar / Sidebar / TagsView / AppMain）
├─ locales/      # zh-CN / en-US，key 由 guard:locale 门禁对齐
├─ router/       # 静态路由（login/error/redirect）+ 全局守卫
├─ store/        # Pinia（user / permission / app / tagsView / notice）
├─ styles/       # index.css（Tailwind 入口 + @theme）/ element.scss（EP 覆盖）
├─ utils/        # auth / format / permission / echarts / element（命令式 API 桶）
└─ views/        # 页面（一个业务域一个目录，组件就近放 components/）
```

## 3. 新增一个运营页面（以「题库管理」为例）

1. `src/api/sentence.ts`：按后端契约封装 get/post/put/del（泛型 + `request.ts` 已解包响应）；
2. `src/views/system/sentence/index.vue` + `components/`：查询表单（SearchForm）、表格（useTable）、弹窗（BasicDialog）；
3. 后端菜单种子（`src/prisma/seed.service.ts`）注册 M/C/F 节点与权限码——**前端动态路由由菜单树驱动，没有菜单就进不去页面**；
4. `src/locales/` 两份语言包同步补 key；
5. e2e/单测按需；提交前跑 `npm run type-check` + 根 `npm run lint`。

## 4. 与后端联调的固定约定

- 统一响应体 `{ code, message, data }` 由 `request.ts` 解包，业务层拿到的就是 data；
- 401 无感刷新（单飞 + 队列重放）、403 跳 `/403`；**失败提示统一走拦截器**，页面里不要散落 `ElMessage.error`（`silent` 请求除外）；
- 列表分页键 `{ list, total, page, pageSize }`；
- 时间展示用 `format.ts`（按 `X-Timezone-Offset` 头按用户时区格式化）；
- 导出 CSV 用 `blob` 响应 + `download.ts`，注意错误体是 JSON Blob（拦截器已处理）。

## 5. 「短句」运营页面补充约定

- **题库管理**（句子 CRUD）：表格列覆盖句子/译文/音标/分类/难度/状态/图片预览；图片列用 `fileUrl` + `?scale=` 缩略图；
- **生成批次监控**：展示每日批次的目标数/成功数/失败数、耗时、`ai_call_log` 摘要；提供「手动补跑」按钮（调 `POST /api/sentences/gen/batch`）；
- 图片预览弹窗必须响应式（`useResponsiveSize`），禁止写死 800px 之类；
- 状态筛选（pending_image/ready/offline）用后端枚举字典，不要前端硬编码映射。

## 6. 工程门禁

```bash
cd admin
npm run type-check   # vue-tsc --noEmit
npm run test         # vitest
npm run build        # 生产构建（预压缩 .gz/.br）
```

根目录另跑 `npm run lint` / `stylelint` / `format:check` / `guard:locale` / `guard:scrollbar`（见 git 规范第 7 节）。

## 7. 滚动条约定（el-scrollbar）

**所有纵向滚动都走 `<el-scrollbar>`**，不要手写 `overflow-y-auto` / `overflow-auto`：后者会画出浏览器原生滚动条，与全局内容区、侧边栏、抽屉统一的细滚动条并存时非常割裂，而且只有内容够长才看得见（本地容易漏）。门禁 `npm run guard:scrollbar` 扫 `admin/src` 拦截这类写法（放行 `overflow-x-*` 与 `overflow-hidden`：前者只横向、后者是裁剪）。

四种典型位置：

| 位置                    | 写法                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 页面内容区 / 侧边栏     | 已有封装（`layout/index.vue`、`Sidebar`），直接用                                                                                    |
| 抽屉（`el-drawer`）     | 默认 body 超出即原生滚动 → 包 `<el-scrollbar class="h-full">`，或 flex 列 + `el-scrollbar.min-h-0.flex-1`（上下固定区加 `shrink-0`） |
| 弹窗（`BasicDialog`）   | 正文已由 `BasicDialog` 的 `el-scrollbar` 限高，调用方**不要再套一层**                                                                |
| 弹层 / 代码块 / 长 JSON | `<el-scrollbar max-height="15rem">` 之类限高即可                                                                                     |

**两个必须知道的坑**：

1. **`el-scrollbar` 自带 `height: 100%`**（EP 默认样式）。放进**高度确定**的容器（抽屉 body、定高 flex 项、`h-full` 容器）时会被撑满整高，把上方内容顶出可视区 —— 容器随即冒出**原生滚动条**，而页面看起来内容并不多。所以：要么给容器限高（`max-height`）、要么用 flex + `min-h-0 flex-1`；确实只需要内容高度时显式覆盖 `height: auto`。
2. **`Pagination` 外层就是用 `el-scrollbar` 包横向滚动的**（窄屏分页器超宽）。它已把根节点高度覆盖成 `auto`（`.pagination-scrollbar`），但把 `Pagination` 放进定高容器时仍建议外层加 `shrink-0`，别让它抢高度。
