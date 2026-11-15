/// 导出数据文件分享：复用句签海报的 `short_sentence/share` 原生桥。
///
/// 项目「零新增运行时依赖」：不引 share_plus / path_provider。桥把 JSON 字节写进
/// cacheDir 并经 FileProvider 生成受临时读权限保护的 content:// URI，调起系统选择器，
/// 用户可「保存到文件」、发到微信或邮箱。
library;

import 'dart:typed_data';

import 'package:flutter/services.dart';

abstract final class ExportShare {
  static const MethodChannel _channel = MethodChannel('short_sentence/share');

  /// 把 JSON 字节交给系统分享；返回 false 表示桥不可用或系统没有可处理的应用。
  static Future<bool> shareJson(Uint8List bytes, String fileName) async {
    try {
      await _channel.invokeMethod<void>('shareFile', <String, dynamic>{
        'bytes': bytes,
        'fileName': fileName,
        'mimeType': 'application/json',
      });
      return true;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }
}
