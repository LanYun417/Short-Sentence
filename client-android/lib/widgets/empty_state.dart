/// 空态 / 错误态：一个柔和的图标圆、说明与主操作。
///
/// 统一到一处的原因：三端（刷题、语句库、成长）失败时的观感必须一致——
/// 各自写一套就会出现「这一页是灰字居左、那一页是居中大图标」。
library;

import 'package:flutter/material.dart';

import '../theme/palette.dart';
import 'press_scale.dart';
import 'staggered.dart';

/// 空态。
class EmptyState extends StatelessWidget {
  const EmptyState({
    required this.title,
    this.message,
    this.icon = Icons.cloud_off_rounded,
    this.actionLabel,
    this.onAction,
    this.tone = EmptyTone.neutral,
    this.compact = false,
    super.key,
  });

  final String title;
  final String? message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;
  final EmptyTone tone;

  /// 紧凑版（嵌在卡片里用）。
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final accent = switch (tone) {
      EmptyTone.neutral => colors.inkSoft,
      EmptyTone.error => colors.danger,
      EmptyTone.brand => colors.brand,
    };
    final content = Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Container(
          width: compact ? 56 : 76,
          height: compact ? 56 : 76,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: accent.withValues(alpha: 0.08),
            border: Border.all(color: accent.withValues(alpha: 0.16)),
          ),
          child: Icon(icon, size: compact ? 26 : 34, color: accent),
        ),
        SizedBox(height: compact ? 12 : 18),
        Text(
          title,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        if (message != null) ...<Widget>[
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Text(
              message!,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: colors.inkSoft,
                    height: 1.5,
                  ),
            ),
          ),
        ],
        if (actionLabel != null && onAction != null) ...<Widget>[
          SizedBox(height: compact ? 14 : 20),
          PressScale(
            onTap: onAction,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
              decoration: BoxDecoration(
                color: colors.brand.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Icon(Icons.refresh_rounded, size: 17, color: colors.brand),
                  const SizedBox(width: 6),
                  Text(
                    actionLabel!,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: colors.brand,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );

    return StaggeredEntrance(
      child: Center(
        child: Padding(
          padding: EdgeInsets.all(compact ? 16 : 32),
          child: content,
        ),
      ),
    );
  }
}

/// 空态语气。
enum EmptyTone { neutral, error, brand }
