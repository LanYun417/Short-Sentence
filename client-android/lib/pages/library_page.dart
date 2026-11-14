/// 语句库页（收藏 / 复习 / 历史）。
///
/// 交互取舍：
/// - **取消收藏靠左滑**，不放进详情也不做成右侧按钮：手机上列表右侧最容易误触；
/// - 左滑后给 3 秒撤销窗口（乐观更新已生效，撤销就是重新收藏）；
/// - 触底 300px 处预加载下一页，滚到底不会「停一下再出内容」。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/models/library_item.dart';
import '../state/library_controller.dart';
import '../state/quiz_controller.dart';
import '../state/shell_controller.dart';
import '../theme/motion.dart';
import '../theme/palette.dart';
import '../widgets/app_card.dart';
import '../widgets/press_scale.dart';
import '../widgets/empty_state.dart';
import '../widgets/page_header.dart';
import '../widgets/segmented.dart';
import '../widgets/sentence_tile.dart';
import '../widgets/shimmer.dart';
import '../widgets/staggered.dart';
import '../sheets/sentence_sheet.dart';

class LibraryPage extends ConsumerStatefulWidget {
  const LibraryPage({super.key});

  @override
  ConsumerState<LibraryPage> createState() => _LibraryPageState();
}

class _LibraryPageState extends ConsumerState<LibraryPage> {
  final ScrollController _scroll = ScrollController();

  /// 是否显示「返回顶部」：滚过一屏才值得占地方。
  bool _showTop = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final notifier = ref.read(libraryControllerProvider.notifier);
      final state = ref.read(libraryControllerProvider);
      if (!state.current.loadedOnce) {
        notifier.refresh();
      }
      // 让另外两个分区的条数也显示出来（轻请求，失败静默）
      notifier.prefetchCounts();
    });
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scroll.hasClients) {
      return;
    }
    if (_scroll.position.extentAfter < 320) {
      ref.read(libraryControllerProvider.notifier).loadMore();
    }
    // 一屏以上才浮出来：刚进页面或快滚到底时都没必要
    final show = _scroll.offset > 700;
    if (show != _showTop) {
      setState(() => _showTop = show);
    }
  }

  /// 平滑回顶。分区的列表各自一个 controller 实例？不——三个分区共用同一个
  /// [_scroll]，切分区时已 jumpTo(0)，这里的 animateTo 对当前可见列表生效。
  void _backToTop() {
    if (!_scroll.hasClients) {
      return;
    }
    _scroll.animateTo(0, duration: Motion.slow, curve: Motion.decelerate);
  }

  Future<void> _switchTab(LibraryTab tab) async {
    final notifier = ref.read(libraryControllerProvider.notifier);
    await notifier.switchTab(tab);
    if (_scroll.hasClients) {
      _scroll.jumpTo(0);
    }
  }

  Future<bool> _unfavorite(SentenceLibraryItem item, int index) async {
    final ok = await ref
        .read(libraryControllerProvider.notifier)
        .unfavorite(item);
    if (!mounted) {
      return ok;
    }
    if (!ok) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('取消收藏失败，请稍后重试')));
      return false;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('已取消收藏「${_short(item.sentenceEn)}」'),
        action: SnackBarAction(
          label: '撤销',
          onPressed: () => ref
              .read(libraryControllerProvider.notifier)
              .restoreFavorite(item, index),
        ),
      ),
    );
    return true;
  }

  static String _short(String text) =>
      text.length <= 16 ? text : '${text.substring(0, 16)}…';

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(libraryControllerProvider);
    final data = state.current;

    return Material(
      color: Colors.transparent,
      child: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            PageHeader(
              title: '语句库',
              subtitle: '收藏、复习与历史，都在这里',
              trailing: _CountBadge(count: data.total),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: SegmentedControl<LibraryTab>(
                value: state.tab,
                onChanged: _switchTab,
                segments: <Segment<LibraryTab>>[
                  for (final tab in LibraryTab.values)
                    Segment<LibraryTab>(
                      value: tab,
                      label: tab.label,
                      badge: state.of(tab).total > 0
                          ? state.of(tab).total
                          : null,
                    ),
                ],
              ),
            ),
            Expanded(
              child: Stack(
                children: <Widget>[
                  _buildBody(state, data),
                  // 返回顶部：右下角悬浮，避开底部导航（底栏高约 78dp）
                  Positioned(
                    right: 16,
                    bottom: 100,
                    child: _BackToTopButton(
                      visible: _showTop,
                      onTap: _backToTop,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(LibraryState state, LibraryTabData data) {
    if (data.loading && data.items.isEmpty) {
      return const _LoadingList();
    }
    if (data.error != null && data.items.isEmpty) {
      return EmptyState(
        title: '加载失败',
        message: data.error,
        tone: EmptyTone.error,
        icon: Icons.cloud_off_rounded,
        actionLabel: '重试',
        onAction: () => ref.read(libraryControllerProvider.notifier).refresh(),
      );
    }
    if (data.loadedOnce && data.items.isEmpty) {
      return RefreshIndicator(
        color: context.colors.brand,
        onRefresh: () => ref.read(libraryControllerProvider.notifier).refresh(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(top: 60),
          children: <Widget>[
            EmptyState(
              title: switch (state.tab) {
                LibraryTab.favorites => '还没有收藏',
                LibraryTab.review => '暂时没有要复习的',
                LibraryTab.history => '还没有练习记录',
              },
              message: switch (state.tab) {
                LibraryTab.favorites => '刷题时点卡片背面的星标，句子就会收在这里',
                LibraryTab.review => '答错的句子会立刻回到这里，答对的按间隔重复排期',
                LibraryTab.history => '完成第一道题后，这里会记下你的每次作答',
              },
              icon: switch (state.tab) {
                LibraryTab.favorites => Icons.bookmark_border_rounded,
                LibraryTab.review => Icons.repeat_rounded,
                LibraryTab.history => Icons.history_rounded,
              },
              tone: EmptyTone.brand,
            ),
          ],
        ),
      );
    }

    final showFooter =
        data.loadingMore ||
        (data.loadedOnce && !data.hasMore && data.items.length > 4);
    return RefreshIndicator(
      color: context.colors.brand,
      onRefresh: () => ref.read(libraryControllerProvider.notifier).refresh(),
      child: ListView.separated(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 108),
        // 复习 Tab 顶部固定一条「开始复习」入口（有到期题时才占位）
        itemCount:
            data.items.length +
            (showFooter ? 1 : 0) +
            (state.tab == LibraryTab.review && data.total > 0 ? 1 : 0),
        separatorBuilder: (context, index) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          // 第一条：一键开刷入口（只在复习 Tab 且确有待复习题时出现）
          if (state.tab == LibraryTab.review && data.total > 0 && index == 0) {
            return const StaggeredEntrance(
              index: 0,
              child: _StartReviewBanner(),
            );
          }
          // 后续索引整体前移 1（让位给 banner）
          final listIndex = state.tab == LibraryTab.review && data.total > 0
              ? index - 1
              : index;
          if (listIndex >= data.items.length) {
            return _Footer(loading: data.loadingMore);
          }
          final item = data.items[listIndex];
          final tile = StaggeredEntrance(
            index: listIndex,
            child: SentenceTile(
              item: item,
              showAccuracy: state.tab == LibraryTab.history,
              onTap: () => showSentenceSheet(
                context,
                item,
                showUnfavorite: state.tab == LibraryTab.favorites,
                onUnfavorite: () => _unfavorite(item, index),
              ),
            ),
          );

          if (state.tab != LibraryTab.favorites) {
            return tile;
          }
          // 左滑取消收藏：背景不写大段文案，只留图标与「取消收藏」四个字
          return Dismissible(
            key: ValueKey<int>(item.sentenceId),
            direction: DismissDirection.endToStart,
            dismissThresholds: const <DismissDirection, double>{
              DismissDirection.endToStart: 0.32,
            },
            // 失败时返回 false：让卡片弹回去，而不是「消失了但还在列表里」
            confirmDismiss: (_) => _unfavorite(item, index),
            background: Container(
              alignment: Alignment.centerRight,
              padding: const EdgeInsets.only(right: 22),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                color: context.colors.danger.withValues(alpha: 0.12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Icon(
                    Icons.star_outline_rounded,
                    size: 18,
                    color: context.colors.danger,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '取消收藏',
                    style: TextStyle(
                      color: context.colors.danger,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            child: tile,
          );
        },
      ),
    );
  }
}

/// 「开始复习」入口条：显示到期题数，点击直接开刷（只抽到期复习题）并跳回刷题 Tab。
///
/// 为什么放在列表顶部而不是只在空态：用户进来先看到「N 张到期 + 开始复习」，
/// 比滚列表更直接；答完一串回来列表仍在，形成「复习 → 回来看剩余」的闭环。
class _StartReviewBanner extends ConsumerWidget {
  const _StartReviewBanner();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final total = ref.watch(libraryControllerProvider).current.total;
    return PressScale(
      onTap: () async {
        // 先切回刷题 Tab（与题库页选完即回的体验一致），再发起纯复习抽题
        ref.read(shellControllerProvider.notifier).go(0);
        await ref.read(quizControllerProvider.notifier).startReview();
      },
      child: AppCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: <Widget>[
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                color: context.colors.brand.withValues(alpha: 0.12),
              ),
              child: Icon(
                Icons.repeat_rounded,
                color: context.colors.brand,
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    '$total 张到期待复习',
                    style: Theme.of(context).textTheme.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '答错的当天复现，答对的按间隔重复排期',
                    style: Theme.of(context).textTheme.bodySmall
                        ?.copyWith(color: context.colors.inkSoft),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: () async {
                ref.read(shellControllerProvider.notifier).go(0);
                await ref.read(quizControllerProvider.notifier).startReview();
              },
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 10,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: const Text('开始复习'),
            ),
          ],
        ),
      ),
    );
  }
}

/// 总数徽标。
class _CountBadge extends StatelessWidget {
  const _CountBadge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: colors.brand.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(Icons.layers_rounded, size: 14, color: colors.brand),
          const SizedBox(width: 5),
          Text(
            '$count',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: colors.brand,
            ),
          ),
        ],
      ),
    );
  }
}

/// 首屏骨架。
class _LoadingList extends StatelessWidget {
  const _LoadingList();

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 108),
      physics: const NeverScrollableScrollPhysics(),
      itemCount: 5,
      separatorBuilder: (context, index) => const SizedBox(height: 10),
      itemBuilder: (context, index) => AppCard(
        padding: const EdgeInsets.all(14),
        radius: 20,
        child: Row(
          children: <Widget>[
            const ShimmerBox(height: 56, width: 56, radius: 14),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  ShimmerBox(
                    height: 14,
                    width: 190 + (index % 3) * 24,
                    radius: 7,
                  ),
                  const SizedBox(height: 8),
                  ShimmerBox(
                    height: 11,
                    width: 140 + (index % 2) * 30,
                    radius: 6,
                  ),
                  const SizedBox(height: 10),
                  ShimmerBox(height: 18, width: 64, radius: 9),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 底部：加载中 / 到底了。
class _Footer extends StatelessWidget {
  const _Footer({required this.loading});

  final bool loading;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 18),
      child: Center(
        child: loading
            ? SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: colors.brand,
                ),
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Container(width: 18, height: 1, color: colors.line),
                  const SizedBox(width: 8),
                  Text(
                    '到底了',
                    style: TextStyle(fontSize: 11, color: colors.inkFaint),
                  ),
                  const SizedBox(width: 8),
                  Container(width: 18, height: 1, color: colors.line),
                ],
              ),
      ),
    );
  }
}

/// 返回顶部悬浮按钮：出现/消失带缩放淡入，按压有回弹。
class _BackToTopButton extends StatelessWidget {
  const _BackToTopButton({required this.visible, required this.onTap});

  final bool visible;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final reduce = Motion.reduced(context);
    return ExcludeSemantics(
      excluding: !visible,
      child: AnimatedOpacity(
        opacity: visible ? 1 : 0,
        duration: reduce ? Duration.zero : Motion.fast,
        curve: Motion.standard,
        child: AnimatedScale(
          scale: visible ? 1 : 0.8,
          duration: reduce ? Duration.zero : Motion.fast,
          curve: Motion.spring,
          child: IgnorePointer(
            ignoring: !visible,
            child: PressScale(
              onTap: onTap,
              scale: 0.9,
              haptic: true,
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: colors.line),
                  boxShadow: <BoxShadow>[
                    BoxShadow(
                      color: colors.shadow.withValues(alpha: 0.12),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Icon(
                  Icons.arrow_upward_rounded,
                  size: 20,
                  color: colors.brand,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
