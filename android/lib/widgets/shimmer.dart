/// 骨架占位：一条从左向右扫过的微光。
///
/// 自绘而不用 shimmer 包：只为一个渐变扫光引入依赖不划算，
/// 而且这里需要和主题色板联动（亮色用浅灰、暗色用深蓝灰）。
library;

import 'package:flutter/material.dart';

import '../theme/motion.dart';
import '../theme/palette.dart';

/// 微光条。
class ShimmerBox extends StatefulWidget {
  const ShimmerBox({
    this.height = 16,
    this.width,
    this.radius = 12,
    this.animate = true,
    super.key,
  });

  final double height;
  final double? width;
  final double radius;

  /// 关掉动画（测试或静态占位用）。
  final bool animate;

  @override
  State<ShimmerBox> createState() => _ShimmerBoxState();
}

class _ShimmerBoxState extends State<ShimmerBox> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  @override
  void initState() {
    super.initState();
    if (widget.animate && Motion.loopAnimations) {
      _controller.repeat();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // 系统要求减弱动效：停掉循环，只留静态底色
    if (Motion.reduced(context) && _controller.isAnimating) {
      _controller.stop();
      _controller.value = 0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final base = colors.cardMuted;
    final highlight = Color.alphaBlend(colors.card.withValues(alpha: 0.7), base);

    Widget box(double t) => Container(
          height: widget.height,
          width: widget.width,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.radius),
            gradient: LinearGradient(
              colors: <Color>[base, highlight, base],
              stops: const <double>[0.2, 0.5, 0.8],
              transform: _SlidingGradient(t),
            ),
          ),
        );

    if (!widget.animate || Motion.reduced(context)) {
      return box(0);
    }
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => box(_controller.value),
    );
  }
}

/// 让渐变沿 X 轴滑过自身宽度。
class _SlidingGradient extends GradientTransform {
  const _SlidingGradient(this.t);

  final double t;

  @override
  Matrix4 transform(Rect bounds, {TextDirection? textDirection}) {
    return Matrix4.translationValues(bounds.width * (t * 2 - 1), 0, 0);
  }
}
