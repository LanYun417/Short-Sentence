/// 液态流体背景：运行时片元着色器（域扭曲 FBM），与 Web 端 `HeroAurora.vue` 同算法。
///
/// 为什么用 shader：`AuroraBackground` 的径向柔光只能做出「雾状光团」，
/// 缺少液体的翻卷 / 拉丝结构。这里把同一段 GLSL 编译成 Flutter 运行时效果，
/// 由 GPU 逐像素合成（Impeller），零新增依赖。
///
/// 降级：`Motion.loopAnimations == false`（Widget 测试 / 主动关闭循环动画）时
/// 不加载着色器；设备不支持运行时着色器或加载失败时，退回静态阶段色渐变，
/// 不抛错、不留黑块。
///
/// 注意：**同一屏只创建一个实例**。Impeller 的 GLES 后端在多实例同时渲染时
/// 可能触发原生断言（2026-10-28 模拟器实测：同屏 3 个实例崩溃、1 个正常）。
library;

import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../state/gyro.dart';
import '../theme/motion.dart';

/// 液态流体背景（铺满父级，颜色随阶段色变化）。
class LiquidAurora extends StatefulWidget {
  const LiquidAurora({
    required this.from,
    required this.via,
    required this.to,
    super.key,
  });

  final Color from;
  final Color via;
  final Color to;

  @override
  State<LiquidAurora> createState() => _LiquidAuroraState();
}

class _LiquidAuroraState extends State<LiquidAurora> with SingleTickerProviderStateMixin {
  ui.FragmentShader? _shader;
  final ValueNotifier<double> _time = ValueNotifier<double>(5.5);

  /// 陀螺仪摇动 → 液体位移（-1..1）。只有 Hero 挂载时才订阅传感器。
  final GyroTilt _gyro = GyroTilt();

  late final Ticker _ticker = createTicker(_onTick);
  Duration _last = Duration.zero;
  double _accumulated = 0;

  @override
  void initState() {
    super.initState();
    // 测试环境 / 主动关闭循环动画：不加载 shader（省资源，也避免无 GPU 宿主报错）。
    if (Motion.loopAnimations) {
      _loadShader();
    }
  }

  Future<void> _loadShader() async {
    try {
      final program = await ui.FragmentProgram.fromAsset('shaders/liquid.frag');
      if (!mounted) {
        return;
      }
      setState(() => _shader = program.fragmentShader());
    } catch (_) {
      // 不支持运行时着色器：保持 null，build 退回渐变兜底。
    }
  }

  void _onTick(Duration elapsed) {
    final dt = (elapsed - _last).inMicroseconds / 1000000.0;
    _last = elapsed;
    // 后台/卡顿后 dt 可能很大，钳一下避免画面跳变
    _accumulated += dt.clamp(0.0, 0.1);
    // 液态流动很慢，30fps 足够顺滑且省电
    if (_accumulated < 1 / 30) {
      return;
    }
    _time.value += _accumulated;
    _accumulated = 0;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final animate = Motion.loopAnimations && !Motion.reduced(context);
    // 减弱动效时不订阅传感器：省电，也避免背景跟着晃
    if (animate) {
      _gyro.start();
    } else {
      _gyro.stop();
    }
    if (animate && !_ticker.isTicking) {
      _last = Duration.zero;
      _ticker.start();
    } else if (!animate && _ticker.isTicking) {
      _ticker.stop();
    }
  }

  @override
  void dispose() {
    _ticker.dispose();
    _gyro.dispose();
    _time.dispose();
    _shader?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final shader = _shader;
    if (shader == null) {
      // 兜底：静态阶段色渐变（与 Web 端 WebGL 不可用时一致）
      return DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: <Color>[widget.from, widget.via, widget.to],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
      );
    }
    return SizedBox.expand(
      child: CustomPaint(
        painter: _LiquidPainter(
          shader: shader,
          time: _time,
          gyro: _gyro,
          from: widget.from,
          via: widget.via,
          to: widget.to,
        ),
      ),
    );
  }
}

class _LiquidPainter extends CustomPainter {
  _LiquidPainter({
    required this.shader,
    required this.time,
    required this.gyro,
    required this.from,
    required this.via,
    required this.to,
  }) : super(repaint: Listenable.merge(<Listenable>[time, gyro]));

  final ui.FragmentShader shader;
  final ValueNotifier<double> time;
  final GyroTilt gyro;
  final Color from;
  final Color via;
  final Color to;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) {
      return;
    }
    // uniform 顺序与 liquid.frag 声明顺序一致：
    // uSize(0,1) uTime(2) uFrom(3..5) uVia(6..8) uTo(9..11) uTilt(12,13)
    final Offset tilt = gyro.value;
    shader
      ..setFloat(0, size.width)
      ..setFloat(1, size.height)
      ..setFloat(2, time.value)
      ..setFloat(3, from.r)
      ..setFloat(4, from.g)
      ..setFloat(5, from.b)
      ..setFloat(6, via.r)
      ..setFloat(7, via.g)
      ..setFloat(8, via.b)
      ..setFloat(9, to.r)
      ..setFloat(10, to.g)
      ..setFloat(11, to.b)
      ..setFloat(12, tilt.dx)
      ..setFloat(13, tilt.dy);
    canvas.drawRect(Offset.zero & size, Paint()..shader = shader);
  }

  @override
  bool shouldRepaint(_LiquidPainter oldDelegate) =>
      oldDelegate.shader != shader ||
      oldDelegate.from != from ||
      oldDelegate.via != via ||
      oldDelegate.to != to;
}
