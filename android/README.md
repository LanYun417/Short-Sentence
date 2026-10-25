# android —「短句」Flutter App

「短句」App 的移动端（Android / iOS）工程，基于 Flutter。
接口与 Web 端（`client/`）**同源同契约**，视觉与交互按移动端重做（设计语言见
[`docs/android-app-规范.md`](../docs/android-app-规范.md)）。

> **当前状态：主要功能已完成，可日常使用。**
> 刷题（默写 / 拼词）、语句库（收藏 / 复习 / 历史）、成长（等级 / 成就 / 场景 / 句签）、
> 我的（资料 / 改密 / 登出）、每日句签领取与回看、AI 拓展（流式造句 / 词根）、题目反馈。

## 技术栈

| 项       | 选型                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| 框架     | Flutter（stable 通道，CI 锁定 3.47.6）                                        |
| 语言     | Dart（SDK `^3.13.5`）                                                         |
| 状态管理 | **Riverpod**（`Notifier` + `Provider`，编译安全、可测）                       |
| 网络     | **Dio**（拦截器链）+ 与 `client/` 端字段同构的模型层                          |
| 路由     | **go_router**（声明式 + 登录守卫 `redirect`）                                 |
| 令牌存储 | **flutter_secure_storage**（Keystore / Keychain，非 SharedPreferences）       |
| 配图缓存 | **cached_network_image**                                                      |
| 最低版本 | Android API 24+（`flutter.minSdkVersion`，见 `android/app/build.gradle.kts`） |

**零新增运行时依赖**：彩带、微光、数字滚动、按压反馈、等级环全部自绘
（`CustomPainter` / `AnimationController`），没有为视觉效果引入第三方包。

## 目录结构

```
android/
├─ lib/
│  ├─ main.dart              # 入口：ProviderScope + MaterialApp.router
│  ├─ router.dart            # go_router 路由表 + 登录守卫
│  ├─ theme.dart             # 主题（品牌色 / 文字层级 / 组件默认样式 / 页面转场）
│  ├─ theme/
│  │  ├─ palette.dart        # 语义色板（画布/卡面/主次文/成功失败金），亮暗各一份
│  │  ├─ motion.dart         # 动效令牌（时长/曲线/错峰/减弱动效降级）
│  │  ├─ brand.dart          # 进度 Hero 五档配色（与 Web 端逐值一致）
│  │  └─ icon_map.dart       # 后端图标名 → 本地图标
│  ├─ config/app_config.dart # 接口基址（默认 10.0.2.2）
│  ├─ api/
│  │  ├─ dio_client.dart     # Dio + 自动 Bearer + 401 单飞刷新 + 重放
│  │  ├─ auth_api.dart       # 登录/注册/验证码/资料/改密/登出/静态资源 URL
│  │  ├─ questions_api.dart  # 抽题/判分/收藏
│  │  ├─ library_api.dart    # 收藏夹/复习池/历史/打卡/成长/句签/反馈
│  │  ├─ ai_api.dart         # 流式 SSE（造句 / 词根）与额度
│  │  ├─ ai_result.dart      # 流式 JSON 的宽容解析
│  │  └─ models/             # 与后端逐字段同构的模型
│  ├─ state/                 # Riverpod 控制器（认证/刷题/语句库/成长/句签/打卡）
│  ├─ pages/
│  │  ├─ shell_page.dart     # 四 Tab 外壳（交叉淡入 + 停靠式底栏）
│  │  ├─ quiz_page.dart      # 刷题（进度 Hero / 翻卡 / 拼词 / 经验 / 达标庆祝）
│  │  ├─ library_page.dart   # 语句库（收藏 / 复习 / 历史）
│  │  ├─ growth_page.dart    # 成长（等级环 / 成就 / 场景 / 句签墙）
│  │  ├─ profile_page.dart   # 我的（身份卡 / 资料 / 改密 / 退出）
│  │  ├─ login_page.dart     # 登录 / 注册（含验证码）
│  │  └─ splash_page.dart    # 启动恢复
│  ├─ sheets/                # 底部弹窗（句签海报 / 领取 / AI / 反馈 / 资料 / 改密 / 句子详情）
│  └─ widgets/               # 通用件（卡片/分段控件/词块/骨架/彩带/极光/按压…）
├─ test/                     # 单元 / Widget 测试
├─ android/                  # Android 原生工程（Gradle Kotlin DSL）
├─ assets/brand/logo.png     # 品牌标（由 client/public/favicon.svg 渲染）
└─ pubspec.yaml
```

## 页面与交互要点

| 页面                                                                                                                                       | 关键交互                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 刷题                                                                                                                                       | 看中文 → 默写或拼词 → 提交翻卡 → 上一题结果与经验；达标弹彩带并可领句签；卡片背面可 AI 拓展 / 反馈 |
| 语句库                                                                                                                                     | 三段切换（收藏 / 复习 / 历史），下拉刷新、触底加载、返回顶部、左滑取消收藏（可撤销）、点开详情     |
| 成长                                                                                                                                       | 等级环与 XP、连续打卡、成就墙（解锁 / 未解锁）、场景地图、句签墙；                                 |
| 点句签开**闪卡**：卡背（日期 + 封蜡 + 寄语）→ 轻触翻面看句子 → 落定扫光，可翻回；无翻面/收起按钮（点卡片翻面、点空白关闭），翻回不倒着转； |
| 转手机时整卡 ±8° 倾斜、高光跟手（姿态来自原生 `GAME_ROTATION_VECTOR`）                                                                     |
| 我的                                                                                                                                       | 身份卡（渐变或句签背景）、三项统计、编辑资料、修改密码、关于、退出登录                             |

## 与后端的关系

- 接口基址与 `client/`（Nuxt 用户端）**同源**，复用同一套后端接口：
  - 认证：`POST /api/client/auth/login` → `accessToken`（`tokenType=client`）
  - 刷题：`GET /api/client/questions/next`、`POST /api/client/questions/:id/answer`
  - 其余见 `docs/client-nuxt-规范.md` 与后端 `src/modules/client/**`
- 令牌存储 key 前缀 `ss_`，与 Web 端同构但**不共用**（不同端的登录态相互独立）。

## 本地开发

```bash
cd android
flutter pub get
flutter run          # 连接真机 / 模拟器
```

### 指定后端地址

默认走 **Android 模拟器**的宿主机别名 `http://10.0.2.2:3000/api`。其他环境：

```bash
# iOS 模拟器 / 桌面调试（直接用宿主机 localhost）
flutter run --dart-define=API_BASE_URL=http://localhost:3000/api

# 局域网真机：换成电脑的局域网 IP（先确认后端监听 0.0.0.0）
flutter run --dart-define=API_BASE_URL=http://192.168.1.10:3000/api
```

> ⚠️ **明文 HTTP**：开发期地址是 http，Android 9+ 默认禁止明文流量。
> 已在 `android/app/src/main/res/xml/network_security_config.xml`
> 对 `10.0.2.2` / `localhost` / 私网段放行（**仅此配置，release 不放行**）。

> 💡 **看动效与截图建议用 `--release`**：debug 包在模拟器上首帧会掉 100+ 帧，
> 容易被系统判 ANR，也不代表真实流畅度。`flutter run --release` 走 AOT，接近真机。

静态检查与测试：

```bash
flutter analyze      # 等价于 dart analyze，覆盖类型检查与 lint
flutter test
```

> **Widget 测试必须把 `Motion.loopAnimations` 置为 false**（见 `quiz_page_test.dart`）：
> 极光与骨架微光是无限循环动画，会让 `pumpAndSettle` 永远等不到静止。

## 构建

```bash
flutter build apk --release        # Android
flutter build appbundle --release  # 上架 Google Play 用 AAB
flutter build ipa --release        # iOS（需 macOS + Xcode）
```

签名配置不入库：`android/key.properties` 与 `*.jks` 均已在 `.gitignore` 中排除；
当前 release 仍复用 debug 签名（模板默认），正式发版前需替换。

## 相关文档

- `docs/android-app-规范.md` —— 设计语言、动效规范、交付范围与验收标准
- `docs/client-nuxt-规范.md` —— Web 端规范，业务交互（抽题、判分、句签）与本端一致
- `docs/api-nestjs-规范.md` —— 后端接口契约与双鉴权体系（`tokenType=client`）
- `docs/git-提交规范.md` —— 提交规范，`scope` 使用 `android`
