/// 达标庆祝：彩带从顶部散落 + 一句短提示。
///
/// 自绘（CustomPainter + 单控制器），不引第三方礼花包：
/// 只用一个动画驱动全部粒子，滚动/翻卡时不会额外占帧。
///
/// 只播一次、2.4 秒自动收场——庆祝是「确认」，不是让人看的演出。
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/motion.dart';
import '../theme/palette.dart';

/// 弹一次庆祝层（无 [Overlay] 时静默跳过）。
Future<void> showCelebration(
  BuildContext context, {
  String title = '今日目标达成',
  String? subtitle,
}) async {
  if (Motion.reduced(context)) {
    return;
  }
  final overlay = Overlay.maybeOf(context, rootOverlay: true);
  if (overlay == null) {
    return;
  }

  final done = Completer<void>();
  late OverlayEntry entry;
  entry = OverlayEntry(
    builder: (context) => _CelebrationLayer(
      title: title,
      subtitle: subtitle,
      onDone: () {
        if (entry.mounted) {
          entry.remove();
        }
        if (!done.isCompleted) {
          done.complete();
        }
      },
    ),
  );
  overlay.insert(entry);
  return done.future;
}

class _CelebrationLayer extends StatefulWidget {
  const _CelebrationLayer({
    required this.title,
    required this.subtitle,
    required this.onDone,
  });

  final String title;
  final String? subtitle;
  final VoidCallback onDone;

  @override
  State<_CelebrationLayer> createState() => _CelebrationLayerState();
}

class _CelebrationLayerState extends State<_CelebrationLayer>
    with SingleTickerProviderStateMixin {
  static const Duration _duration = Duration(milliseconds: 2400);

  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: _duration,
  );

  late final List<_Confetti> _pieces = _buildPieces();

  @override
  void initState() {
    super.initState();
    _controller.forward().whenComplete(widget.onDone);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  List<_Confetti> _buildPieces() {
    const palette = <Color>[
      Color(0xFF0EA5E9),
      Color(0xFF6366F1),
      Color(0xFF8B5CF6),
      Color(0xFFFBBF24),
      Color(0xFF34D399),
      Color(0xFFF472B6),
    ];
    final random = math.Random(20261024);
    return List<_Confetti>.generate(64, (index) {
      return _Confetti(
        x: random.nextDouble(),
        // 顶部起落，速度差制造层次
        delay: random.nextDouble() * 0.35,
        fall: 0.55 + random.nextDouble() * 0.45,
        drift: (random.nextDouble() - 0.5) * 0.35,
        size: 5 + random.nextDouble() * 6,
        spin: (random.nextDouble() - 0.5) * 10,
        color: palette[index % palette.length],
        circle: index % 5 == 0,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.paddingOf(context).top;
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          final t = _controller.value;
          // 提示条：前 12% 弹入，最后 20% 淡出
          final banner = _bannerOpacity(t);
          return Material(
            color: Colors.transparent,
            child: Stack(
              children: <Widget>[
                Positioned.fill(
                  child: CustomPaint(painter: _ConfettiPainter(pieces: _pieces, t: t)),
                ),
                Positioned(
                  top: topInset + 18,
                  left: 0,
                  right: 0,
                  child: Opacity(
                    opacity: banner,
                    child: Transform.scale(
                      scale: 0.92 + 0.08 * _bannerScale(t),
                      child: Center(child: _Banner(title: widget.title, subtitle: widget.subtitle)),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  double _bannerOpacity(double t) {
    if (t < 0.08) {
      return t / 0.08;
    }
    if (t > 0.8) {
      return (1 - t) / 0.2;
    }
    return 1;
  }

  double _bannerScale(double t) {
    if (t < 0.16) {
      return Motion.spring.transform((t / 0.16).clamp(0.0, 1.0));
    }
    return 1;
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.title, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 32),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(20),
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: colors.shadow.withValues(alpha: 0.16),
            blurRadius: 30,
            offset: const Offset(0, 12),
          ),
        ],
        border: Border.all(color: colors.line),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                colors: <Color>[Color(0xFFFBBF24), Color(0xFFF97316)],
              ),
              boxShadow: <BoxShadow>[
                BoxShadow(
                  color: const Color(0xFFF59E0B).withValues(alpha: 0.4),
                  blurRadius: 14,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Icon(Icons.emoji_events_rounded, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Text(
                title,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              if (subtitle != null) ...<Widget>[
                const SizedBox(height: 2),
                Text(
                  subtitle!,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: colors.inkSoft,
                      ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _Confetti {
  const _Confetti({
    required this.x,
    required this.delay,
    required this.fall,
    required this.drift,
    required this.size,
    required this.spin,
    required this.color,
    required this.circle,
  });

  /// 起始横向位置（0~1）。
  final double x;

  /// 起飞延迟（0~1，占全程比例）。
  final double delay;

  /// 下落速度系数。
  final double fall;

  /// 横向漂移。
  final double drift;

  final double size;
  final double spin;
  final Color color;
  final bool circle;
}

class _ConfettiPainter extends CustomPainter {
  _ConfettiPainter({required this.pieces, required this.t});

  final List<_Confetti> pieces;
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint();
    for (final piece in pieces) {
      final local = ((t - piece.delay) / (1 - piece.delay)).clamp(0.0, 1.0);
      if (local <= 0 || local >= 1) {
        continue;
      }
      // 先加速下落，末段淡出
      final eased = Curves.easeInQuad.transform(local);
      final dy = -30 + (size.height + 60) * eased * piece.fall;
      final dx = size.width * piece.x + piece.drift * size.width * local;
      final opacity = local > 0.75 ? (1 - local) / 0.25 : 1.0;
      paint.color = piece.color.withValues(alpha: opacity.clamp(0.0, 1.0));

      canvas.save();
      canvas.translate(dx, dy);
      canvas.rotate(piece.spin * local * math.pi);
      if (piece.circle) {
        canvas.drawCircle(Offset.zero, piece.size / 2, paint);
      } else {
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromCenter(center: Offset.zero, width: piece.size, height: piece.size * 1.6),
            const Radius.circular(1.5),
          ),
          paint,
        );
      }
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _ConfettiPainter oldDelegate) => oldDelegate.t != t;
}
