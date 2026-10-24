/// 主题：品牌色、文字层级、组件默认样式与页面转场。
///
/// 设计取向（见 `docs/android-app-规范.md`）：浅底 + 纯白卡 + 品牌渐变点缀。
/// 因此 `ColorScheme.surface` 取**画布色**（页面底色），卡片一律用
/// [AppColors.card] 显式上色——不依赖 M3 的 elevation tint，
/// 否则卡片会随高度渐变成灰，失去「白纸叠在浅底上」的清爽感。
library;

import 'package:flutter/material.dart';

import 'theme/motion.dart';
import 'theme/palette.dart';

export 'theme/brand.dart';
export 'theme/motion.dart';
export 'theme/palette.dart';

/// 主品牌色（sky-600）。
const Color brandColor = Color(0xFF0284C7);

/// 渐变起点（sky-500）/ 中点（indigo-500）/ 终点（violet-500）。
const Color brandGradientStart = Color(0xFF0EA5E9);
const Color brandGradientMid = Color(0xFF6366F1);
const Color brandGradientEnd = Color(0xFF8B5CF6);

/// 品牌渐变（Hero / Logo / 强调位）。
const LinearGradient brandGradient = LinearGradient(
  colors: <Color>[brandGradientStart, brandGradientMid, brandGradientEnd],
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
);

/// 亮色主题。
final ThemeData lightTheme = _build(Brightness.light);

/// 暗色主题。
final ThemeData darkTheme = _build(Brightness.dark);

ThemeData _build(Brightness brightness) {
  final colors = brightness == Brightness.light ? AppColors.light : AppColors.dark;
  final dark = brightness == Brightness.dark;

  final seed = ColorScheme.fromSeed(seedColor: brandColor, brightness: brightness);
  final scheme = seed.copyWith(
    primary: colors.brand,
    onPrimary: dark ? const Color(0xFF04222F) : Colors.white,
    primaryContainer: dark ? const Color(0xFF0B3A52) : const Color(0xFFE0F2FE),
    onPrimaryContainer: dark ? const Color(0xFFBAE6FD) : const Color(0xFF075985),
    secondary: const Color(0xFF6366F1),
    surface: colors.canvas,
    onSurface: colors.ink,
    onSurfaceVariant: colors.inkSoft,
    surfaceContainerLowest: colors.canvas,
    surfaceContainerLow: colors.card,
    surfaceContainer: colors.card,
    surfaceContainerHigh: colors.cardMuted,
    surfaceContainerHighest: colors.cardMuted,
    outline: colors.inkFaint,
    outlineVariant: colors.line,
    error: colors.danger,
    onError: Colors.white,
    shadow: colors.shadow,
  );

  final base = ThemeData(colorScheme: scheme, useMaterial3: true, brightness: brightness);

  return base.copyWith(
    scaffoldBackgroundColor: colors.canvas,
    extensions: <ThemeExtension<dynamic>>[colors],
    textTheme: _textTheme(base.textTheme, colors),
    appBarTheme: AppBarTheme(
      centerTitle: false,
      elevation: 0,
      scrolledUnderElevation: 0,
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      foregroundColor: colors.ink,
      titleTextStyle: TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.2,
        color: colors.ink,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: colors.cardMuted,
      hintStyle: TextStyle(color: colors.inkFaint, fontSize: 15),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: colors.line, width: 1),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: colors.brand, width: 1.6),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, letterSpacing: 0.2),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: colors.brand,
        textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: colors.ink,
        side: BorderSide(color: colors.line),
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    iconTheme: IconThemeData(color: colors.inkSoft, size: 22),
    dividerTheme: DividerThemeData(color: colors.line, thickness: 1, space: 1),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: colors.card,
      surfaceTintColor: Colors.transparent,
      modalBackgroundColor: colors.card,
      showDragHandle: true,
      dragHandleColor: colors.line,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: colors.card,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: dark ? const Color(0xFF25304A) : const Color(0xFF1E293B),
      contentTextStyle: const TextStyle(color: Colors.white, fontSize: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      insetPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: colors.cardMuted,
      side: BorderSide.none,
      labelStyle: TextStyle(color: colors.ink, fontSize: 14, fontWeight: FontWeight.w500),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: colors.brand,
      linearTrackColor: colors.cardMuted,
      circularTrackColor: colors.cardMuted,
    ),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: <TargetPlatform, PageTransitionsBuilder>{
        TargetPlatform.android: _SoftSlideTransitionBuilder(),
        TargetPlatform.iOS: _SoftSlideTransitionBuilder(),
      },
    ),
  );
}

/// 文字层级：标题收紧字距、正文放宽行高（中文竖排感更松快）。
TextTheme _textTheme(TextTheme base, AppColors colors) {
  return base.copyWith(
    displaySmall: base.displaySmall?.copyWith(
      fontWeight: FontWeight.w700,
      letterSpacing: -1,
      color: colors.ink,
    ),
    headlineMedium: base.headlineMedium?.copyWith(
      fontWeight: FontWeight.w700,
      letterSpacing: -0.6,
      color: colors.ink,
    ),
    headlineSmall: base.headlineSmall?.copyWith(
      fontWeight: FontWeight.w700,
      letterSpacing: -0.4,
      color: colors.ink,
    ),
    titleLarge: base.titleLarge?.copyWith(
      fontWeight: FontWeight.w700,
      letterSpacing: -0.3,
      color: colors.ink,
    ),
    titleMedium: base.titleMedium?.copyWith(
      fontWeight: FontWeight.w600,
      color: colors.ink,
    ),
    titleSmall: base.titleSmall?.copyWith(
      fontWeight: FontWeight.w600,
      color: colors.ink,
    ),
    bodyLarge: base.bodyLarge?.copyWith(height: 1.5, color: colors.ink),
    bodyMedium: base.bodyMedium?.copyWith(height: 1.45, color: colors.ink),
    bodySmall: base.bodySmall?.copyWith(height: 1.4, color: colors.inkSoft),
    labelLarge: base.labelLarge?.copyWith(fontWeight: FontWeight.w600),
    labelMedium: base.labelMedium?.copyWith(
      fontWeight: FontWeight.w500,
      color: colors.inkSoft,
    ),
    labelSmall: base.labelSmall?.copyWith(
      fontWeight: FontWeight.w500,
      color: colors.inkSoft,
      letterSpacing: 0.1,
    ),
  );
}

/// 页面转场：右侧滑入 24px + 淡入；返回时反向。
///
/// 不用 Material 默认的「整页从底部升起」——在四 Tab + 弹窗的结构里，
/// 纵向位移会和底栏争夺注意力；横向位移更符合「进入下一层」的直觉。
class _SoftSlideTransitionBuilder extends PageTransitionsBuilder {
  const _SoftSlideTransitionBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final curved = CurvedAnimation(
      parent: animation,
      curve: Motion.decelerate,
      reverseCurve: Motion.accelerate,
    );
    return SlideTransition(
      position: Tween<Offset>(
        begin: const Offset(0.06, 0),
        end: Offset.zero,
      ).animate(curved),
      child: FadeTransition(opacity: curved, child: child),
    );
  }
}
