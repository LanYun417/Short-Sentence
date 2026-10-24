/// 语义色板：把「画布、卡面、主次文、成功失败金」从 Material 的角色色里分出来。
///
/// 为什么不用 `ColorScheme` 直接凑：M3 的 `surfaceContainer*` 是按
/// 「高度层」推导的灰调，和本项目「浅底 + 纯白卡 + 品牌色点缀」的取向不同——
/// 直接用会出现卡片发灰、成功色偏青的问题。这里显式定一套，
/// 通过 [ThemeExtension] 挂在主题上，亮暗各一份。
library;

import 'package:flutter/material.dart';

/// 语义色板。
@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.canvas,
    required this.canvasTint,
    required this.card,
    required this.cardMuted,
    required this.ink,
    required this.inkSoft,
    required this.inkFaint,
    required this.line,
    required this.brand,
    required this.success,
    required this.danger,
    required this.gold,
    required this.shadow,
  });

  /// 页面底色。
  final Color canvas;

  /// 页面底色的品牌色雾（顶部渐隐用）。
  final Color canvasTint;

  /// 卡片 / 弹窗底色。
  final Color card;

  /// 卡片内的次级底色（题干块、输入框）。
  final Color cardMuted;

  /// 主文字。
  final Color ink;

  /// 次要文字。
  final Color inkSoft;

  /// 更弱的辅助文字（占位、时间戳）。
  final Color inkFaint;

  /// 描边。
  final Color line;

  /// 品牌主色。
  final Color brand;

  /// 成功（答对、已解锁）。
  final Color success;

  /// 失败 / 危险（答错、删除）。
  final Color danger;

  /// 金（达标、连续打卡、句签）。
  final Color gold;

  /// 阴影基色（带透明度直接用）。
  final Color shadow;

  /// 亮色。
  static const AppColors light = AppColors(
    canvas: Color(0xFFF5F7FB),
    canvasTint: Color(0xFFE8F1FE),
    card: Color(0xFFFFFFFF),
    cardMuted: Color(0xFFF2F5FA),
    ink: Color(0xFF0F172A),
    inkSoft: Color(0xFF64748B),
    inkFaint: Color(0xFF94A3B8),
    line: Color(0xFFE2E8F0),
    brand: Color(0xFF0EA5E9),
    success: Color(0xFF10B981),
    danger: Color(0xFFF43F5E),
    gold: Color(0xFFF59E0B),
    shadow: Color(0x1A0F172A),
  );

  /// 暗色。
  static const AppColors dark = AppColors(
    canvas: Color(0xFF0A0E1A),
    canvasTint: Color(0xFF101A33),
    card: Color(0xFF141A2A),
    cardMuted: Color(0xFF1C2336),
    ink: Color(0xFFE8EDF7),
    inkSoft: Color(0xFF98A5BC),
    inkFaint: Color(0xFF6B7891),
    line: Color(0xFF26304A),
    brand: Color(0xFF38BDF8),
    success: Color(0xFF34D399),
    danger: Color(0xFFFB7185),
    gold: Color(0xFFFBBF24),
    shadow: Color(0x66000000),
  );

  @override
  AppColors copyWith({
    Color? canvas,
    Color? canvasTint,
    Color? card,
    Color? cardMuted,
    Color? ink,
    Color? inkSoft,
    Color? inkFaint,
    Color? line,
    Color? brand,
    Color? success,
    Color? danger,
    Color? gold,
    Color? shadow,
  }) {
    return AppColors(
      canvas: canvas ?? this.canvas,
      canvasTint: canvasTint ?? this.canvasTint,
      card: card ?? this.card,
      cardMuted: cardMuted ?? this.cardMuted,
      ink: ink ?? this.ink,
      inkSoft: inkSoft ?? this.inkSoft,
      inkFaint: inkFaint ?? this.inkFaint,
      line: line ?? this.line,
      brand: brand ?? this.brand,
      success: success ?? this.success,
      danger: danger ?? this.danger,
      gold: gold ?? this.gold,
      shadow: shadow ?? this.shadow,
    );
  }

  @override
  AppColors lerp(covariant AppColors? other, double t) {
    if (other == null) {
      return this;
    }
    return AppColors(
      canvas: Color.lerp(canvas, other.canvas, t)!,
      canvasTint: Color.lerp(canvasTint, other.canvasTint, t)!,
      card: Color.lerp(card, other.card, t)!,
      cardMuted: Color.lerp(cardMuted, other.cardMuted, t)!,
      ink: Color.lerp(ink, other.ink, t)!,
      inkSoft: Color.lerp(inkSoft, other.inkSoft, t)!,
      inkFaint: Color.lerp(inkFaint, other.inkFaint, t)!,
      line: Color.lerp(line, other.line, t)!,
      brand: Color.lerp(brand, other.brand, t)!,
      success: Color.lerp(success, other.success, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      gold: Color.lerp(gold, other.gold, t)!,
      shadow: Color.lerp(shadow, other.shadow, t)!,
    );
  }
}

/// 取语义色板的语法糖：`context.colors.card`。
extension AppColorsX on BuildContext {
  AppColors get colors => Theme.of(this).extension<AppColors>() ?? AppColors.light;
}
