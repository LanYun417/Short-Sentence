/// 渐变主按钮：品牌渐变 + 按下回弹 + 载入态。
///
/// 不用 `FilledButton` 直接上渐变的原因：`FilledButton` 的背景是
/// `WidgetStateProperty<Color>`，塞渐变要绕 `Ink`，水波纹还会盖住渐变。
/// 这里自绘容器，视觉可控，按压手感也更「实」。
library;

import 'package:flutter/material.dart';

import '../theme.dart';
import 'press_scale.dart';

class GradientButton extends StatelessWidget {
  const GradientButton({
    required this.label,
    required this.onPressed,
    this.icon,
    this.loading = false,
    this.height = 52,
    this.gradient = brandGradient,
    this.expand = true,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool loading;
  final double height;
  final Gradient gradient;

  /// 是否撑满可用宽度。
  final bool expand;

  bool get _enabled => onPressed != null && !loading;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final foreground = _enabled ? Colors.white : colors.inkFaint;

    final button = AnimatedContainer(
      duration: Motion.fast,
      height: height,
      padding: expand ? null : const EdgeInsets.symmetric(horizontal: 22),
      decoration: BoxDecoration(
        gradient: _enabled ? gradient : null,
        color: _enabled ? null : colors.cardMuted,
        borderRadius: BorderRadius.circular(16),
        boxShadow: _enabled
            ? <BoxShadow>[
                BoxShadow(
                  color: const Color(0xFF6366F1).withValues(alpha: 0.3),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ]
            : null,
      ),
      child: Row(
        mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          if (loading)
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
            )
          else ...<Widget>[
            if (icon != null) ...<Widget>[
              Icon(icon, size: 18, color: foreground),
              const SizedBox(width: 7),
            ],
            Text(
              label,
              style: TextStyle(
                color: foreground,
                fontSize: 16,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.3,
              ),
            ),
          ],
        ],
      ),
    );

    return PressScale(
      onTap: _enabled ? onPressed : null,
      haptic: true,
      scale: 0.97,
      child: button,
    );
  }
}
