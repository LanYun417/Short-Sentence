# android —「短句」Flutter App

「短句」App 的移动端（Android / iOS）工程，基于 Flutter。

> **当前状态：骨架入库，尚未开始业务开发。**
> 仓库先把它纳入版本管理，保证多人协作时目录结构与依赖锁定不丢失；
> 具体的页面与交互待确认后启动开发。

## 技术栈

| 项       | 选型                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| 框架     | Flutter（stable 通道，CI 锁定 3.47.6）                                        |
| 语言     | Dart（SDK `^3.13.5`）                                                         |
| 状态管理 | 待定（预计 Riverpod / Pinia 二选一）                                          |
| 网络     | 待定（预计 `dio` + 与 `client/` 端同构的接口层）                              |
| 最低版本 | Android API 24+（`flutter.minSdkVersion`，见 `android/app/build.gradle.kts`） |

## 目录结构

```
android/
├─ lib/                  # Dart 业务代码（当前为模板默认页）
│  └─ main.dart
├─ test/                 # Dart 单元 / Widget 测试
├─ android/              # Android 原生工程（Gradle Kotlin DSL）
│  ├─ app/
│  └─ gradle/wrapper/
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
