# 微信小程序开发规范（client-miniapp）

> 适用目录：`client-miniapp/`
> 定位：「短句」的微信渠道客户端。**不新建后端**，与 `client-web`、`client-android` 共用同一个
> NestJS 服务（`api/`）与同一套 `/api/client/*` 接口、同一套 JWT 双令牌。

## 一、技术选型

- **原生小程序（WXML / WXSS / TypeScript）**，不引入 uni-app、Taro 等跨端框架。
  理由：只出微信这一个渠道，跨端框架的收益为零，却会带来运行时依赖与构建链负担。
- **零运行时依赖**：`package.json` 只有 `devDependencies`（`typescript`、`miniprogram-api-typings`），
  业务代码不依赖任何 npm 包；图标用 sharp 预渲染成 PNG（`assets/tabbar/`），不在运行时生成。
- TypeScript 由微信开发者工具内置的 `useCompilerPlugins: ["typescript"]` 转译；
  类型检查在仓库侧单独跑 `npm run type-check`（`tsc --noEmit`），**不要依赖开发者工具报类型错**。

## 二、目录结构

```
client-miniapp/
├─ app.ts / app.json / app.wxss   # 启动、全局路由与 tabBar、全局样式令牌
├─ utils/
│  ├─ env.ts        # 接口基地址（开发/生产）+ 静态资源 origin
│  ├─ request.ts    # wx.request 封装：信封解包 + 令牌注入 + 401 单飞刷新
│  ├─ auth.ts       # 微信/邮箱登录、登出、启动期静默登录（sessionReady）
│  ├─ storage.ts    # 令牌 / 用户缓存 / 难度与作答模式偏好
│  ├─ nav.ts        # 登录跳转、刷题跳转、tab 切换
│  ├─ format.ts     # 资源绝对地址、千分位、耗时格式化
│  └─ feedback.ts   # Toast / 震动 / 错误文案
├─ services/        # 按业务域封装的接口（types.ts 手写后端契约）
├─ pages/
│  ├─ index / practice / growth / leaderboard / profile / login
│  ├─ stages/       # 情景闯关：index（地图）/ scene（剧本）/ script（关卡）/ dialogue（对话）
│  ├─ banks / library / cards / checkin      # 题库 / 语句库 / 句签 / 打卡
│  ├─ boss / ipa / word-root / coach / weekly # Boss / 音标 / 词根 / AI 私教 / 周报
│  └─ notices / feedback / submissions / team / profile-edit / chains(+detail)
├─ scripts/         # check-pages.mjs：页面四件套、事件绑定、WXML 闭合、wx:key、tabBar 图标
└─ assets/tabbar/   # tabBar 图标（sharp 由 SVG 渲染，双色各一套）
```

## 二·补、功能覆盖与已知限制

已接入（26 个页面）：登录、刷题（默写/拼词）、题库（场景/节日）、语句库（收藏/记录/复习）、
成长、排行榜、句签、打卡、每日 Boss、音标、词根、AI 私教、周报、情景闯关（地图/剧本/关卡/对话）、
接龙、小分队、投稿、通知、反馈、资料编辑、注销与数据导出。

**刻意未接入**（附原因，别当成遗漏）：

| 能力                                         | 原因                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| `PATCH` 系接口（队伍改名、对话翻译开关）     | `wx.request` 不支持 PATCH 方法；翻译开关改由发消息时上送                    |
| SSE 流式 AI（题目解析 / 场景造句 / 词根 AI） | 需 `enableChunked` 手工拼流，未在真机验证前不接入                           |
| 反馈附图                                     | `wx.uploadFile` 一次只能带一个文件，后端要 5 张；小程序端只收纯文本         |
| 修改密码                                     | 需要邮箱验证码三段式（发码 → 校验 → 改密），小程序内体验割裂，引导到 Web 端 |
| 打卡长图海报                                 | 需要 canvas 2D + 相册授权；当前用原生分享卡片替代                           |

## 三、网络层约定

与 Web 端 `client-web/app/composables/useApi.ts` 保持同一语义，便于两端排查同一个问题：

1. 后端成功响应恒为 `{ code: 200, message, data }`，`request<T>()` 直接返回 `data`。
2. 业务错误（`code !== 200`）抛 `ApiError`，携带服务端 `message`。
3. HTTP 401 或信封 `code === 401`：先**单飞**刷新一次令牌并重放原请求；
   刷新失败 → 清会话 + `reLaunch` 到登录页。
4. 请求头带 `X-Timezone-Offset`（后端据此格式化时间）。
5. `HttpMethod` 不含 `PATCH`（`wx.request` 不支持）。

> 契约以 `api/` 的 docs=代码门禁（`docs:gen` 产出的 OpenAPI）为准；
> 接口变更后手动同步 `services/types.ts`。

## 四、登录与会话

- **主路径：微信一键登录** `POST /client/auth/wechat`
  （`wx.login` 的 code → 服务端 `code2Session` → 自建 JWT 双 token）。
- **兜底：邮箱密码登录** `POST /client/auth/login`（给 Web 端注册过的老用户）。
- **启动期静默登录**：`app.onLaunch` 调 `sessionReady()`；本地无令牌且未主动登出时自动微信登录。
- **页面必须先 `await sessionReady()` 再判断 `isLoggedIn()`**：
  页面 `onShow` 可能早于静默登录完成，直接判断会把用户误踢到登录页。
- 主动登出后写 `ss_logged_out` 标记，后续启动不再自动登录。
- 令牌存 `wx.setStorageSync`（键 `ss_*`）。**不做** `wx.getUserProfile` 之类的头像昵称授权，
  昵称/头像走个人中心后续迭代，避免无谓的授权弹窗。

## 五、页面约定

- tabBar 四页：练习 `index` / 成长 `growth` / 排行 `leaderboard` / 我的 `profile`；
  刷题 `practice` 与登录 `login` 为非 tab 页。
- **页面方法必须声明在 `Page<TData, TCustom>` 的 `TCustom` 里**，
  否则 `Page.Options` 的 excess property 检查会报错（类型即文档）。
- WXML 里不要访问可能为 `null` 的对象的深层属性：用零值对象兜底
  （如 `EMPTY_CHECKIN`、`EMPTY_RESULT`），避免渲染层取值告警。
- 滚动一律用页面滚动 / `scroll-view`；不手写 `overflow: auto` 的定高容器。
- **图片一律「固定比例容器 + `mode="aspectFill"`」，不要用 `mode="widthFix"`**：
  实测 `widthFix` 在开发者工具模拟器里不绘制（元素有尺寸但不出图），
  且它依赖图片固有尺寸推算高度，图片慢加载时会把卡片顶得跳动。
- 视觉令牌写在 `app.wxss` 的 `page {}` 里的 CSS 变量（`--brand` / `--ink` / `--line` …），
  与 Web 端语义一致：**primary = sky，neutral = slate**。

### 刷题卡（3D 翻转）

- 两面用 **grid 叠在同一格**（`.flip-inner { display: grid }` + `.face { grid-area: 1 / 1 }`），
  容器高度自动取两面较高者，不要用 `position: absolute` + 固定高度（背面内容会被裁）。
- 翻转态加 `pointer-events: none` 到正面，避免隐藏面仍可点击。
- 作答模式：`input`（默写）/ `assemble`（拼词）。**切模式按产品约定重抽一张**；
  `words` 为空时自动退回 `input`，避免「无词可点」卡死。
- 判分完全由后端裁决，前端**不做** normalize 放宽。

### 情景闯关（pages/stages/*）

- 三层结构：**场景 → 剧本 → 关卡**，对应 `GET /client/stages`、`/stages/scenes/:id`、`/stages/scripts/:id`。
- 关卡解锁由后端判定（每剧本首关默认解锁、关内顺序解锁）；前端只用 `unlocked` 决定是否可点。
- 对话页路由参数只有 `id`（= `stage_story.id`）：
  - 进入调 `POST /client/stages/:id/dialogue`（有 active 会话则续聊，`restart=true` 重开一局）；
  - 发消息 `POST /:id/dialogue/messages`，返回 1~3 条角色回应 + 新候选短句，可能 `ended/cleared`；
  - 通关 = 聊够 `minTurns` 轮 **且** 模型判定目标达成；达到 `maxTurns` 结束但可重来。
- **翻译开关不要调 `PATCH /:id/dialogue/translation`**：`wx.request` 不支持 PATCH，
  而发消息接口的 `showTranslation` 已由服务端持久化（`translationUsed` 粘性，全程关翻译有加成）。
- 发消息先乐观追加用户气泡；**失败要回滚这条气泡并还原输入**，否则本地记录与服务端历史不一致。
- 消息只保留 `contentEn` 主文本，中文按 `showTranslation` 显隐；不复述情绪/动作旁白。

## 六、开发与联调

1. `cd api && npm run start:dev`（`:3000`）。
2. 微信开发者工具「导入项目」选择 `client-miniapp/`，填入自己的 AppID。
3. 「详情 → 本地设置」勾选**不校验合法域名、web-view 域名、TLS 版本以及 HTTPS 证书**。
4. 真机预览：把 `utils/env.ts` 的 `DEV_BASE_URL` 或 Storage 里的 `ss_api_base`
   改成电脑局域网 IP（如 `http://192.168.1.8:3000/api`），手机与电脑同一网段。
5. 微信登录需后端 `.env` 配置 `WECHAT_MINIAPP_APPID` / `WECHAT_MINIAPP_SECRET`；
   未配置时该接口返回不可用，前端会退回邮箱登录。

### 可选的自动化截图验证（本机才跑，不进 CI）

开发者工具自带 CLI，配合 `miniprogram-automator` 可以不开人工点、直接进页面截图，
用来抓「样式没生效 / 图片不显示 / 页面空白」这类只有渲染后才暴露的问题：

```bash
# 1) 开发者工具：设置 → 安全设置 → 服务端口 开启（一次性）
# 2) 以自动化模式打开工程（touristappid 即可，无需真实 AppID）
cli.bat auto --project <client-miniapp 绝对路径> --auto-port 9421 --port <IDE 端口>
# 3) 本机临时装驱动（不要写进项目依赖）
npm i miniprogram-automator
```

```js
const automator = require('miniprogram-automator');
const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9421' });
const page = await mp.reLaunch('/pages/index/index');
await page.waitFor(1500);
await mp.screenshot({ path: 'shots/index.png' }); // 逐页跑一遍再人工看
```

注意：`miniprogram-automator` 只是本机验证工具，**不要加进任何 package.json**
（`npm i` 在临时目录里会向上找到仓库根并写入根依赖，触发 `guard:deps` 失败）。
建议放在 `.workbuddy/` 这类已被忽略的目录，并在里面先 `npm init -y` 再安装。

## 七、发布前检查

- `npm run type-check` 通过；`npm run check` 通过（页面四件套 / 事件绑定 / WXML 闭合 / `wx:key` / tabBar 图标）；
  根仓库 `npx eslint client-miniapp` 无告警。
- 生产域名替换 `utils/env.ts` 的 `PROD_BASE_URL`，并在微信公众平台
  「开发管理 → 服务器域名」把它加入 **request 合法域名**（必须 HTTPS + 已备案）。
- **后端 `UPLOAD_ALLOWED_REFERERS` 必须包含 `servicewechat.com`**：
  小程序加载图片时 Referer 固定为 `https://servicewechat.com/<appid>/<ver>/page-frame.html`，
  漏配会让所有 `<image>` / `getImageInfo` 直接 **403**（真机同样如此，不是模拟器问题）。
- 后端 `CORS_ORIGIN` 加入小程序来源（小程序请求无 Origin，但 `web-view`/调试场景需要）。
- 小程序后台配置隐私协议（收集的学习数据、微信 openid 用途），与
  `client-web` 的隐私政策口径保持一致。
- 包体积：当前主包为纯代码 + 8 张 tabBar 图标，远低于 2MB；
  后续加「情景闯关」对话等模块时再考虑分包。
