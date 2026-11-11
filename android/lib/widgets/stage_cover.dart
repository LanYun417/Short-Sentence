/// 闯关封面：有封面图用 cover 填充；没有则用品牌渐变 + 场景图标兜底。
///
/// 三端统一：后端存的封面是 AI 生成的 2D 扁平卡通风，`fit: cover` 铺满即可；
/// 未生成封面时回落到「品牌渐变 + lucide 图标」，与 Web 端行为一致。
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../api/auth_api.dart' show staticUrl;
import '../theme.dart';
import '../theme/icon_map.dart' show appIcon;

class StageCover extends StatelessWidget {
  const StageCover({
    required this.coverUrl,
    this.icon,
    this.fit = BoxFit.cover,
    super.key,
  });

  final String? coverUrl;
  final String? icon;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final url = staticUrl(coverUrl);
    if (url.isNotEmpty) {
      return CachedNetworkImage(
        imageUrl: url,
        fit: fit,
        memCacheWidth: 720,
        fadeInDuration: const Duration(milliseconds: 220),
      );
    }
    return Container(
      decoration: const BoxDecoration(gradient: brandGradient),
      child: Center(
        child: Icon(appIcon(icon), size: 36, color: Colors.white70),
      ),
    );
  }
}
