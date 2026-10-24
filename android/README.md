# android —「短句」Flutter App

「短句」App 的移动端（Android / iOS）工程，基于 Flutter。

> **当前状态：基础设施已搭好，业务开发进行中。**
> 已完成：技术栈定选、网络层（Dio + 401 单飞刷新）、令牌安全存储、
> 认证闭环（登录/注册 + **图形验证码**）、路由与品牌主题、静态检查与单测。
> 见下方「目录结构」。

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

## 目录结构

```
android/
├─ lib/
│  ├─ main.dart              # 入口：ProviderScope + MaterialApp.router
│  ├─ router.dart            # go_router 路由表 + 登录守卫
│  ├─ theme.dart             # 品牌主题（sky→indigo→violet 渐变，亮/暗）
│  ├─ config/app_config.dart # 接口基址（默认 10.0.2.2，见下）
│  ├─ api/
│  │  ├─ dio_client.dart     # Dio + 自动 Bearer + 401 单飞刷新 + 重放
│  │  ├─ api_exception.dart  # 错误归一（优先透传服务端中文 message）
│  │  ├─ auth_api.dart       # 登录/注册/验证码/登出/我的资料
│  │  └─ models/user.dart    # ClientUserProfile（与后端契约同构）
│  ├─ state/
│  │  ├─ auth_storage.dart   # 令牌安全存储（ss_ 前缀，与 Web 不共用）
│  │  └─ auth_controller.dart# 登录态/注册/登出/启动恢复
│  ├─ pages/
│  │  ├─ splash_page.dart    # 启动恢复（避免先进首页再被弹回登录页）
│  │  ├─ login_page.dart     # 登录/注册（含验证码）
│  │  └─ home_page.dart      # 落地页 + 接口连通性自检
│  └─ widgets/
│     ├─ brand_header.dart   # Logo + 渐变字标
│     └─ captcha_field.dart  # 验证码输入（图片即刷新按钮）
├─ test/                 # Dart 单元 / Widget 测试
├─ android/              # Android 原生工程（Gradle Kotlin DSL）
│  ├─ app/
│  └─ gradle/wrapper/
├─ assets/brand/logo.png  # 品牌标（由 client/public/favicon.svg 渲染，源改了要重跑生成）
├─ pubspec.yaml          # 依赖与资源声明
├─ analysis_options.yaml # 静态检查配置（启用 flutter_lints）
└─ .metadata             # Flutter 工具链版本锁定
```

## 与后端的关系

- 接口基址与 `client/`（Nuxt 用户端）**同源**，复用同一套后端接口：
  - 认证：`POST /api/client/auth/login` → 拿 `accessToken`（`tokenType=client`）
  - 刷题：`GET /api/client/questions/next`
  - 其余接口见 `docs/client-nuxt-规范.md`
- 令牌存储 key 前缀 `ss_`，与 Web 端同构但**不共用**（不同端的登录态相互独立）。
- 后端契约以 `api/` 为准；本端不新增后端接口时，接口层应与 `client/` 保持字段同构。

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

静态检查与测试：

```bash
flutter analyze      # 等价于 dart analyze，覆盖类型检查与 lint
flutter test
```

> 若本机 Flutter 版本与 `pubspec.yaml` 的 SDK 约束冲突，以 `flutter --version` 输出为准调整，
> 或用 `fvm` 固定版本；CI 侧固定为 stable 3.47.6。

## 构建

```bash
flutter build apk --release        # Android
flutter build appbundle --release  # 上架 Google Play 用 AAB
flutter build ipa --release        # iOS（需 macOS + Xcode）
```

签名配置不入库：`android/key.properties` 与 `*.jks` 均已在 `.gitignore` 中排除。

## 相关文档

- `docs/client-nuxt-规范.md` —— Web 端规范，业务交互（刷题卡、答案判定、打卡海报）与本端保持一致
- `docs/api-nestjs-规范.md` —— 后端接口契约与双鉴权体系（`tokenType=client`）
- `docs/git-提交规范.md` —— 提交规范，`scope` 使用 `android`
