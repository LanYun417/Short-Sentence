# 用户端规范（client/ · Nuxt 4 「短句」App）

适用于 `client/`（Nuxt 4 + Reka UI + Tailwind CSS v4 + Pinia）。产品形态：响应式网页，「视觉场景英语闪卡」——看中文题干、看 16:9 对话场景图、输入英文、提交后 3D 翻转看答案。**图片禁止实时生成**：题目与配图均由后端定时任务预生成并入库，前端只消费。

## 1. 硬性约定

- 包管理器仅 npm；`package-lock.json` 入库；Node >= 24；
- 组合式 API + `<script setup lang="ts">`；Reka UI 承担组件层（按钮/输入框/对话框/提示），**不引 Element Plus**（那是 admin 中后台的栈）；
- 样式用 Tailwind 工具类；主题令牌走 Nuxt color-mode（亮/暗）；
- 新增运行时依赖默认禁止，确需新增（如 html2canvas）走 `npm run guard:deps -- --update` 并在评审说明；
- **API Key 与 AI 调用只在服务端**：前端永远只打 `api/` 的 `client` 域接口。

## 2. 目录约定

```
client/
├─ app.vue                # 根组件（NuxtLayout/NuxtPage）
├─ pages/                 # 路由页面：index / login / register / profile / favorites / review
├─ components/            # QuestionCard（翻转卡）/ AnswerInput / PosterCanvas / AppNavbar …
├─ composables/           # useAuth / useQuestionSession / useSse / usePoster
├─ stores/                # Pinia：auth（持久化）
├─ utils/                 # answer-normalize（比对规范化）/ date
├─ types/                 # 接口 DTO
├─ nuxt.config.ts
└─ .env / .env.production  # VITE_API_BASE_URL 等
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
