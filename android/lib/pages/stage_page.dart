/// 情景闯关页（路由 /stages）：关卡挂在剧本下（场景 → 剧本 → 关卡）。
///
/// 数据来自 GET /client/stages（需登录）。每个剧本首关默认解锁、剧本内顺序解锁，
/// 剧本之间平行；点「去练习」把刷题页切到该关卡所属场景（stage.categoryId）并回到首页 Tab。
///
/// 进度由后端 `study_stage_progress` 表维护（不从答题记录派生）：
/// 答题记录只保留 30 天，派生会让通关进度倒退、关卡重新上锁。
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../api/api_exception.dart';
import '../api/models/stage.dart';
import '../api/stage_api.dart';
import '../state/growth_controller.dart';
import '../state/quiz_controller.dart';
import '../state/shell_controller.dart';
import '../theme.dart';
import '../theme/icon_map.dart';
import '../widgets/app_card.dart';
import '../widgets/page_header.dart';

class StagePage extends ConsumerStatefulWidget {
  const StagePage({super.key});

  @override
  ConsumerState<StagePage> createState() => _StagePageState();
}

class _StagePageState extends ConsumerState<StagePage> {
  /// 正在领奖的关卡 id（防连点）
  int? _claiming;

  Future<void> _claim(StageView stage) async {
    if (_claiming != null) return;
    setState(() => _claiming = stage.id);
    try {
      final result = await ref.read(stageApiProvider).claim(stage.id);
      if (!mounted) return;
      ref.invalidate(stageOverviewProvider);
      // 经验变了，成长页概览一起刷，切回去不会显示旧 XP
      if (ref.read(growthControllerProvider).loaded) {
        unawaited(ref.read(growthControllerProvider.notifier).refresh());
      }
      final text = result.alreadyClaimed
          ? '这一关的奖励已经领过了'
          : result.awarded
          ? '领取成功，+${result.rewardXp} XP'
          : '今日经验已达上限，明天再来领取';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _claiming = null);
    }
  }

  /// 去闯关：锁定该场景，回到首页（刷题 Tab）。
  void _practice(StageView stage) {
    unawaited(ref.read(quizControllerProvider.notifier).setCategory(stage.categoryId));
    ref.read(shellControllerProvider.notifier).go(0);
    context.go('/');
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final overviewAsync = ref.watch(stageOverviewProvider);

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(stageOverviewProvider),
          child: overviewAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (Object error, _) => ListView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
              children: <Widget>[
                const PageHeader(title: '情景闯关'),
                AppCard(child: Text('加载失败：$error', style: TextStyle(color: colors.danger))),
              ],
            ),
            data: (StageOverview overview) => ListView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
              children: <Widget>[
                PageHeader(
                  title: '情景闯关',
                  subtitle: '已通关 ${overview.clearedStages} / ${overview.totalStages}'
                      '${overview.claimable > 0 ? ' · ${overview.claimable} 个奖励待领取' : ''}',
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 0, 4, 16),
                  child: Text(
                    '一个场景就是一关。在该场景答对够数，故事就往前走一段——四章可以任选起点。',
                    style: TextStyle(fontSize: 12, height: 1.6, color: colors.inkSoft),
                  ),
                ),
                for (final StageChapter chapter in overview.chapters) ...<Widget>[
                  _ChapterHeader(chapter: chapter),
                  const SizedBox(height: 10),
                  for (int i = 0; i < chapter.stages.length; i++)
                    _StageRow(
                      stage: chapter.stages[i],
                      isLast: i == chapter.stages.length - 1,
                      claiming: _claiming == chapter.stages[i].id,
                      onClaim: () => _claim(chapter.stages[i]),
                      onPractice: () => _practice(chapter.stages[i]),
                    ),
                  const SizedBox(height: 22),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ChapterHeader extends StatelessWidget {
  const _ChapterHeader({required this.chapter});

  final StageChapter chapter;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(left: 4, right: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  chapter.name,
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: colors.ink),
                ),
              ),
              Text(
                '${chapter.clearedCount} / ${chapter.total}',
                style: TextStyle(fontSize: 11, color: colors.inkFaint),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            chapter.subtitle,
            style: TextStyle(fontSize: 11.5, height: 1.5, color: colors.inkSoft),
          ),
        ],
      ),
    );
  }
}

class _StageRow extends StatelessWidget {
  const _StageRow({
    required this.stage,
    required this.isLast,
    required this.claiming,
    required this.onClaim,
    required this.onPractice,
  });

  final StageView stage;
  final bool isLast;
  final bool claiming;
  final VoidCallback onClaim;
  final VoidCallback onPractice;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final locked = !stage.unlocked;
    final accent = stage.cleared
        ? colors.success
        : locked
        ? colors.inkFaint
        : colors.brand;

    return Opacity(
      opacity: locked ? 0.62 : 1,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          // 时间轴：圆角方块 + 向下的连线
          SizedBox(
            width: 40,
            child: Column(
              children: <Widget>[
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: locked ? colors.cardMuted : accent,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    stage.cleared
                        ? Icons.check_rounded
                        : locked
                        ? Icons.lock_rounded
                        : appIcon(stage.icon),
                    size: 20,
                    color: locked ? colors.inkFaint : Colors.white,
                  ),
                ),
                if (!isLast)
                  Container(
                    width: 1,
                    height: 60,
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    color: colors.line,
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: AppCard(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
              radius: 18,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(
                              stage.nameEn == null || stage.nameEn!.isEmpty
                                  ? stage.name
                                  : '${stage.name} · ${stage.nameEn}',
                              style: TextStyle(fontSize: 10.5, color: colors.inkFaint),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              stage.title,
                              style: TextStyle(
                                fontSize: 14.5,
                                fontWeight: FontWeight.w700,
                                color: colors.ink,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (stage.cleared || locked)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: stage.cleared
                                ? colors.success.withValues(alpha: 0.12)
                                : colors.cardMuted,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            stage.cleared ? '已通关' : '未解锁',
                            style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w600,
                              color: stage.cleared ? colors.success : colors.inkFaint,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 7),
                  Text(
                    stage.cleared
                        ? stage.outro
                        : stage.unlocked
                        ? stage.intro
                        : '通关上一关，这一页才会翻开。',
                    style: TextStyle(fontSize: 12, height: 1.6, color: colors.inkSoft),
                  ),
                  if (stage.unlocked) ...<Widget>[
                    const SizedBox(height: 10),
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(20),
                            child: LinearProgressIndicator(
                              value: stage.progress / 100,
                              minHeight: 6,
                              backgroundColor: colors.cardMuted,
                              valueColor: AlwaysStoppedAnimation<Color>(accent),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${stage.correctCount} / ${stage.target} 句',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: colors.inkSoft,
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 10),
                  Row(
                    children: <Widget>[
                      Text(
                        '+${stage.rewardXp} XP',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: colors.gold,
                        ),
                      ),
                      const Spacer(),
                      _action(context, colors),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _action(BuildContext context, AppColors colors) {
    if (stage.cleared && !stage.claimed) {
      return _ActionButton(
        label: '领取奖励',
        icon: Icons.card_giftcard_rounded,
        busy: claiming,
        onTap: onClaim,
      );
    }
    if (stage.cleared) {
      return Text('奖励已领取', style: TextStyle(fontSize: 11, color: colors.success));
    }
    if (stage.unlocked && stage.bankCount > 0) {
      return _ActionButton(
        label: '去闯关',
        icon: Icons.arrow_forward_rounded,
        busy: false,
        onTap: onPractice,
      );
    }
    if (stage.unlocked) {
      return Text('该场景题目准备中', style: TextStyle(fontSize: 11, color: colors.inkFaint));
    }
    return Text('通关上一关解锁', style: TextStyle(fontSize: 11, color: colors.inkFaint));
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.label,
    required this.icon,
    required this.busy,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return InkWell(
      onTap: busy ? null : onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: colors.brand.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            if (busy)
              SizedBox(
                width: 12,
                height: 12,
                child: CircularProgressIndicator(strokeWidth: 2, color: colors.brand),
              )
            else
              Icon(icon, size: 13, color: colors.brand),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: colors.brand),
            ),
          ],
        ),
      ),
    );
  }
}
