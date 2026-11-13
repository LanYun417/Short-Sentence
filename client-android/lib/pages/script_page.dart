/// 剧本详情（路由 /stages/script/:id）：剧本横幅 + 关卡双列卡 + 领奖。
///
/// 与 Web 端 `stages/script/[id].vue` 对齐：每关显示标题 / 角色 / 状态，
/// 通关未领奖的关可就地「领取」，点关卡进入 AI 对话。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../api/api_exception.dart';
import '../api/models/stage.dart';
import '../api/stage_api.dart';
import '../theme.dart';
import '../widgets/app_card.dart';
import '../widgets/press_scale.dart';
import '../widgets/stage_cover.dart';

class ScriptPage extends ConsumerStatefulWidget {
  const ScriptPage({required this.id, super.key});

  final int id;

  @override
  ConsumerState<ScriptPage> createState() => _ScriptPageState();
}

class _ScriptPageState extends ConsumerState<ScriptPage> {
  final Set<int> _claiming = <int>{};

  Future<void> _claim(StageView stage) async {
    if (_claiming.contains(stage.id)) {
      return;
    }
    setState(() => _claiming.add(stage.id));
    try {
      final result = await ref.read(stageApiProvider).claim(stage.id);
      ref.invalidate(stageScriptProvider(widget.id));
      ref.invalidate(stageOverviewProvider);
      if (!mounted) return;
      final gained = result.rewardXp + result.bonusXp;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.alreadyClaimed ? '奖励已领取' : '领取成功 +$gained 经验')),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _claiming.remove(stage.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final AsyncValue<StageScriptDetail> detail =
        ref.watch(stageScriptProvider(widget.id));

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
          data: (StageScriptDetail data) => _build(colors, data),
        ),
      ),
    );
  }

  Widget _build(AppColors colors, StageScriptDetail data) {
    final script = data.script;

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(stageScriptProvider(widget.id)),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
        children: <Widget>[
          _BackBar(colors: colors, label: data.scene.name, onTap: () => context.push('/stages/scene/${data.scene.id}')),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(22),
            child: AspectRatio(
              aspectRatio: 16 / 8,
              child: Stack(
                fit: StackFit.expand,
                children: <Widget>[
                  StageCover(coverUrl: script.coverUrl, icon: 'book'),
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
                          script.name,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${script.stageCount} 关 · 已通关 ${script.clearedCount}'
                          '${script.completed ? ' · 全部通关' : ''}',
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
          if (data.stages.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 48),
              child: Center(
                child: Text('这个剧本还没有关卡…', style: TextStyle(color: colors.inkFaint)),
              ),
            )
          else
            GridView.count(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: 0.86,
              children: <Widget>[
                for (int i = 0; i < data.stages.length; i++)
                  _StageCard(
                    stage: data.stages[i],
                    claiming: _claiming.contains(data.stages[i].id),
                    onOpen: () => context.push('/stages/${data.stages[i].id}', extra: script.id),
                    onClaim: () => _claim(data.stages[i]),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}

/// 关卡卡。
class _StageCard extends StatelessWidget {
  const _StageCard({
    required this.stage,
    required this.claiming,
    required this.onOpen,
    required this.onClaim,
  });

  final StageView stage;
  final bool claiming;
  final VoidCallback onOpen;
  final VoidCallback onClaim;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    final String statusLabel;
    final Color statusColor;
    if (!stage.unlocked) {
      statusLabel = '未解锁';
      statusColor = colors.inkFaint;
    } else if (stage.cleared) {
      statusLabel = stage.claimed ? '已通关' : '待领奖';
      statusColor = stage.claimed ? colors.success : colors.gold;
    } else if (stage.activeSessionId != null) {
      statusLabel = '继续对话';
      statusColor = colors.brand;
    } else {
      statusLabel = '未通关';
      statusColor = colors.inkSoft;
    }

    return AppCard(
      clip: true,
      padding: const EdgeInsets.fromLTRB(13, 13, 13, 13),
      radius: 20,
      onTap: onOpen,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: statusColor,
                  ),
                ),
              ),
              const Spacer(),
              if (stage.rewardXp > 0)
                Icon(Icons.bolt_rounded, size: 14, color: colors.gold),
            ],
          ),
          const SizedBox(height: 9),
          Text(
            stage.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, height: 1.3),
          ),
          const SizedBox(height: 6),
          if (stage.roles.isNotEmpty)
            Row(
              children: <Widget>[
                for (final role in stage.roles)
                  Padding(
                    padding: const EdgeInsets.only(right: 3),
                    child: Text(role.emoji, style: const TextStyle(fontSize: 16)),
                  ),
              ],
            ),
          const Spacer(),
          LinearProgressIndicator(
            value: (stage.progress / 100).clamp(0, 1),
            minHeight: 5,
            borderRadius: BorderRadius.circular(999),
          ),
          const SizedBox(height: 9),
          if (stage.cleared && !stage.claimed)
            SizedBox(
              width: double.infinity,
              height: 34,
              child: FilledButton(
                onPressed: claiming ? null : onClaim,
                style: FilledButton.styleFrom(
                  backgroundColor: colors.gold,
                  foregroundColor: Colors.white,
                  padding: EdgeInsets.zero,
                  textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                ),
                child: claiming
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('领取奖励'),
              ),
            )
          else
            Text(
              stage.unlocked ? '${stage.minTurns} 轮起 · +${stage.rewardXp} 经验' : '通关上一关解锁',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11, color: colors.inkFaint),
            ),
        ],
      ),
    );
  }
}

/// 顶部返回条。
class _BackBar extends StatelessWidget {
  const _BackBar({required this.colors, required this.label, required this.onTap});

  final AppColors colors;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressScale(
      onTap: onTap,
      behavior: HitTestBehavior.deferToChild,
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
