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
import '../theme/palette.dart';
import '../widgets/app_card.dart';
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
            Expanded(child: _buildBody(state, data)),
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
        itemCount: data.items.length + (showFooter ? 1 : 0),
        separatorBuilder: (context, index) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          if (index >= data.items.length) {
            return _Footer(loading: data.loadingMore);
          }
          final item = data.items[index];
          final tile = StaggeredEntrance(
            index: index,
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
