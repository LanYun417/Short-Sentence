/// 图片选择（原生 SAF 桥，零新增依赖）。
///
/// 通道对应 `ImagePickBridge.kt`（`short_sentence/image_pick`）：
/// 原生用系统 SAF 文件选择器（无需存储权限）选图并读出字节，这里只做
/// 结果解析与后端白名单过滤（不在白名单的 MIME 如 HEIC 直接丢弃）。
library;

import 'package:flutter/services.dart';

/// 一张待上传图片（原生读出的字节与元信息）。
class PickedImage {
  const PickedImage({required this.name, required this.mimeType, required this.bytes});

  /// 原始文件名（后端按扩展名做白名单校验，必须带 .jpg/.png 等后缀）。
  final String name;

  /// MIME 类型（contentResolver.getType 得来）。
  final String mimeType;

  /// 图片内容。
  final Uint8List bytes;
}

const MethodChannel _channel = MethodChannel('short_sentence/image_pick');

/// 后端上传白名单允许的图片 MIME（与 api 的 UPLOAD_ALLOWED_MIME 图片子集一致）。
const Set<String> kAllowedImageMimes = <String>{
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
};

/// 打开系统选择器选图片（最多 [maxCount] 张；取消 / 失败返回空列表）。
Future<List<PickedImage>> pickImages({int maxCount = 5}) async {
  try {
    final dynamic result = await _channel.invokeMethod<dynamic>(
      'pickImages',
      <String, dynamic>{'maxCount': maxCount},
    );
    if (result is! List) {
      return const <PickedImage>[];
    }
    final images = <PickedImage>[];
    for (final item in result) {
      if (item is! Map) {
        continue;
      }
      final mime = item['mimeType'] as String? ?? 'image/jpeg';
      final bytes = item['bytes'];
      // 不在白名单的（HEIC 等）后端会拒，直接丢弃并让用户换格式
      if (!kAllowedImageMimes.contains(mime)) {
        continue;
      }
      if (bytes is! Uint8List || bytes.isEmpty) {
        continue;
      }
      images.add(
        PickedImage(
          name: item['name'] as String? ?? 'image_${images.length}.jpg',
          mimeType: mime,
          bytes: bytes,
        ),
      );
    }
    return images.take(maxCount).toList();
  } on PlatformException {
    // 用户取消是正常路径；通道异常（如低机型 SAF 缺失）也静默为空
    return const <PickedImage>[];
  }
}
