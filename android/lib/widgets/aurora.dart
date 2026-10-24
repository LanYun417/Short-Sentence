/// 极光背景：几团柔光在渐变上缓慢漂移。
///
/// 用径向渐变画柔光而不是 `ImageFilter.blur`：
/// 模糊滤镜在滚动时会反复重绘整层（掉帧），径向渐变由 GPU 直接插值，成本低得多。
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/motion.dart';

/// 极光背景（自带渐变底）。
class AuroraBackground extends StatefulWidget {
  const AuroraBackground({
    required this.gradient,
    this.child,
    this.blobColor = Colors.white,
    this.intensity = 0.22,
    super.key,
  });

  final Gradient gradient;
  final Widget? child;
  final Color blobColor;
  final double intensity;

  @override
  State<AuroraBackground> createState() => _AuroraBackgroundState();
}

class _AuroraBackgroundState extends State<AuroraBackground>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 18),
  );

  @override
  void initState() {
    super.initState();
    if (Motion.loopAnimations) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // 减弱动效：停在第一帧（静态柔光仍然好看，只是不漂）
    if (Motion.reduced(context)) {
      _controller.stop();
    } else if (Motion.loopAnimations && !_controller.isAnimating) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(gradient: widget.gradient),
      child: ClipRect(
        child: Stack(
          children: <Widget>[
            Positioned.fill(
              child: AnimatedBuilder(
                animation: _controller,
                builder: (context, _) {
                  final t = _controller.value;
                  return Stack(
                    children: <Widget>[
                      _blob(
                        alignment: Alignment(
                          -0.9 + 0.5 * math.sin(t * math.pi * 2),
                          -1.1 + 0.3 * math.cos(t * math.pi * 2),
                        ),
                        size: 190,
                        opacity: widget.intensity,
                      ),
                      _blob(
                        alignment: Alignment(
                          1.0 - 0.4 * math.cos(t * math.pi * 2 + 1.2),
                          1.2 - 0.4 * math.sin(t * math.pi * 1.6),
                        ),
                        size: 240,
                        opacity: widget.intensity * 0.72,
                      ),
                      _blob(
                        alignment: Alignment(
                          0.2 + 0.6 * math.sin(t * math.pi * 1.4 + 2.4),
                          -0.2 + 0.7 * math.cos(t * math.pi * 1.2),
                        ),
                        size: 130,
                        opacity: widget.intensity * 0.55,
                      ),
                    ],
                  );
                },
              ),
            ),
            if (widget.child != null) widget.child!,
          ],
        ),
      ),
    );
  }

  Widget _blob({
    required Alignment alignment,
    required double size,
    required double opacity,
  }) {
    return Align(
      alignment: alignment,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: <Color>[
              widget.blobColor.withValues(alpha: opacity),
              widget.blobColor.withValues(alpha: 0),
            ],
            stops: const <double>[0, 1],
          ),
        ),
      ),
    );
  }
}
