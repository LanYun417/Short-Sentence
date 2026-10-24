/// 句子详情弹窗（语句库列表点开）。
///
/// 只在需要「细看」时才出现：配图放大、音标、元信息与操作都收在这里，
/// 列表本身保持轻（两行字 + 缩略图），滚动才不会被大图打断。
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../api/auth_api.dart';
import '../api/models/library_item.dart';
import '../theme/motion.dart';
import '../theme/palette.dart';
import '../widgets/app_card.dart';

/// 展示句子详情。
Future<void> showSentenceSheet(
  BuildContext context,
  SentenceLibraryItem item, {
  bool showUnfavorite = false,
  Future<void> Function()? onUnfavorite,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (sheetContext) {
      final colors = sheetContext.colors;
      return Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
        ),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(sheetContext).height * 0.86,
          ),
          child: SingleChildScrollView(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Text(
                    item.sentenceEn,
                    style: Theme.of(sheetContext).textTheme.titleLarge?.copyWith(
                          height: 1.35,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  if (item.ipa != null && item.ipa!.isNotEmpty) ...<Widget>[
                    const SizedBox(height: 6),
                    Text(
                      item.ipa!,
                      style: TextStyle(
                        fontSize: 13,
                        color: colors.brand,
                        fontFamily: 'monospace',
                        letterSpacing: 0.2,
                      ),
                    ),
                  ],
                  const SizedBox(height: 4),
                  Text(
                    item.translationZh,
                    style: Theme.of(sheetContext).textTheme.bodyMedium?.copyWith(
                          color: colors.inkSoft,
                          height: 1.6,
                        ),
                  ),
                  if (item.imageUrl != null && item.imageUrl!.isNotEmpty) ...<Widget>[
                    const SizedBox(height: 16),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(18),
                      child: AspectRatio(
                        aspectRatio: 16 / 9,
                        child: CachedNetworkImage(
                          imageUrl: staticUrl(item.imageUrl),
                          fit: BoxFit.cover,
                          fadeInDuration: Motion.normal,
                          placeholder: (context, _) => Container(color: colors.cardMuted),
                          errorWidget: (context, _, _) => Container(
                            color: colors.cardMuted,
                            child: Icon(Icons.image_not_supported_outlined,
                                color: colors.inkFaint),
                          ),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: <Widget>[
                      Pill(
                        label: '难度 · ${item.difficultyLabel}',
                        background: colors.brand.withValues(alpha: 0.08),
                        foreground: colors.brand,
                      ),
                      if (item.categoryName != null) Pill(label: item.categoryName!),
                      if (item.reviewLevel != null)
                        Pill(label: '已连对 ${item.reviewLevel} 次', icon: Icons.repeat_rounded),
                      if (item.isCorrect != null)
                        Pill(
                          label: item.isCorrect! ? '答对' : '答错',
                          icon: item.isCorrect!
                              ? Icons.check_circle_rounded
                              : Icons.cancel_rounded,
                          foreground: item.isCorrect! ? colors.success : colors.danger,
                          background: (item.isCorrect! ? colors.success : colors.danger)
                              .withValues(alpha: 0.1),
                        ),
                    ],
                  ),
                  if (item.userAnswer != null && item.userAnswer!.trim().isNotEmpty) ...<Widget>[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: colors.cardMuted,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            '你当时的答案',
                            style: Theme.of(sheetContext).textTheme.labelSmall?.copyWith(
                                  color: colors.inkFaint,
                                ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            item.userAnswer!.trim(),
                            style: TextStyle(
                              height: 1.4,
                              color: colors.inkSoft,
                              decoration: item.isCorrect == true
                                  ? null
                                  : TextDecoration.lineThrough,
                              decorationColor: colors.danger,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  if (showUnfavorite) ...<Widget>[
                    const SizedBox(height: 20),
                    OutlinedButton.icon(
                      onPressed: () async {
                        Navigator.of(sheetContext).pop();
                        await onUnfavorite?.call();
                      },
                      icon: const Icon(Icons.star_outline_rounded, size: 18),
                      label: const Text('取消收藏'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: colors.danger,
                        side: BorderSide(color: colors.danger.withValues(alpha: 0.4)),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      );
    },
  );
}
