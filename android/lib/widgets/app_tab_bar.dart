/// 底部导航：停靠式通栏 + 滑动指示器。
///
/// 最初是「浮在内容上的一层玻璃」（圆角胶囊 + 毛玻璃 + 投影），
/// 用户反馈改回常规底栏：通栏贴底、方角、只留一道顶部细线——
/// 与系统底栏一致，内容也不会透出干扰。
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/motion.dart';
import '../theme/palette.dart';
import 'press_scale.dart';

/// 一个导航项。
class AppTabItem {
  const AppTabItem({
    required this.label,
    required this.icon,
    required this.activeIcon,
  });

  final String label;
  final IconData icon;
  final IconData activeIcon;
}

/// 停靠式底栏。
class AppTabBar extends StatelessWidget {
  const AppTabBar({
    required this.items,
    required this.index,
    required this.onChanged,
    super.key,
  });

  final List<AppTabItem> items;
  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return SafeArea(
      top: false,
      child: Container(
        height: 66,
        decoration: BoxDecoration(
          color: colors.card,
          border: Border(
            top: BorderSide(color: colors.line.withValues(alpha: 0.9)),
          ),
        ),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final itemWidth = constraints.maxWidth / items.length;
            return Stack(
              children: <Widget>[
                // 滑动胶囊
                AnimatedPositioned(
                  duration: Motion.reduced(context)
                      ? Duration.zero
                      : Motion.normal,
                  curve: Motion.spring,
                  left: index * itemWidth + 10,
                  top: 9,
                  width: itemWidth - 20,
                  height: 48,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: <Color>[Color(0xFF0EA5E9), Color(0xFF6366F1)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: <BoxShadow>[
                        BoxShadow(
                          color: const Color(0xFF6366F1)
                              .withValues(alpha: 0.35),
                          blurRadius: 14,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                  ),
                ),
                Row(
                  children: <Widget>[
                    for (var i = 0; i < items.length; i++)
                      Expanded(
                        child: PressScale(
                          scale: 0.92,
                          behavior: HitTestBehavior.opaque,
                          onTap: () {
                            if (i == index) {
                              return;
                            }
                            HapticFeedback.selectionClick();
                            onChanged(i);
                          },
                          child: _TabLabel(item: items[i], active: i == index),
                        ),
                      ),
                  ],
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _TabLabel extends StatelessWidget {
  const _TabLabel({required this.item, required this.active});

  final AppTabItem item;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final color = active ? Colors.white : colors.inkFaint;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: <Widget>[
        AnimatedScale(
          scale: active ? 1.08 : 1,
          duration: Motion.fast,
          curve: Motion.spring,
          child: Icon(
            active ? item.activeIcon : item.icon,
            size: 21,
            color: color,
          ),
        ),
        const SizedBox(height: 3),
        AnimatedDefaultTextStyle(
          duration: Motion.fast,
          style: TextStyle(
            fontSize: 10,
            height: 1.1,
            fontWeight: active ? FontWeight.w700 : FontWeight.w500,
            color: color,
            letterSpacing: 0.2,
          ),
          child: Text(item.label),
        ),
      ],
    );
  }
}
