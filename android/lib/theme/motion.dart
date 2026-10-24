/// 动效令牌：时长、曲线、错峰与「减弱动效」降级。
///
/// 全 App 的动画只从这里取参数，避免各页各写一套魔法数字——
/// 一旦时长散落各处，观感就会「有的地方灵、有的地方黏」。
///
/// 降级策略：系统开启「减弱动效」时，位移/缩放/循环动画的时长归零，
/// 但颜色过渡保留（颜色不是「动」，是状态本身）。
library;

import 'package:flutter/material.dart';

/// 动效令牌。
abstract final class Motion {
  /// 无限循环动画（极光、骨架微光）的总开关。
  ///
  /// Widget 测试必须把它置为 false：循环动画会持续排帧，
  /// `pumpAndSettle` 永远等不到「静止」，用例会以超时失败
  /// （这不是产品缺陷，是测试环境里没有「用户看够了」这回事）。
  static bool loopAnimations = true;

  /// 按压、颜色、图标切换。
  static const Duration fast = Duration(milliseconds: 160);

  /// 卡面内容、Tab 切换、展开收起。
  static const Duration normal = Duration(milliseconds: 260);

  /// 页面进出、Hero 阶段过渡。
  static const Duration slow = Duration(milliseconds: 420);

  /// 翻卡。比 Web 端的 450ms 稍慢：手机上字更大，需要多一点时间看清转动。
  static const Duration flip = Duration(milliseconds: 520);

  /// 默认曲线（Material 3 emphasized）。
  static const Curve standard = Cubic(0.2, 0, 0, 1);

  /// 入场曲线：起手快、收尾慢。
  static const Curve decelerate = Cubic(0.05, 0.7, 0.1, 1);

  /// 弹性曲线（词块、收藏、选中）：轻微过冲，手感更「实」。
  static const Curve spring = Cubic(0.34, 1.56, 0.64, 1);

  /// 退场曲线：起步就快，不让人等。
  static const Curve accelerate = Cubic(0.3, 0, 0.8, 0.15);

  /// 列表错峰的单项间隔。
  static const Duration staggerStep = Duration(milliseconds: 55);

  /// 列表错峰最多延迟到第 6 项，再多就整批一起进（否则最后一项要等半秒）。
  static const int staggerMax = 6;

  /// 第 [index] 项的入场延迟。
  static Duration stagger(int index) {
    final step = index.clamp(0, staggerMax);
    return staggerStep * step;
  }

  /// 系统是否要求减弱动效。
  static bool reduced(BuildContext context) =>
      MediaQuery.maybeOf(context)?.disableAnimations ?? false;

  /// 按系统偏好缩放时长：减弱动效时为 [Duration.zero]。
  static Duration of(BuildContext context, Duration duration) =>
      reduced(context) ? Duration.zero : duration;
}
