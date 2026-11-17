/// 成就徽章动画：直接解析种子生成的线稿 SVG，用 PathMetrics 做「描边连完」动画。
///
/// 为什么不用 flutter_svg：项目保持零新增运行时依赖；而且 SVG 里的 SMIL 动画
/// flutter_svg 也不会播，自己画才能三端一致。
///
/// 解析器只覆盖我们自己的 SVG 方言：M/m L/l H/h V/v C/c A/a Z/z，
/// 元素只认 `<path d="...">`（种子已把 circle/ellipse/rect 统一转成 path）。
/// 圆弧按 SVG 规范转成圆心参数后采样成折线，112px 徽章位上看不出折角。
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

/// 解析后的徽章：路径 + 描边色（SVG 里写的是 hsl(...)）。
class _BadgeSvg {
  final List<Path> paths;
  final Color color;
  const _BadgeSvg(this.paths, this.color);
}

/// 极简 SVG path 解析器（仅本项目生成的线稿方言）。
class _PathParser {
  static const _token = r'[MmLlHhVvCcAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?';

  static _BadgeSvg parse(String svg) {
    final paths = <Path>[];
    final dValues = RegExp(r'<path d="([^"]+)"').allMatches(svg).map((m) => m.group(1)!).toList();
    for (final d in dValues) {
      paths.add(_parsePath(d));
    }
    final hsl = RegExp(r'stroke="hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)"').firstMatch(svg);
    var color = const Color(0xFF4F46E5);
    if (hsl != null) {
      final h = int.parse(hsl.group(1)!);
      final s = int.parse(hsl.group(2)!) / 100;
      final l = int.parse(hsl.group(3)!) / 100;
      final v = l + s * math.min(l, 1 - l);
      color = HSVColor.fromAHSV(1, h.toDouble(), _hslSaturationToHsv(s, l), v).toColor();
    }
    return _BadgeSvg(paths, color);
  }

  /// HSL → HSV 的饱和度换算：HSV.s = 2 * (1 - L / V)。
  static double _hslSaturationToHsv(double s, double l) {
    final v = l + s * math.min(l, 1 - l);
    return v == 0 ? 0 : 2 * (1 - l / v);
  }

  static Path _parsePath(String d) {
    final tokens = RegExp(_token).allMatches(d).map((m) => m.group(0)!).toList();
    final path = Path();
    var i = 0;
    var cmd = '';
    var x = 0.0;
    var y = 0.0;
    var subX = 0.0;
    var subY = 0.0;
    num number() {
      if (i >= tokens.length) return 0;
      return num.tryParse(tokens[i++]) ?? 0;
    }

    bool isCommand(String t) => t.length == 1 && RegExp(r'[A-Za-z]').hasMatch(t);

    while (i < tokens.length) {
      if (isCommand(tokens[i])) cmd = tokens[i++];
      final upper = cmd.toUpperCase();
      final rel = cmd != upper;
      switch (upper) {
        case 'M':
          x = rel ? x + number().toDouble() : number().toDouble();
          y = rel ? y + number().toDouble() : number().toDouble();
          path.moveTo(x, y);
          subX = x;
          subY = y;
          cmd = rel ? 'l' : 'L'; // 后续坐标对隐式 lineTo
          break;
        case 'L':
          x = rel ? x + number().toDouble() : number().toDouble();
          y = rel ? y + number().toDouble() : number().toDouble();
          path.lineTo(x, y);
          break;
        case 'H':
          x = rel ? x + number().toDouble() : number().toDouble();
          path.lineTo(x, y);
          break;
        case 'V':
          y = rel ? y + number().toDouble() : number().toDouble();
          path.lineTo(x, y);
          break;
        case 'C':
          final c1x = number().toDouble();
          final c1y = number().toDouble();
          final c2x = number().toDouble();
          final c2y = number().toDouble();
          final ex = number().toDouble();
          final ey = number().toDouble();
          if (rel) {
            path.cubicTo(x + c1x, y + c1y, x + c2x, y + c2y, x + ex, y + ey);
            x += ex;
            y += ey;
          } else {
            path.cubicTo(c1x, c1y, c2x, c2y, ex, ey);
            x = ex;
            y = ey;
          }
          break;
        case 'A':
          final rx = number().toDouble();
          final ry = number().toDouble();
          final rotation = number().toDouble() * math.pi / 180;
          final large = number().toInt() == 1;
          final sweep = number().toInt() == 1;
          final ex = number().toDouble();
          final ey = number().toDouble();
          final endX = rel ? x + ex : ex;
          final endY = rel ? y + ey : ey;
          _appendArc(path, x, y, rx, ry, rotation, large, sweep, endX, endY);
          x = endX;
          y = endY;
          break;
        case 'Z':
          path.close();
          x = subX;
          y = subY;
          break;
        default:
          i++; // 不认识的 token 直接跳过，保证不会死循环
      }
    }
    return path;
  }

  /// SVG 椭圆弧 → 圆心参数采样折线（标准 endpoint → center 转换）。
  static void _appendArc(
    Path path,
    double x1,
    double y1,
    double rx,
    double ry,
    double phi,
    bool large,
    bool sweep,
    double x2,
    double y2,
  ) {
    if (rx == 0 || ry == 0 || (x1 == x2 && y1 == y2)) {
      path.lineTo(x2, y2);
      return;
    }
    rx = rx.abs();
    ry = ry.abs();
    final cosPhi = math.cos(phi);
    final sinPhi = math.sin(phi);
    final dx2 = (x1 - x2) / 2;
    final dy2 = (y1 - y2) / 2;
    final x1p = cosPhi * dx2 + sinPhi * dy2;
    final y1p = -sinPhi * dx2 + cosPhi * dy2;
    final radiusScale = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
    if (radiusScale > 1) {
      final s = math.sqrt(radiusScale);
      rx *= s;
      ry *= s;
    }
    final sign = (large == sweep) ? -1.0 : 1.0;
    final num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    final den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    final coef = sign * math.sqrt(math.max(0, num / den));
    final cxp = coef * rx * y1p / ry;
    final cyp = coef * -ry * x1p / rx;
    final cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
    final cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;
    final theta1 = math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx);
    var delta = math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx) - theta1;
    if (sweep && delta < 0) {
      delta += 2 * math.pi;
    } else if (!sweep && delta > 0) {
      delta -= 2 * math.pi;
    }
    final steps = math.max(6, (delta.abs() / (math.pi / 8)).ceil() * 2);
    for (var i = 1; i <= steps; i++) {
      final t = theta1 + delta * i / steps;
      final px = cx + rx * math.cos(t) * cosPhi - ry * math.sin(t) * sinPhi;
      final py = cy + rx * math.cos(t) * sinPhi + ry * math.sin(t) * cosPhi;
      path.lineTo(px, py);
    }
  }
}

/// 描边动画绘制器：按 progress 截取每条路径的前半段画出，形成「连完整个图形」的效果。
class _BadgePainter extends CustomPainter {
  final _BadgeSvg badge;
  final double progress;

  const _BadgePainter(this.badge, this.progress);

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 256;
    canvas.save();
    canvas.scale(scale);
    // 与 SVG 的 <g transform="translate(56 56) scale(6)"> 对齐
    canvas.translate(56, 56);
    canvas.scale(6);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = badge.color;
    for (final path in badge.paths) {
      for (final metric in path.computeMetrics()) {
        final end = metric.length * progress;
        if (end > 0) {
          canvas.drawPath(metric.extractPath(0, end), paint);
        }
      }
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _BadgePainter old) => old.progress != progress || old.badge != badge;
}

/// 动画徽章组件：加载 SVG 文本 → 解析 → 1.1s 描边动画；失败时回落原图标。
class AnimatedAchievementArt extends StatefulWidget {
  final String url;
  final Widget fallback;
  final double size;

  const AnimatedAchievementArt({
    super.key,
    required this.url,
    required this.fallback,
    this.size = 112,
  });

  @override
  State<AnimatedAchievementArt> createState() => _AnimatedAchievementArtState();
}

class _AnimatedAchievementArtState extends State<AnimatedAchievementArt>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  );
  late final Future<_BadgeSvg?> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
    _controller.forward();
  }

  Future<_BadgeSvg?> _load() async {
    try {
      final response = await Dio(
        BaseOptions(responseType: ResponseType.plain, connectTimeout: const Duration(seconds: 8)),
      ).get<String>(widget.url);
      final svg = response.data;
      if (svg == null || !svg.contains('<svg')) return null;
      return _PathParser.parse(svg);
    } catch (_) {
      return null;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_BadgeSvg?>(
      future: _future,
      builder: (context, snapshot) {
        final badge = snapshot.data;
        if (badge == null || badge.paths.isEmpty) return widget.fallback;
        return AnimatedBuilder(
          animation: _controller,
          builder: (context, _) => CustomPaint(
            size: Size.square(widget.size),
            painter: _BadgePainter(badge, Curves.easeOut.transform(_controller.value)),
          ),
        );
      },
    );
  }
}
