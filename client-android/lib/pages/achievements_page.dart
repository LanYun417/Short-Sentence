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
  /// 分类默认折叠（第一个分类默认展开）：记录展开中的分类 label。
  final Set<String> _expanded = <String>{};
  /// 筛选：all / unlocked / locked。
  String _filter = 'all';

  static const List<({String key, String label})> _filters = <({String key, String label})>[
    (key: 'all', label: '全部'),
    (key: 'unlocked', label: '已解锁'),
    (key: 'locked', label: '未解锁'),
  ];

  void _toggle(String label) {
    setState(() {
      if (_expanded.contains(label)) {
        _expanded.remove(label);
      } else {
        _expanded.add(label);
      }
    });
  }

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
    final all = growth.achievements;
    final items = _filtered(all, _filter);
    final overview = growth.overview;
    final groups = _groupAchievements(items);
    // 默认展开第一个分类；用户一旦手动折叠/展开，则以 _expanded 为准
    final expandedSet =
        _expanded.isEmpty && groups.isNotEmpty ? <String>{groups.first.label} : _expanded;

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
              // 筛选 chips
              if (overview != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    children: <Widget>[
                      for (final f in _filters) ...<Widget>[
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: _FilterChip(
                            label: f.label,
                            selected: _filter == f.key,
                            onTap: () => setState(() => _filter = f.key),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              if (items.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(child: Text('该筛选下暂无成就…')),
                )
              else
                for (final group in groups) ...<Widget>[
                  AppCard(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
                    radius: 20,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        PressScale(
                          onTap: () => _toggle(group.label),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 2),
                            child: Row(
                              children: <Widget>[
                                Icon(
                                  expandedSet.contains(group.label)
                                      ? Icons.keyboard_arrow_down_rounded
                                      : Icons.keyboard_arrow_right_rounded,
                                  size: 18,
                                  color: colors.inkFaint,
                                ),
                                const SizedBox(width: 4),
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
                          ),
                        ),
                        if (expandedSet.contains(group.label)) ...<Widget>[
                          const SizedBox(height: 4),
                          for (final item in group.items) _AchievementRow(item: item),
                        ],
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

/// 按筛选过滤成就列表。
List<AchievementView> _filtered(List<AchievementView> all, String filter) {
  if (filter == 'unlocked') return all.where((a) => a.unlocked).toList();
  if (filter == 'locked') return all.where((a) => !a.unlocked).toList();
  return all;
}

/// 筛选 chip。
class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return PressScale(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? colors.brand : colors.card,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? colors.brand : colors.line),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : colors.inkSoft,
          ),
        ),
      ),
    );
  }
}
