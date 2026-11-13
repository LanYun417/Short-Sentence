/// 分段控件：滑块式单选（作答方式、语句库分区都用它）。
///
/// 选中态不是「直接换底色」，而是**一块会滑动的胶囊**——
/// 手指点下去能看到它从上一项滑过来，位置变化本身就在说明「你从哪来到哪去」。
library;

import 'package:flutter/material.dart';

import '../theme/motion.dart';
import '../theme/palette.dart';
import 'press_scale.dart';

/// 分段项。
class Segment<T> {
  const Segment({required this.value, required this.label, this.icon, this.badge});

  final T value;
  final String label;
  final IconData? icon;

  /// 右侧小数字（条数）。
  final int? badge;
}

/// 分段控件。
class SegmentedControl<T> extends StatelessWidget {
  const SegmentedControl({
    required this.segments,
    required this.value,
    required this.onChanged,
    this.height = 42,
    super.key,
  });

  final List<Segment<T>> segments;
  final T value;
  final ValueChanged<T> onChanged;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final index = segments.indexWhere((segment) => segment.value == value);
    final count = segments.length;

    return Container(
      height: height,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: colors.cardMuted,
        borderRadius: BorderRadius.circular(height / 2),
        border: Border.all(color: colors.line.withValues(alpha: 0.8)),
      ),
      child: Stack(
        children: <Widget>[
          // 滑动胶囊
          AnimatedAlign(
            alignment: Alignment(count <= 1 ? 0 : -1 + 2 * index / (count - 1), 0),
            duration: Motion.reduced(context) ? Duration.zero : Motion.normal,
            curve: Motion.spring,
            child: FractionallySizedBox(
              widthFactor: 1 / count,
              heightFactor: 1,
              child: Container(
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(height / 2),
                  boxShadow: <BoxShadow>[
                    BoxShadow(
                      color: colors.shadow.withValues(alpha: 0.10),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Row(
            children: <Widget>[
              for (final segment in segments)
                Expanded(
                  child: PressScale(
                    scale: 0.94,
                    onTap: () {
                      if (segment.value != value) {
                        onChanged(segment.value);
                      }
                    },
                    child: Center(
                      child: _SegmentLabel(
                        segment: segment,
                        active: segment.value == value,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SegmentLabel<T> extends StatelessWidget {
  const _SegmentLabel({required this.segment, required this.active});

  final Segment<T> segment;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final color = active ? colors.ink : colors.inkSoft;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        if (segment.icon != null) ...<Widget>[
          AnimatedScale(
            scale: active ? 1 : 0.92,
            duration: Motion.fast,
            curve: Motion.spring,
            child: Icon(segment.icon, size: 16, color: color),
          ),
          const SizedBox(width: 5),
        ],
        AnimatedDefaultTextStyle(
          duration: Motion.fast,
          style: TextStyle(
            fontSize: 14,
            fontWeight: active ? FontWeight.w700 : FontWeight.w500,
            color: color,
          ),
          child: Text(segment.label),
        ),
        if (segment.badge != null) ...<Widget>[
          const SizedBox(width: 4),
          AnimatedOpacity(
            opacity: active ? 1 : 0.6,
            duration: Motion.fast,
            child: Text(
              '${segment.badge}',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: active ? colors.brand : colors.inkFaint,
              ),
            ),
          ),
        ],
      ],
    );
  }
}
