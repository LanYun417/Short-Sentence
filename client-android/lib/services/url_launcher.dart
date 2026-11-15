/// 打开外部链接（系统浏览器）——版本更新跳 APK 下载地址用。
///
/// 走原生桥 `short_sentence/url_launcher`（UrlLauncherBridge.kt），
/// 项目「零新增运行时依赖」硬约束，不引 url_launcher。
library;

import 'package:flutter/services.dart';

abstract final class UrlLauncher {
  static const MethodChannel _channel = MethodChannel('short_sentence/url_launcher');

  /// 用系统浏览器打开 [url]。返回 false 表示没有可处理的应用（Dart 侧据此降级提示）。
  static Future<bool> open(String url) async {
    if (url.trim().isEmpty) return false;
    try {
      final result = await _channel.invokeMethod<bool>('open', <String, dynamic>{'url': url});
      return result ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      // 桥没注册（如某些测试环境）时也视为失败
      return false;
    }
  }
}
