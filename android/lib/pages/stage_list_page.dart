/// 情景闯关地图（路由 /stages）：场景双列卡 + 总进度 + 捷径。
///
/// 与 Web 端 `stages/index.vue` 对齐：顶部总进度、+50% 提示、推荐关 / 待领奖
/// 两条捷径，下面是场景网格（封面 cover + 已通关进度）。点场景进入剧本列表。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../api/models/stage.dart';
import '../api/stage_api.dart';
import '../theme.dart';
import '../widgets/app_card.dart';
import '../widgets/page_header.dart';
import '../widgets/press_scale.dart';
import '../widgets/staggered.dart';
import '../widgets/stage_cover.dart';

class StageListPage extends ConsumerStatefulWidget {
  const StageListPage({super.key});

  @override
  ConsumerState<StageListPage> createState() => _StageListPageState();
}

class _StageListPageState extends ConsumerState<StageListPage> {
  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final AsyncValue<StageOverview> overview =
        ref.watch(stageOverviewProvider);

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(stageOverviewProvider),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
            children: <Widget>[
              const PageHeader(
                title: '情景闯关',
                subtitle: '和 AI 角色聊够轮数、达成目标即可通关。',
              ),
              overview.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (Object error, _) => AppCard(
                  child: Text('加载失败：$error', style: TextStyle(color: colors.danger)),
                ),
                data: (StageOverview data) => _buildBody(colors, data),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody(AppColors colors, StageOverview data) {
    final int total = data.totalStages;
    final int cleared = data.clearedStages;
    final double ratio = total == 0 ? 0 : cleared / total;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        StaggeredEntrance(
          child: AppCard(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            radius: 20,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Icon(Icons.explore_rounded, size: 18, color: colors.brand),
                    const SizedBox(width: 8),
                    Text(
                      '已通关 $cleared / $total',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(
                        color: colors.gold.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          Icon(Icons.bolt_rounded, size: 13, color: colors.gold),
                          const SizedBox(width: 4),
                          Text(
                            '关掉翻译 +50%',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: colors.gold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                LinearProgressIndicator(
                  value: ratio.clamp(0, 1),
                  minHeight: 7,
                  borderRadius: BorderRadius.circular(999),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),

        // 捷径：推荐关 / 待领奖
        if (data.recommendedId != null) ...<Widget>[
          _Shortcut(
            colors: colors,
            icon: Icons.play_circle_rounded,
            title: '继续闯关',
            subtitle: '推荐你下一关',
            onTap: () => context.push('/stages/${data.recommendedId}'),
          ),
          const SizedBox(height: 10),
        ],
        if (data.claimable > 0) ...<Widget>[
          _Shortcut(
            colors: colors,
            icon: Icons.redeem_rounded,
            title: '你有 ${data.claimable} 个奖励待领取',
            subtitle: '通关后别忘了领经验',
            onTap: () {
              final int? target = _firstClaimable(data);
              if (target != null) {
                context.push('/stages/$target');
              }
            },
          ),
          const SizedBox(height: 10),
        ],

        const SizedBox(height: 6),
        GridView.count(
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          childAspectRatio: 0.82,
          children: <Widget>[
            for (int i = 0; i < data.scenes.length; i++)
              _SceneCard(scene: data.scenes[i]),
          ],
        ),
      ],
    );
  }

  int? _firstClaimable(StageOverview data) {
    for (final chapter in data.chapters) {
      for (final stage in chapter.stages) {
        if (stage.cleared && !stage.claimed) {
          return stage.id;
        }
      }
    }
    return null;
  }
}

/// 场景卡：封面 cover + 已通关进度。
class _SceneCard extends StatelessWidget {
  const _SceneCard({required this.scene});

  final StageScene scene;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final bool allCleared = scene.stageCount > 0 && scene.clearedCount >= scene.stageCount;

    return AppCard(
      clip: true,
      padding: EdgeInsets.zero,
      radius: 22,
      onTap: () => context.push('/stages/scene/${scene.id}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          AspectRatio(
            aspectRatio: 16 / 10,
            child: Stack(
              fit: StackFit.expand,
              children: <Widget>[
                StageCover(coverUrl: scene.coverUrl, icon: scene.icon),
                Positioned.fill(
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: <Color>[
                          Colors.black.withValues(alpha: 0.28),
                          Colors.black.withValues(alpha: 0.04),
                        ],
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                      ),
                    ),
                  ),
                ),
                if (allCleared)
                  Positioned(
                    top: 10,
                    right: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: colors.success.withValues(alpha: 0.92),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          Icon(Icons.check_rounded, size: 12, color: Colors.white),
                          SizedBox(width: 3),
                          Text(
                            '已通关',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        scene.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: colors.cardMuted,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        '${(scene.clearedCount / (scene.stageCount == 0 ? 1 : scene.stageCount) * 100).toInt()}%',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: colors.inkSoft,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  '${scene.scriptCount} 个剧本 · ${scene.stageCount} 关',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 11, color: colors.inkFaint),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 顶部捷径卡（推荐关 / 待领奖）。
class _Shortcut extends StatelessWidget {
  const _Shortcut({
    required this.colors,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final AppColors colors;
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressScale(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: <Color>[Color(0xFF0EA5E9), Color(0xFF6366F1)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          children: <Widget>[
            Icon(icon, size: 26, color: Colors.white),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.white.withValues(alpha: 0.82),
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, size: 22, color: Colors.white.withValues(alpha: 0.85)),
          ],
        ),
      ),
    );
  }
}
