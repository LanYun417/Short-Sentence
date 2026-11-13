/// 卡片与区块标题：统一圆角、双层阴影与内边距。
///
/// 双层阴影（贴边 1px + 散开 12px）比单层大阴影干净：
/// 单层大阴影会让白卡边缘发灰、叠在一起时糊成一片。
library;

import 'package:flutter/material.dart';

import '../theme.dart';
import 'press_scale.dart';
import 'staggered.dart';

/// 标准卡片。
class AppCard extends StatelessWidget {
  const AppCard({
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.radius = 24,
    this.onTap,
    this.gradient,
    this.color,
    this.bordered = true,
    this.elevated = true,
    this.clip = false,
    super.key,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final VoidCallback? onTap;

  /// 渐变底（给 Hero / 身份卡用；此时忽略 [color] 与描边）。
  final Gradient? gradient;

  final Color? color;
  final bool bordered;
  final bool elevated;

  /// 是否按圆角裁剪子元素。
  ///
  /// 默认关闭：`borderRadius` 只影响背景与边框的绘制，不裁 child；
  /// 多数卡片的子元素本就内缩在 padding 内，不需要裁。但**有贴边子元素**时
  /// （如 ExpansionTile 展开、铺满顶部的图片）必须开启，否则子元素的直角
  /// 会盖住卡片圆角，出现「灰色直角」。
  final bool clip;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final decorated = AnimatedContainer(
      duration: Motion.reduced(context) ? Duration.zero : Motion.normal,
      curve: Motion.standard,
      padding: padding,
      clipBehavior: clip ? Clip.antiAlias : Clip.none,
      decoration: BoxDecoration(
        color: gradient == null ? (color ?? colors.card) : null,
        gradient: gradient,
        borderRadius: BorderRadius.circular(radius),
        border: bordered && gradient == null
            ? Border.all(color: colors.line.withValues(alpha: 0.7))
            : null,
        boxShadow: elevated && gradient == null
            ? <BoxShadow>[
                BoxShadow(
                  color: colors.shadow.withValues(alpha: 0.05),
                  blurRadius: 2,
                  offset: const Offset(0, 1),
                ),
                BoxShadow(
                  color: colors.shadow.withValues(alpha: 0.07),
                  blurRadius: 28,
                  offset: const Offset(0, 12),
                ),
              ]
            : null,
      ),
      child: child,
    );

    if (onTap == null) {
      return decorated;
    }
    return PressScale(onTap: onTap, scale: 0.985, child: decorated);
  }
}

/// 渐变卡片（品牌底色，白字）。
class GradientCard extends StatelessWidget {
  const GradientCard({
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.radius = 26,
    this.gradient = brandGradient,
    this.onTap,
    this.shadow,
    super.key,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final Gradient gradient;
  final VoidCallback? onTap;
  final Color? shadow;

  @override
  Widget build(BuildContext context) {
    final decorated = Container(
      padding: padding,
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(radius),
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: (shadow ?? const Color(0xFF6366F1)).withValues(alpha: 0.28),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: child,
    );
    if (onTap == null) {
      return decorated;
    }
    return PressScale(onTap: onTap, scale: 0.985, child: decorated);
  }
}

/// 区块标题（左侧标题 + 可选说明 + 右侧动作）。
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
    this.icon,
    this.index = 0,
    super.key,
  });

  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;
  final IconData? icon;

  /// 参与父级错峰时的序号。
  final int index;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return StaggeredEntrance(
      index: index,
      offset: const Offset(0, 8),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(4, 4, 4, 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: <Widget>[
            if (icon != null) ...<Widget>[
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: colors.brand.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 17, color: colors.brand),
              ),
              const SizedBox(width: 10),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(title, style: Theme.of(context).textTheme.titleMedium),
                  if (subtitle != null) ...<Widget>[
                    const SizedBox(height: 2),
                    Text(
                      subtitle!,
                      style: Theme.of(context).textTheme.labelSmall
                          ?.copyWith(color: colors.inkFaint),
                    ),
                  ],
                ],
              ),
            ),
            if (actionLabel != null && onAction != null)
              TextButton(
                onPressed: onAction,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Text(actionLabel!),
                    const SizedBox(width: 2),
                    const Icon(Icons.chevron_right_rounded, size: 18),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// 小标签。
class Pill extends StatelessWidget {
  const Pill({
    required this.label,
    this.foreground,
    this.background,
    this.icon,
    super.key,
  });

  final String label;
  final Color? foreground;
  final Color? background;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final fg = foreground ?? colors.inkSoft;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: background ?? colors.cardMuted,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (icon != null) ...<Widget>[
            Icon(icon, size: 12, color: fg),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: fg,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}
