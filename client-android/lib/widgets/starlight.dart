/// 星光层：在流体极光（AuroraBackground）之上散布会呼吸闪烁的白色星点。
///
/// 与 AuroraBackground 同思路（径向柔光、GPU 友好、循环动画受 Motion 门控），
/// 区别在于这里画的是离散小星点而非大光斑——叠在极光上即「星光流体渐变」。
/// 星点位置用黄金角确定性散布，避免刷新/重建时乱跳；减弱动效时停在第一帧（常亮微亮）。
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/motion.dart';

/// 星光叠层（自带透明背景，叠在 AuroraBackground 上层）。
class StarlightOverlay extends StatefulWidget {
  const StarlightOverlay({this.count = 18, super.key});

  /// 星点数量。
  final int count;

  @override
  State<StarlightOverlay> createState() => _StarlightOverlayState();
}

class _StarlightOverlayState extends State<StarlightOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 4),
  );

  // 每颗星的相位（错开闪烁）与位置（黄金角散布，确定性）
  late final List<double> _phases = List<double>.generate(
    widget.count,
    (i) => (i * 2.3999632) % (math.pi * 2),
  );
  late final List<Offset> _positions = List<Offset>.generate(
    widget.count,
    (i) {
      final a = i * 2.3999632;
      final r = 0.1 + ((i * 0.137) % 1) * 0.72;
      return Offset(0.5 + math.cos(a) * r * 0.92, 0.5 + math.sin(a) * r * 0.82);
    },
  );

  @override
  void initState() {
    super.initState();
    if (Motion.loopAnimations) {
      _controller.repeat();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // 减弱动效：停在第一帧（星点常亮，只是不闪）
    if (Motion.reduced(context)) {
      _controller.stop();
    } else if (Motion.loopAnimations && !_controller.isAnimating) {
      _controller.repeat();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final t = _controller.value * math.pi * 2;
        return Stack(
          children: <Widget>[
            for (var i = 0; i < widget.count; i++) _star(i, t),
          ],
        );
      },
    );
  }

  Widget _star(int i, double t) {
    final phase = _phases[i];
    final pos = _positions[i];
    // 闪烁亮度 0.25~1，叠加确定性相位
    final twinkle = 0.25 + 0.75 * (0.5 + 0.5 * math.sin(t + phase));
    final size = 1.6 + (i % 3) * 0.7;
    return Align(
      alignment: Alignment(pos.dx * 2 - 1, pos.dy * 2 - 1),
      child: Opacity(
        opacity: Motion.reduced(context) ? 0.6 : twinkle,
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white,
            boxShadow: <BoxShadow>[
              BoxShadow(
                color: Colors.white.withValues(alpha: 0.85),
                blurRadius: size + 1.5,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
