/// 语句库列表项：缩略图 + 中英 + 元信息。
///
/// 手机上竖着滚的列表，右侧放操作按钮最容易被误触，
/// 所以这里**整项可点**进详情，取消收藏交给左滑（可撤销）。
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../api/auth_api.dart';
import '../api/models/library_item.dart';
import '../theme/motion.dart';
import '../theme/palette.dart';
import 'app_card.dart';
import 'tts_button.dart';

/// 列表项。
class SentenceTile extends StatelessWidget {
  const SentenceTile({
    required this.item,
    this.showAccuracy = false,
    this.onTap,
    super.key,
  });

  final SentenceLibraryItem item;

  /// 是否展示「对/错」（仅历史分区）。
  final bool showAccuracy;

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final theme = Theme.of(context);

    return RepaintBoundary(
      child: AppCard(
        onTap: onTap,
        padding: const EdgeInsets.all(14),
        radius: 20,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            _Thumb(url: item.imageUrl),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    item.sentenceEn,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleSmall?.copyWith(
                      height: 1.35,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    item.translationZh,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colors.inkSoft,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: <Widget>[
                      Pill(
                        label: item.difficultyLabel,
                        background: colors.brand.withValues(alpha: 0.08),
                        foreground: colors.brand,
                      ),
                      if (item.categoryName != null) ...<Widget>[
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            item.categoryName!,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: colors.inkFaint,
                            ),
                          ),
                        ),
                      ],
                      const Spacer(),
                      if (showAccuracy && item.isCorrect != null)
                        Icon(
                          item.isCorrect!
                              ? Icons.check_circle_rounded
                              : Icons.cancel_rounded,
                          size: 16,
                          color: item.isCorrect!
                              ? colors.success
                              : colors.danger,
                        )
                      else if (item.reviewLevel != null &&
                          item.reviewLevel! > 0)
                        Row(
                          children: <Widget>[
                            Icon(
                              Icons.repeat_rounded,
                              size: 12,
                              color: colors.inkFaint,
                            ),
                            const SizedBox(width: 3),
                            Text(
                              '已连对 ${item.reviewLevel} 次',
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: colors.inkFaint,
                                fontSize: 10.5,
                              ),
                            ),
                          ],
                        )
                      else
                        Text(
                          _dateLabel(item.createdAt),
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: colors.inkFaint,
                            fontSize: 10.5,
                          ),
                        ),
                      const SizedBox(width: 6),
                      // 朗读：列表项里的紧凑图标按钮，不挤占正文
                      SentenceTtsButton(
                        text: item.sentenceEn,
                        lang: 'en-US',
                        compact: true,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _dateLabel(DateTime date) {
    final local = date.toLocal();
    final now = DateTime.now();
    final sameYear = local.year == now.year;
    final month = local.month.toString().padLeft(2, '0');
    final day = local.day.toString().padLeft(2, '0');
    return sameYear ? '$month-$day' : '${local.year}-$month-$day';
  }
}

/// 缩略图：无图时用品牌色渐变占位（不留灰块）。
class _Thumb extends StatelessWidget {
  const _Thumb({required this.url});

  final String? url;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final radius = BorderRadius.circular(14);
    if (url == null || url!.isEmpty) {
      return Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          borderRadius: radius,
          gradient: LinearGradient(
            colors: <Color>[
              colors.brand.withValues(alpha: 0.16),
              const Color(0xFF8B5CF6).withValues(alpha: 0.16),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Icon(
          Icons.chat_bubble_outline_rounded,
          size: 20,
          color: colors.brand,
        ),
      );
    }
    return ClipRRect(
      borderRadius: radius,
      child: CachedNetworkImage(
        imageUrl: staticUrl(url),
        width: 56,
        height: 56,
        fit: BoxFit.cover,
        // 原图 1280px，列表里只显示 56dp：不限制解码尺寸会按原图占内存
        memCacheWidth: 168,
        fadeInDuration: Motion.fast,
        placeholder: (context, _) =>
            Container(width: 56, height: 56, color: colors.cardMuted),
        errorWidget: (context, _, _) => Container(
          width: 56,
          height: 56,
          color: colors.cardMuted,
          child: Icon(
            Icons.image_not_supported_outlined,
            size: 18,
            color: colors.inkFaint,
          ),
        ),
      ),
    );
  }
}
