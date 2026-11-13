/// 场景探索页（路由 /scenes）：全部场景网格列表，支持筛选。
///
/// 从成长页「场景地图 · 全部」进入。与 Web `pages/scenes.vue` 同源同契约。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/models/growth.dart';
import '../state/growth_controller.dart';
import '../theme.dart';
import '../theme/icon_map.dart';
import '../widgets/page_header.dart';
import '../widgets/press_scale.dart';

class ScenesPage extends ConsumerStatefulWidget {
  const ScenesPage({super.key});

  @override
  ConsumerState<ScenesPage> createState() => _ScenesPageState();
}

class _ScenesPageState extends ConsumerState<ScenesPage> {
  String _filter = 'all';

  static const List<({String key, String label})> _filters = <({String key, String label})>[
    (key: 'all', label: '全部'),
    (key: 'unlocked', label: '已解锁'),
    (key: 'locked', label: '未解锁'),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(growthControllerProvider.notifier).load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final growth = ref.watch(growthControllerProvider);
    final all = growth.scenes;
    final overview = growth.overview;
    final items = _filtered(all, _filter);

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
                title: '场景探索',
                subtitle: overview == null ? null : '已点亮 ${overview.unlockedScenes} / ${overview.totalScenes}',
              ),
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
                  child: Center(child: Text('该筛选下暂无场景')),
                )
              else
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                    childAspectRatio: 1.25,
                  ),
                  itemCount: items.length,
                  itemBuilder: (context, index) => _SceneTile(item: items[index]),
                ),
            ],
          ),
        ),
      ),
    );
  }

  static List<SceneMapItem> _filtered(List<SceneMapItem> all, String filter) {
    if (filter == 'unlocked') return all.where((s) => s.unlocked).toList();
    if (filter == 'locked') return all.where((s) => !s.unlocked).toList();
    return all;
  }
}

/// 场景卡片。
class _SceneTile extends StatelessWidget {
  const _SceneTile({required this.item});

  final SceneMapItem item;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final unlocked = item.unlocked;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: unlocked ? colors.card : colors.cardMuted.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: unlocked ? colors.brand.withValues(alpha: 0.3) : colors.line,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              color: unlocked ? colors.brand.withValues(alpha: 0.15) : colors.cardMuted,
            ),
            child: Icon(
              unlocked ? appIcon(item.icon) : Icons.lock_outline_rounded,
              size: 18,
              color: unlocked ? colors.brand : colors.inkFaint,
            ),
          ),
          const Spacer(),
          Text(
            item.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              color: unlocked ? colors.ink : colors.inkSoft,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            unlocked ? '已练 ${item.practicedCount} 句' : '未解锁',
            style: TextStyle(fontSize: 11, color: colors.inkFaint),
          ),
        ],
      ),
    );
  }
}

/// 筛选 chip（与成就页同款）。
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
