/// App 外壳：四个 Tab（刷题 / 语句库 / 成长 / 我的）+ 悬浮底栏。
///
/// 为什么用「同时挂载、交叉淡入」而不是 `IndexedStack` 直接切换：
/// 直接切会硬跳，四次进出里最常发生的「从刷题切到成长」看起来像刷新了页面。
/// 这里每页保留状态（Riverpod 本来就有缓存，但滚动位置与输入框内容在页面内），
/// 切换时淡入 + 1.5% 缩放回正，视觉上是「页面浮上来」而不是「闪一下」。
///
/// 未访问过的 Tab **不提前构建**：首屏只请求刷题需要的数据，
/// 成长/语句库等真正点进去时才加载。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../theme/motion.dart';
import '../theme/palette.dart';
import '../widgets/app_tab_bar.dart';
import 'growth_page.dart';
import 'library_page.dart';
import 'profile_page.dart';
import 'quiz_page.dart';

class ShellPage extends ConsumerStatefulWidget {
  const ShellPage({this.initialIndex = 0, super.key});

  final int initialIndex;

  @override
  ConsumerState<ShellPage> createState() => _ShellPageState();
}

class _ShellPageState extends ConsumerState<ShellPage> {
  late int _index = widget.initialIndex;
  late final Set<int> _visited = <int>{_index};

  static const List<AppTabItem> _tabs = <AppTabItem>[
    AppTabItem(
      label: '刷题',
      icon: Icons.style_outlined,
      activeIcon: Icons.style_rounded,
    ),
    AppTabItem(
      label: '语句库',
      icon: Icons.collections_bookmark_outlined,
      activeIcon: Icons.collections_bookmark_rounded,
    ),
    AppTabItem(
      label: '成长',
      icon: Icons.insights_outlined,
      activeIcon: Icons.insights_rounded,
    ),
    AppTabItem(
      label: '我的',
      icon: Icons.person_outline_rounded,
      activeIcon: Icons.person_rounded,
    ),
  ];

  void _select(int index) {
    if (index == _index) {
      return;
    }
    setState(() {
      _index = index;
      _visited.add(index);
    });
  }

  @override
  Widget build(BuildContext context) {
    // 键盘弹出时收起底栏：否则它会正好压在输入框与「确定」之间，
    // 既挡住内容又抢走点击（实测在刷题页输入时必现）。
    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;
    final reduce = Motion.reduced(context);
    return Scaffold(
      extendBody: true,
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: Stack(
        children: <Widget>[
          // 顶部一层极淡的品牌色雾，让纯色底不至于太平
          const Positioned.fill(child: _CanvasWash()),
          Positioned.fill(
            child: Stack(
              children: <Widget>[
                for (var i = 0; i < _tabs.length; i++)
                  if (_visited.contains(i))
                    Positioned.fill(
                      child: _TabView(
                        active: i == _index,
                        child: switch (i) {
                          0 => const QuizPage(),
                          1 => const LibraryPage(),
                          2 => const GrowthPage(),
                          _ => const ProfilePage(),
                        },
                      ),
                    ),
              ],
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: IgnorePointer(
              ignoring: keyboardOpen,
              child: AnimatedSlide(
                offset: keyboardOpen ? const Offset(0, 1.2) : Offset.zero,
                duration: reduce ? Duration.zero : Motion.normal,
                curve: Motion.standard,
                child: AnimatedOpacity(
                  opacity: keyboardOpen ? 0 : 1,
                  duration: reduce ? Duration.zero : Motion.fast,
                  child: AppTabBar(items: _tabs, index: _index, onChanged: _select),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 单个 Tab 的容器：交叉淡入 + 轻微缩放，隐藏时停止动画与命中。
class _TabView extends StatelessWidget {
  const _TabView({required this.active, required this.child});

  final bool active;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final reduce = Motion.reduced(context);
    return IgnorePointer(
      ignoring: !active,
      // TickerMode 必须在**动画之外**：它会把子树里的所有 Ticker（包括
      // AnimatedOpacity 自己的控制器）一并停掉——套在外面会让淡出动画
      // 永远停在 opacity=1，旧页面就留在新页面底下透出来。
      child: AnimatedOpacity(
        opacity: active ? 1 : 0,
        duration: reduce ? Duration.zero : Motion.normal,
        curve: Motion.standard,
        child: AnimatedScale(
          scale: active ? 1 : 0.985,
          duration: reduce ? Duration.zero : Motion.normal,
          curve: Motion.standard,
          child: TickerMode(enabled: active, child: child),
        ),
      ),
    );
  }
}

/// 画布顶部的一层品牌色雾（纯色底太平，压一层极淡的渐变就「有空气」）。
class _CanvasWash extends StatelessWidget {
  const _CanvasWash();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return IgnorePointer(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: <Color>[
              colors.canvasTint.withValues(alpha: 0.75),
              colors.canvas.withValues(alpha: 0),
            ],
            stops: const <double>[0, 0.42],
          ),
        ),
      ),
    );
  }
}
