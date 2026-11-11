/// 场景详情（路由 /stages/scene/:id）：场景横幅 + 剧本卡列表。
///
/// 与 Web 端 `stages/scene/[id].vue` 对齐：点场景进入，下面是该场景下的剧本，
/// 点剧本进入关卡列表。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../api/models/stage.dart';
import '../api/stage_api.dart';
import '../theme.dart';
import '../widgets/app_card.dart';
import '../widgets/staggered.dart';
import '../widgets/stage_cover.dart';

class ScenePage extends ConsumerStatefulWidget {
  const ScenePage({required this.id, super.key});

  final int id;

  @override
  ConsumerState<ScenePage> createState() => _ScenePageState();
}

class _ScenePageState extends ConsumerState<ScenePage> {
  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final AsyncValue<StageSceneDetail> detail =
        ref.watch(stageSceneProvider(widget.id));

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        bottom: false,
        child: detail.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (Object error, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: AppCard(
              child: Text('加载失败：$error', style: TextStyle(color: colors.danger)),
            ),
          ),
          data: (StageSceneDetail data) => _build(colors, data),
        ),
      ),
    );
  }

  Widget _build(AppColors colors, StageSceneDetail data) {
    final scene = data.scene;

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(stageSceneProvider(widget.id)),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
        children: <Widget>[
          _BackBar(colors: colors, label: '全部场景'),
          const SizedBox(height: 4),
          // 场景横幅
          ClipRRect(
            borderRadius: BorderRadius.circular(22),
            child: AspectRatio(
              aspectRatio: 16 / 8,
              child: Stack(
                fit: StackFit.expand,
                children: <Widget>[
                  StageCover(coverUrl: scene.coverUrl, icon: scene.icon),
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: <Color>[
                          Colors.black.withValues(alpha: 0.42),
                          Colors.black.withValues(alpha: 0.08),
                        ],
                        begin: Alignment.bottomLeft,
                        end: Alignment.topRight,
                      ),
                    ),
                  ),
                  Positioned(
                    left: 16,
                    bottom: 14,
                    right: 16,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          scene.name,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                            letterSpacing: -0.6,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${scene.scriptCount} 个剧本 · ${scene.stageCount} 关'
                          ' · 已通关 ${scene.clearedCount}',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.white.withValues(alpha: 0.86),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          if (data.scripts.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 48),
              child: Center(
                child: Text('这个场景还没有剧本…', style: TextStyle(color: colors.inkFaint)),
              ),
            )
          else
            for (int i = 0; i < data.scripts.length; i++) ...<Widget>[
              StaggeredEntrance(
                index: i,
                child: _ScriptCard(script: data.scripts[i]),
              ),
              const SizedBox(height: 12),
            ],
        ],
      ),
    );
  }
}

/// 剧本卡。
class _ScriptCard extends StatelessWidget {
  const _ScriptCard({required this.script});

  final StageScript script;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final bool done = script.completed;

    return AppCard(
      clip: true,
      padding: EdgeInsets.zero,
      radius: 20,
      onTap: () => context.push('/stages/script/${script.id}'),
      child: Row(
        children: <Widget>[
          SizedBox(
            width: 96,
            height: 96,
            child: StageCover(coverUrl: script.coverUrl, icon: 'book'),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: Text(
                          script.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      if (done)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            color: colors.success.withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            '已通关',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: colors.success,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 5),
                  Text(
                    script.blurb,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 11.5, height: 1.5, color: colors.inkSoft),
                  ),
                  const SizedBox(height: 7),
                  Text(
                    '${script.stageCount} 关 · 已通关 ${script.clearedCount}',
                    style: TextStyle(fontSize: 11, color: colors.inkFaint),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 顶部返回条。
class _BackBar extends StatelessWidget {
  const _BackBar({required this.colors, required this.label});

  final AppColors colors;
  final String label;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.pop(),
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(0, 8, 0, 4),
        child: Row(
          children: <Widget>[
            Icon(Icons.chevron_left_rounded, size: 18, color: colors.inkSoft),
            Text(label, style: TextStyle(fontSize: 12, color: colors.inkSoft)),
          ],
        ),
      ),
    );
  }
}
