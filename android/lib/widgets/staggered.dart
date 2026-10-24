/// 错峰入场：列表项与卡片按顺序浮起淡入。
///
/// 实现要点（踩过的坑）：**不要用 `Future.delayed` 做延迟**——
/// 它留下的是定时器而不是动画帧，`pumpAndSettle` 会在动画还没开始时就返回，
/// widget 测试里就会出现「明明渲染了却找不到文字」的假失败。
/// 这里把延迟折进总时长：控制器立刻启动，用 [Interval] 把前段留白，
/// 全程只有动画帧，没有定时器。
library;

import 'package:flutter/material.dart';

import '../theme/motion.dart';

/// 单项错峰入场。
class StaggeredEntrance extends StatefulWidget {
  const StaggeredEntrance({
    required this.child,
    this.index = 0,
    this.offset = const Offset(0, 16),
    this.duration = Motion.normal,
    super.key,
  });

  final Widget child;

  /// 第几项（决定延迟）。
  final int index;

  /// 起始位移（默认从下方 16px 浮起）。
  final Offset offset;

  /// 单次动画时长（不含延迟）。
  final Duration duration;

  @override
  State<StaggeredEntrance> createState() => _StaggeredEntranceState();
}

class _StaggeredEntranceState extends State<StaggeredEntrance>
    with SingleTickerProviderStateMixin {
  late final Duration _delay = Motion.stagger(widget.index);
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: _delay + widget.duration,
  );

  late final Animation<double> _curve = CurvedAnimation(
    parent: _controller,
    curve: Interval(
      _delay.inMicroseconds /
          (_delay.inMicroseconds + widget.duration.inMicroseconds),
      1,
      curve: Motion.decelerate,
    ),
  );

  /// 超过这个序号就**不做入场动画**，直接显示。
  ///
  /// 列表滚动时 ListView 会回收并重建 item：如果每一项都带入场动画，
  /// 往回滚时它们会集体重播一次「浮起 + 淡入」，看起来像页面在抖，
  /// 而且每次滚动都要新建一批 AnimationController。首屏 8 项足够表达节奏。
  static const int _animateLimit = 8;

  bool get _animated => widget.index < _animateLimit;

  @override
  void initState() {
    super.initState();
    if (_animated) {
      _controller.forward();
    } else {
      _controller.value = 1;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_animated || Motion.reduced(context)) {
      return widget.child;
    }
    return AnimatedBuilder(
      animation: _curve,
      builder: (context, child) {
        final t = _curve.value;
        return Opacity(
          opacity: t.clamp(0.0, 1.0),
          child: Transform.translate(
            offset: Offset(
              widget.offset.dx * (1 - t),
              widget.offset.dy * (1 - t),
            ),
            child: child,
          ),
        );
      },
      child: widget.child,
    );
  }
}

/// 给一组子节点统一加错峰（行内使用，避免逐个包）。
List<Widget> staggerAll(
  List<Widget> children, {
  int start = 0,
  Offset? offset,
}) {
  return <Widget>[
    for (var i = 0; i < children.length; i++)
      StaggeredEntrance(
        index: start + i,
        offset: offset ?? const Offset(0, 16),
        child: children[i],
      ),
  ];
}
