# 用户端规范（client-web/ · Nuxt 4 「短句」App）

适用于 `client-web/`（Nuxt 4 + Nuxt UI v4 + Tailwind CSS v4 + Pinia）。产品形态：响应式网页，「视觉场景英语闪卡」——看中文题干、看 16:9 对话场景图、作答、提交后 3D 翻转看答案。**作答支持两种模式（可随时切换）**：`输入`（自己敲出整句）与 `拼词`（点选打乱的词块拼成句子，词块由后端随题下发）。**图片禁止实时生成**：题目与配图均由后端定时任务预生成并入库，前端只消费。

## 1. 硬性约定

- 包管理器仅 npm；`package-lock.json` 入库；Node >= 24；
- 组合式 API + `<script setup lang="ts">`；**Nuxt UI v4 承担组件层**（`UButton` / `UInput` / `UFormField` / `UCard` / `UAlert` / `UTabs` / `UBadge` / `USelect` / `UTextarea` / `UAvatar` / `USkeleton` / `UApp`），**不引 Element Plus**（那是 admin 中后台的栈）；
- **不直接依赖 `reka-ui`**：它只是 Nuxt UI 的内部实现细节，业务代码一律用 `U*` 前缀组件，避免和 Nuxt UI 的版本绑死；
- 根组件必须包一层 `<UApp>`：Toast / Modal / Tooltip 等覆盖层依赖它提供的上下文；
- **作答模式只上报、不参与判分**：`submit` 带 `mode`（`input` / `assemble`），后端据此选 XP 规则（拼词约为输入六成，**界面上不提示差异**）；对错与经验一律服务端权威，前端不传。拼词词块（`question.words`）仅在 `mode=assemble` 时由后端下发，输入模式恒为 `null`——否则等于提前把答案给了用户；
- **布局只有一个入口**：根组件固定写成 `<UApp><NuxtLayout><NuxtPage /></NuxtLayout></UApp>`。顶栏、内容滚动区与移动端底部 Tab 属于 `layouts/default.vue`；登录 / 注册这类要独占视口的页面用 `layouts/auth.vue`（只渲染页面本身，不含外壳）。
  - **禁止用 `definePageMeta({ layout: false })` 表达「不要外壳」**：外壳若写在根组件里，`layout: false` 去不掉它（页面仍被顶栏占去 64px，`h-dvh` 分栏因此溢出、底部被裁）；更严重的是在 Nuxt 中页面级 `layout` 元信息必须由 `<NuxtLayout>` 消费，缺少它时两个 `layout: false` 页面之间做 SPA 导航会出现「路由已切换（`matched` / `name` 都正确）但 `<NuxtPage>` 不重新渲染」，表现就是**内容区一片空白**。
  - 认证页（登录 / 注册）共用 `components/AuthShell.vue`：品牌 + 页面标题 + 表单，**居中对称的单列**，整块在视口内垂直水平居中。
    品牌用 `favicon.svg` + 渐变字标「短句」，与 default 布局顶栏的呈现保持一致；**不要用 `public/logo.svg`**——它是 800×300 的完整字标原稿，viewBox 留白很大（内容仅占中间一块且偏左上），按高度缩放后既显小又不在正中。
    认证页只放功能性文案，不放卖点列表、产品示意这类营销内容——登录/注册是一次性动作，用户只想尽快填完，营销区块既占地方又拖慢视线。
- 语义色在 `app/app.config.ts` 的 `ui.colors` 配置（当前 `primary=sky`、`neutral=slate`）。**该文件必须放在 `app/` 目录内**（Nuxt 4 的 srcDir 是 `app/`，放仓库根不生效，表现为 primary 仍是默认的 green）；
- 图标用 `i-lucide-*`，本地由 `@iconify-json/lucide`（devDependency）打包，不走运行时 CDN；勿新增图标集除非确有需要；
- 样式用 Tailwind 工具类；主题令牌走 Nuxt color-mode（亮/暗）；
- 新增运行时依赖默认禁止，确需新增（如 html2canvas）走 `npm run guard:deps -- --update` 并在评审说明；
- **API Key 与 AI 调用只在服务端**：前端永远只打 `api/` 的 `client` 域接口。

### 开发端口（不得随意改）

| 端         | 端口 | 配置位置                                        |
| ---------- | ---- | ----------------------------------------------- |
| api        | 3000 | `api/.env` 的 `PORT`（Dockerfile / nginx 契约） |
| admin      | 5173 | `admin/.env.development` 的 `VITE_PORT`         |
| client-web | 3001 | `client-web/nuxt.config.ts` 的 `NUXT_DEV_PORT`  |

- Nuxt 默认端口就是 3000，与后端**硬冲突**：两者同起必有一端启动失败，且 `devProxy` 会把 `/api` 代理回自己形成自环。故此处固定 3001。
- `vite.server.strictPort = true`：端口被占直接报错，**不允许静默 +1 漂移**（CORS 与防盗链白名单按端口配置，漂移后图片会被判外链）。
- `devProxy` 必须同时代理 `/api` 与 `/static`：后端返回的图片地址是 `/static/...` 相对路径，漏配会 404，打卡海报（html2canvas）也会因图裂失败。
- 若确需改端口，三处同步：`nuxt.config.ts` 的 `NUXT_DEV_PORT`、`api/.env` 的 `CORS_ORIGIN` 与 `UPLOAD_ALLOWED_REFERERS`、根 `scripts/dev.mjs` 的 `CLIENT_PORT`。

## 2. 目录约定

```
client-web/
├─ app/
│  ├─ app.vue             # 根组件：UApp + NuxtLayout + NuxtPage，仅承担全局职责
│  │                      #   （SSR 预取当前用户/今日句签、JSON-LD），不渲染任何外壳
│  ├─ app.config.ts       # Nuxt UI 语义色（primary / neutral …），必须在此目录内
│  ├─ layouts/
│  │  ├─ default.vue      # 应用外壳：顶栏 + AppScrollArea + 移动端底部 Tab
│  │  └─ auth.vue         # 认证页布局：独占视口的全屏画布，无外壳
│  ├─ pages/              # 路由页面：index / login / register / profile / favorites / review / ai
│  ├─ components/         # AppScrollArea（悬浮滚动条）/ AuthShell（认证页骨架）/
│  │                      #   QuestionCard（翻转卡）/ AssembleAnswer（拼词作答）/
│  │                      #   SentenceCard / SentenceLibraryList /
│  │                      #   PracticeModePicker（作答方式）/ DifficultyPicker（难度）/
│  │                      #   BirthdayPicker / GrowthPanel
│  ├─ composables/        # useApi / useSsrApi（SSR 取数）/ useQuestionSession / useSse /
│  │                      #   useTodayCard / usePageSeo / useCountUp
│  ├─ stores/             # Pinia：auth（令牌走 Cookie，资料在挂载后从 localStorage 恢复）
│  ├─ middleware/         # auth（未登录跳登录并带 redirect）
│  ├─ utils/              # answer-normalize（比对规范化）/ auth-cookie（令牌 Cookie 读写）
│  └─ types/              # 接口 DTO 与跨页共享的 UI 类型
├─ nuxt.config.ts         # 端口、devProxy、modules
└─ .env                   # 可选：NUXT_PUBLIC_API_BASE_URL / NUXT_API_TARGET
```

- API 层统一经 `composables/useApi.ts` 的 `$fetch` 封装（baseURL、Bearer 注入、401 跳登录）；
- 自动导入可用（Nuxt 惯例），但**跨目录共享业务逻辑必须显式导出**，不依赖魔法字符串。

## 3. 刷题卡交互（核心体验， writing 时遵守）

单卡纵向布局，**不做上下滑动**，交互状态机：

```
answering ──提交(确定/回车)──▶ flipped ──下一题(回车/点击)──▶ answering(下一张)
```

- 布局顺序：`[题干（中文）] → [16:9 对话场景图] → [输入框] → [确定]`；移动端与桌面同一结构，宽度自适应；
- **3D 翻转**：外层 `perspective`，卡面 `transform-style: preserve-3d` + `backface-visibility: hidden`，`rotateY(180deg)` 过渡（建议 400ms ease）；正面=题干+图+输入，背面=正确句子 + IPA + 中文对照；
- **回车键双态分发**：输入态=提交，翻转态=下一题；提交后输入框失焦防误触；
- 比对在后端完成（权威），前端只做 `utils/answer-normalize` 的同口径预校验（小写/去首尾标点/压缩空白），**不把答案下发到前端**（`questions/next` 响应绝不含 sentenceEn/ipa）；
- 答案回显：翻转面显示 `isCorrect`、用户输入与正确答案对照差（可选高亮差异词）；
- 「不认识」按钮等同提交错误答案进复习池；收藏 ★ 在翻转面与正面均可达；
- 每日目标完成后才出现打卡海报入口，避免中途打断。

## 4. 鉴权（客户端用户，独立于后台）

- 注册/登录走 `/api/client/auth/*`，令牌存 Pinia 持久化（`auth` store）；
- 401：先尝试一次 refresh，失败清态跳 `/login?redirect=当前路径`；
- 个人中心字段：头像、昵称、邮箱、出生年月日、性别（male/female/**secret 保密**）、个性签名；头像走后端文件接口上传；
- 游客态：未登录可浏览首页示例题，**答题/收藏/复习必须登录**（接口层 401 即拦截跳登录）。

## 5. SSE 流式（AI 造句 / 词根拆解）

- 用原生 `fetch` + `ReadableStream` 逐行解析 `text/event-stream`（不用 EventSource——需要 POST 与自定义头）；
- 断开页面/切换题目时必须 `AbortController.abort()`；
- 渲染按 chunk 追加；错误事件显示可重试提示，不透出上游细节；
- 入口：题目详情页「场景延展」输入中文 → 流式返回地道英文 + 音标；长句点词 → 词根词缀拆解。

## 6. 打卡海报

- 前端 html2canvas 生成（`PosterCanvas` 组件 + `usePoster`）：包含日期、连续天数、今日句数、代表句子与场景图；
- 图片走同源 `/static`，无跨域污染；生成完提供「保存图片」与「复制分享文案」；
- 生成中禁用按钮防重复；失败降级为「截图提示」。

## 7. 门禁与提交

```bash
cd client
npm run build     # nuxt build（内含类型检查）
```

提交前另跑根目录 `format:check` / `lint`（见 `docs/git-提交规范.md` 第 7 节）；路由、交互、SSE 三处必须有可复现的手工验证步骤记录在 PR 描述里。
