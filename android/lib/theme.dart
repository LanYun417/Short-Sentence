/// 品牌主题（与 Web 端 `client/` 的视觉约定同源）。
///
/// 品牌渐变统一为 `sky-500 → indigo-600 → violet-600`，
/// 见 Web 端 main.css / 组件里的 `bg-linear-to-br from-sky-500 to-indigo-600`。
/// 这里用 Material 3 的 ColorScheme.fromSeed 生成协调色板，
/// 主色锚定 brand 蓝（sky-600 附近的 #0284c7），暗色模式跟随系统。
library;

import 'package:flutter/material.dart';

/// 主品牌色（sky-600）。
const Color brandColor = Color(0xFF0284C7);

/// 渐变起点（sky-500）/ 中点（indigo-600）/ 终点（violet-600）。
const Color brandGradientStart = Color(0xFF0EA5E9);
const Color brandGradientMid = Color(0xFF4F46E5);
const Color brandGradientEnd = Color(0xFF7C3AED);

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
  final scheme = ColorScheme.fromSeed(
    seedColor: brandColor,
    brightness: brightness,
  );
  return ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    appBarTheme: AppBarTheme(
      centerTitle: true,
      elevation: 0,
      backgroundColor: scheme.surface,
      foregroundColor: scheme.onSurface,
    ),
    // 输入框统一圆角与填充风格（与 Web 端 UInput 的观感对齐）
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: scheme.surfaceContainerHighest.withValues(alpha: 0.4),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: brandColor, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    ),
    // 主按钮（登录/注册提交）
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
  );
}
