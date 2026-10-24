/// 底部导航：悬浮胶囊 + 滑动指示器。
///
/// 为什么不用 `NavigationBar`：M3 的 NavigationBar 是**通底**的，
/// 会在内容上切出一条硬边；这里要的是「浮在内容上的一层玻璃」，
/// 滚动时能透出下面的卡片，视觉上更连贯。
library;

import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/motion.dart';
import '../theme/palette.dart';
import 'press_scale.dart';

/// 一个导航项。
class AppTabItem {
  const AppTabItem({required this.label, required this.icon, required this.activeIcon});

  final String label;
  final IconData icon;
  final IconData activeIcon;
}

/// 悬浮底栏。
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
    final dark = Theme.of(context).brightness == Brightness.dark;

    return SafeArea(
      top: false,
      minimum: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Container(
        height: 66,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: colors.line.withValues(alpha: 0.9)),
          boxShadow: <BoxShadow>[
            BoxShadow(
              color: colors.shadow.withValues(alpha: 0.12),
              blurRadius: 28,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: BackdropFilter(
            filter: ui.ImageFilter.blur(sigmaX: 18, sigmaY: 18),
            child: Container(
              color: colors.card.withValues(alpha: dark ? 0.82 : 0.88),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final itemWidth = constraints.maxWidth / items.length;
                  return Stack(
                    children: <Widget>[
                      // 滑动胶囊
                      AnimatedPositioned(
                        duration: Motion.reduced(context) ? Duration.zero : Motion.normal,
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
                                color: const Color(0xFF6366F1).withValues(alpha: 0.35),
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
                                child: _TabLabel(
                                  item: items[i],
                                  active: i == index,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
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
          child: Icon(active ? item.activeIcon : item.icon, size: 21, color: color),
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
