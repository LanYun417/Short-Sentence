/// 全部成就页（路由 /achievements）：按分类分组展示所有成就勋章。
///
/// 从成长页「成就 · 全部」进入。与 Web `pages/achievements.vue` 同源同契约。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/models/growth.dart';
import '../state/growth_controller.dart';
import '../theme.dart';
import '../theme/icon_map.dart';
import '../widgets/app_card.dart';
import '../widgets/page_header.dart';
import '../widgets/press_scale.dart';

class AchievementsPage extends ConsumerStatefulWidget {
  const AchievementsPage({super.key});

  @override
  ConsumerState<AchievementsPage> createState() => _AchievementsPageState();
}

class _AchievementsPageState extends ConsumerState<AchievementsPage> {
  @override
  void initState() {
    super.initState();
    // 进来重拉一次，保证新解锁的勋章立刻可见
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(growthControllerProvider.notifier).load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final growth = ref.watch(growthControllerProvider);
    final items = growth.achievements;
    final overview = growth.overview;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () => ref.read(growthControllerProvider.notifier).load(),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
            children: <Widget>[
              PageHeader(
                title: '全部成就',
                subtitle: overview == null
                    ? null
                    : '已解锁 ${overview.unlockedAchievements} / ${overview.totalAchievements}',
              ),
              if (items.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(child: Text('成就正在准备中…')),
                )
              else
                for (final group in _groupAchievements(items)) ...<Widget>[
                  AppCard(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
                    radius: 20,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Row(
                          children: <Widget>[
                            Text(
                              group.label,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: colors.ink,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '${group.unlocked}/${group.items.length}',
                              style: TextStyle(fontSize: 11, color: colors.inkFaint),
                            ),
                            const SizedBox(width: 8),
                            Expanded(child: Divider(height: 1, color: colors.line)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        for (final item in group.items) _AchievementRow(item: item),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
            ],
          ),
        ),
      ),
    );
  }

  /// 按分类分组（行为 / 坚持 / 探索 / 运气 / 其他）。
  static List<({String label, List<AchievementView> items, int unlocked})> _groupAchievements(
    List<AchievementView> items,
  ) {
    const order = ['behavior', 'persist', 'explore', 'luck'];
    final map = <String, List<AchievementView>>{};
    for (final item in items) {
      final c = item.category.isEmpty ? 'other' : item.category;
      (map[c] ??= <AchievementView>[]).add(item);
    }
    final list = map.entries
        .map(
          (e) => (
            label: e.value.isEmpty ? e.key : e.value.first.categoryLabel,
            items: e.value,
            unlocked: e.value.where((i) => i.unlocked).length,
          ),
        )
        .toList();
    int idx(String k) => order.indexOf(k);
    list.sort((a, b) {
      final ac = a.items.first.category;
      final bc = b.items.first.category;
      return (idx(ac) == -1 ? 99 : idx(ac)).compareTo(idx(bc) == -1 ? 99 : idx(bc));
    });
    return list;
  }
}

/// 单行成就：图标 + 名称 + 描述 + 状态。
class _AchievementRow extends StatelessWidget {
  const _AchievementRow({required this.item});

  final AchievementView item;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final unlocked = item.unlocked;
    return PressScale(
      onTap: () {},
      scale: 0.99,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: <Widget>[
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(13),
                color: unlocked ? colors.card : colors.cardMuted,
                border: Border.all(
                  color: unlocked ? colors.gold.withValues(alpha: 0.35) : colors.line,
                ),
              ),
              child: Icon(
                unlocked ? appIcon(item.icon) : Icons.lock_rounded,
                size: 20,
                color: unlocked ? colors.gold : colors.inkFaint,
              ),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    item.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: unlocked ? colors.ink : colors.inkSoft,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    item.description,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 11.5, color: colors.inkFaint),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Pill(
              label: unlocked ? '+${item.rewardXp} XP' : '未解锁',
              background: (unlocked ? colors.success : colors.inkFaint).withValues(alpha: 0.1),
              foreground: unlocked ? colors.success : colors.inkFaint,
            ),
          ],
        ),
      ),
    );
  }
}
