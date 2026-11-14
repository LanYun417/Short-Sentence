/// 应用配置：接口基址等运行期可变项。
///
/// 基址通过 `--dart-define=API_BASE_URL=...` 注入，可按运行环境切换：
///
/// | 场景 | 取值 |
/// |---|---|
/// | Android 模拟器（默认） | `http://10.0.2.2:3000/api` |
/// | iOS 模拟器 / 桌面调试 | `http://localhost:3000/api` |
/// | 局域网真机 | `http://192.168.x.x:3000/api` |
/// | 生产 | `https://api.<域名>/api` |
///
/// **为什么默认是 `10.0.2.2` 而不是 `localhost`**：Android 模拟器里的 `localhost`
/// 指向模拟器自身，访问不了宿主机；`10.0.2.2` 是模拟器提供的「宿主机回环」别名。
///
/// 注意 Android 9+ 默认禁止明文 HTTP：main 基线禁明文，由 debug / profile
/// sourceSet 的同名 `network_security_config.xml` 覆盖放行（release 不含，
/// 正式包仍只能走 HTTPS）。
class AppConfig {
  const AppConfig._();

  /// 接口基址（不含尾部斜杠）。
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api',
  );

  /// 静态资源基址（配图 `/static/...`）。
  ///
  /// 与 apiBaseUrl 同源不同路径：后端把上传文件挂在 `/static` 路由下，
  /// 而接口统一在 `/api` 前缀。配图本身在 `<上传根>/` 下以 `filePath` 记录，
  /// 对外 URL 形如 `http://<host>/static/xxx.webp`。
  ///
  /// 由 apiBaseUrl 去掉 `/api` 后缀推导，避免再维护一个配置项。
  static String get staticBaseUrl =>
      apiBaseUrl.endsWith('/api') ? apiBaseUrl.substring(0, apiBaseUrl.length - 4) : apiBaseUrl;

  /// 请求超时。AI 流式接口首包可能较慢，连接超时给宽一些。
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 60);
}
