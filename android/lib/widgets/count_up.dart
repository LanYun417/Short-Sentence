/// 数字滚动：数值变化时从旧值滑到新值，而不是直接跳。
///
/// 用 `TweenAnimationBuilder` 而不是自建控制器：
/// 它会在 `end` 变化时**从当前动画值**继续，天然处理「动画未播完又来新值」，
/// 不必手写补间。
library;

import 'package:flutter/material.dart';

import '../theme/motion.dart';

/// 滚动数字。
class CountUpText extends StatelessWidget {
  const CountUpText({
    required this.value,
    this.style,
    this.duration = Motion.slow,
    this.suffix = '',
    this.prefix = '',
    super.key,
  });

  final int value;
  final TextStyle? style;
  final Duration duration;
  final String suffix;
  final String prefix;

  @override
  Widget build(BuildContext context) {
    final reduce = Motion.reduced(context);
    if (reduce) {
      return Text('$prefix$value$suffix', style: style);
    }
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: value.toDouble()),
      duration: duration,
      curve: Motion.decelerate,
      builder: (context, animated, _) {
        return Text('$prefix${animated.round()}$suffix', style: style);
      },
    );
  }
}
