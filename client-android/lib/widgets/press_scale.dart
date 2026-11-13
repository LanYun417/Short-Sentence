/// 按压反馈：手指按下时轻微缩小，抬起回弹。
///
/// 为什么不用 InkWell：Material 的水波纹在深色卡片/渐变按钮上会糊成一片，
/// 而且与「缩放」叠在一起会显得脏。移动端更自然的手感是**按下即缩**，
/// 松手回弹——触觉上像按到了实体。
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/motion.dart';

/// 可按压容器。
class PressScale extends StatefulWidget {
  const PressScale({
    required this.child,
    this.onTap,
    this.onLongPress,
    this.scale = 0.96,
    this.haptic = false,
    // 默认 opaque：整块区域都可点。
    // deferToChild 只响应真正命中的子节点——分段控件的文字只有几十像素宽，
    // 点在「旁边一点点的空白」上就没反应，用户会以为控件坏了（实测踩过）。
    this.behavior = HitTestBehavior.opaque,
    super.key,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  /// 按下时的缩放比例（越小越「软」）。
  final double scale;

  /// 是否触发轻触反馈（重要按钮开启，列表项关闭避免手机一直震）。
  final bool haptic;

  final HitTestBehavior behavior;

  @override
  State<PressScale> createState() => _PressScaleState();
}

class _PressScaleState extends State<PressScale> {
  bool _down = false;

  bool get _enabled => widget.onTap != null || widget.onLongPress != null;

  void _setDown(bool value) {
    if (!_enabled || _down == value) {
      return;
    }
    setState(() => _down = value);
  }

  void _handleTap() {
    if (widget.haptic) {
      HapticFeedback.lightImpact();
    }
    widget.onTap?.call();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: widget.behavior,
      onTapDown: (_) => _setDown(true),
      onTapUp: (_) => _setDown(false),
      onTapCancel: () => _setDown(false),
      onTap: _enabled ? _handleTap : null,
      onLongPress: widget.onLongPress,
      child: AnimatedScale(
        scale: _down ? widget.scale : 1,
        duration: Motion.reduced(context) ? Duration.zero : Motion.fast,
        curve: _down ? Motion.standard : Motion.spring,
        child: widget.child,
      ),
    );
  }
}
