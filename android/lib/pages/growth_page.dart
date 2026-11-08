/// 成长页：等级 / XP / 连续打卡 / 成就墙 / 场景地图 / 句签册。
///
/// 版式逻辑：**先给身份，再给细节**。顶部渐变卡回答「我现在几级、还差多少」，
/// 下面的白卡再展开成就与场景——一屏之内不出现第二个渐变块，避免抢焦点。
library;

import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/auth_api.dart';
import '../api/models/growth.dart';
import '../state/card_controller.dart';
import '../state/growth_controller.dart';
import '../theme.dart';
import '../theme/icon_map.dart';
import '../widgets/app_card.dart';
import '../widgets/count_up.dart';
import '../widgets/empty_state.dart';
import '../widgets/page_header.dart';
import '../widgets/press_scale.dart';
import '../widgets/shimmer.dart';
import '../widgets/staggered.dart';
import '../sheets/claim_card.dart';
import '../sheets/sentence_card_sheet.dart';
import '../api/models/memory_stats.dart';
import '../api/models/memory_galaxy.dart';
import '../api/questions_api.dart';

class GrowthPage extends ConsumerStatefulWidget {
  const GrowthPage({super.key});

  @override
  ConsumerState<GrowthPage> createState() => _GrowthPageState();
}

class _GrowthPageState extends ConsumerState<GrowthPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // 强制刷新：「我的」页会先拉一次成长概览，而成就可能在之后才解锁
      //（答题发放 / 排行榜名次型成就是旁路发放）。沿用缓存会显示「已解锁 0/N」，
      // 所以进入成长页一律重拉一次，保证新勋章立刻可见。
      ref.read(growthControllerProvider.notifier).refresh();
      ref.read(cardControllerProvider.notifier).load();
    });
  }

  Future<void> _refresh() async {
    // 记忆概览与星系随成长页一起刷新（答题后星点亮度/数量会变）
    ref.invalidate(memoryStatsProvider);
    ref.invalidate(memoryGalaxyProvider);
    await Future.wait(<Future<void>>[
      ref.read(growthControllerProvider.notifier).refresh(),
      ref.read(cardControllerProvider.notifier).refresh(),
    ]);
  }

  /// 全部成就（首页只放前 6 个，剩下的收进弹窗）。
  void _showAllAchievements(List<AchievementView> items) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _AllAchievementsSheet(items: items),
    );
  }

  @override
  Widget build(BuildContext context) {
    final growth = ref.watch(growthControllerProvider);
    final cards = ref.watch(cardControllerProvider);

    return Material(
      color: Colors.transparent,
      child: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            PageHeader(
              title: '成长',
              subtitle: '每一句都算数',
              trailing: _StreakChip(streak: growth.today?.streak ?? 0),
            ),
            Expanded(
              child: growth.loading && !growth.loaded
                  ? const _GrowthSkeleton()
                  : growth.error != null && !growth.loaded
                  ? EmptyState(
                      title: '加载失败',
                      message: growth.error,
                      tone: EmptyTone.error,
                      actionLabel: '重试',
                      onAction: () =>
                          ref.read(growthControllerProvider.notifier).refresh(),
                    )
                  : RefreshIndicator(
                      color: context.colors.brand,
                      onRefresh: _refresh,
                      child: ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(16, 2, 16, 108),
                        children: <Widget>[
                          StaggeredEntrance(
                            index: 0,
                            child: _LevelHero(
                              xp: growth.xp,
                              level: growth.level,
                              today: growth.today,
                              unlockedAchievements:
                                  growth.overview?.unlockedAchievements ?? 0,
                              totalAchievements:
                                  growth.overview?.totalAchievements ?? 0,
                            ),
                          ),
                          const SizedBox(height: 14),
                          ref.watch(memoryStatsProvider).when(
                            data: (stats) => _MemoryHealthCard(stats: stats),
                            loading: () => const SizedBox.shrink(),
                            error: (_, _) => const SizedBox.shrink(),
                          ),
                          const SizedBox(height: 14),
                          ref.watch(memoryGalaxyProvider).when(
                            data: (galaxy) => _MemoryGalaxyCard(galaxy: galaxy),
                            loading: () => const SizedBox.shrink(),
                            error: (_, _) => const SizedBox.shrink(),
                          ),
                          const SizedBox(height: 14),
                          if (cards.claimable &&
                              (growth.today?.completed ?? false)) ...<Widget>[
                            StaggeredEntrance(
                              index: 1,
                              child: _ClaimCardBanner(
                                busy: cards.claiming,
                                onClaim: () => claimTodayCard(context, ref),
                              ),
                            ),
                            const SizedBox(height: 14),
                          ],
                          const SizedBox(height: 6),
                          SectionHeader(
                            title: '成就',
                            subtitle: growth.overview == null
                                ? null
                                : '已解锁 ${growth.overview!.unlockedAchievements} / ${growth.overview!.totalAchievements}',
                            icon: Icons.emoji_events_rounded,
                            index: 2,
                            actionLabel: growth.achievements.length > 6
                                ? '全部'
                                : null,
                            onAction: growth.achievements.length > 6
                                ? () =>
                                      _showAllAchievements(growth.achievements)
                                : null,
                          ),
                          // 只展示前 6 个：10 个全铺开要占四行，
                          // 会把场景地图与句签墙压到两屏之外，首页节奏就散了
                          _AchievementGrid(
                            items: growth.achievements.take(6).toList(),
                          ),
                          const SizedBox(height: 20),
                          SectionHeader(
                            title: '场景地图',
                            subtitle: growth.overview == null
                                ? null
                                : '已点亮 ${growth.overview!.unlockedScenes} 个场景',
                            icon: Icons.explore_rounded,
                            index: 4,
                          ),
                          _SceneMap(items: growth.scenes),
                          const SizedBox(height: 20),
                          SectionHeader(
                            title: '我的句签',
                            subtitle: cards.mine.isEmpty
                                ? '达标后领取，收进册子'
                                : '共 ${cards.mine.length} 张',
                            icon: Icons.auto_awesome_rounded,
                            index: 6,
                          ),
                          _CardWall(
                            cards: cards.mine,
                            onTap: (card) => showSentenceCard(context, card),
                          ),
                          SizedBox(height: cards.mine.isEmpty ? 8 : 4),
                        ],
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

/* ------------------------------ 顶部等级卡 ------------------------------ */

class _LevelHero extends StatelessWidget {
  const _LevelHero({
    required this.xp,
    required this.level,
    required this.today,
    required this.unlockedAchievements,
    required this.totalAchievements,
  });

  final int xp;
  final LevelInfo? level;
  final CheckinToday? today;
  final int unlockedAchievements;
  final int totalAchievements;

  @override
  Widget build(BuildContext context) {
    final info = level;
    final progress = (info?.progress ?? 0) / 100;

    return GradientCard(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
      gradient: const LinearGradient(
        colors: <Color>[
          Color(0xFF4F46E5),
          Color(0xFF7C3AED),
          Color(0xFF6366F1),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      shadow: const Color(0xFF6D28D9),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              _LevelRing(
                progress: progress,
                name: info?.name ?? '入门',
                isMax: info?.isMax ?? false,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      info == null ? '正在读取等级…' : '累计经验',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.2,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: <Widget>[
                        CountUpText(
                          value: xp,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 32,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -1,
                            height: 1,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'XP',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.7),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      info == null
                          ? ''
                          : info.isMax
                          ? '已达最高等级'
                          : '距${info.nextName ?? '下一等级'}还需 ${info.toNext} XP',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.68),
                        fontSize: 11.5,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: TweenAnimationBuilder<double>(
              tween: Tween<double>(end: progress.clamp(0.0, 1.0)),
              duration: Motion.reduced(context)
                  ? Duration.zero
                  : const Duration(milliseconds: 900),
              curve: Motion.decelerate,
              builder: (context, value, _) => LinearProgressIndicator(
                value: value,
                minHeight: 6,
                backgroundColor: Colors.white.withValues(alpha: 0.22),
                valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: <Widget>[
              _HeroStat(
                icon: Icons.check_circle_rounded,
                label: '今日',
                value: '${today?.doneCount ?? 0}/${today?.goalCount ?? 0}',
              ),
              _divider(),
              _HeroStat(
                icon: Icons.local_fire_department_rounded,
                label: '连续',
                value: '${today?.streak ?? 0} 天',
              ),
              _divider(),
              _HeroStat(
                icon: Icons.workspace_premium_rounded,
                label: '成就',
                value: '$unlockedAchievements/$totalAchievements',
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _divider() => Container(
    width: 1,
    height: 26,
    margin: const EdgeInsets.symmetric(horizontal: 12),
    color: Colors.white.withValues(alpha: 0.16),
  );
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Row(
        children: <Widget>[
          Icon(icon, size: 15, color: Colors.white.withValues(alpha: 0.72)),
          const SizedBox(width: 6),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                label,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.55),
                  fontSize: 10,
                  height: 1.2,
                ),
              ),
              Text(
                value,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// 等级环：进度弧 + 中心等级码。
class _LevelRing extends StatelessWidget {
  const _LevelRing({
    required this.progress,
    required this.name,
    required this.isMax,
  });

  final double progress;

  /// 等级名称（入门 / 基础 / 进阶 / 高阶 / 精通 / 母语级）。
  /// 不显示 CEFR 代码（A1/B1…）——对用户没有意义。
  final String name;
  final bool isMax;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 74,
      height: 74,
      child: TweenAnimationBuilder<double>(
        tween: Tween<double>(end: progress.clamp(0.0, 1.0)),
        duration: Motion.reduced(context)
            ? Duration.zero
            : const Duration(milliseconds: 1100),
        curve: Motion.decelerate,
        builder: (context, value, _) => CustomPaint(
          painter: _RingPainter(progress: value, complete: isMax),
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                Text(
                  name,
                  style: TextStyle(
                    color: Colors.white,
                    // 「母语级」三个字要小一号才塞得进圆环
                    fontSize: name.length > 2 ? 14 : 18,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.4,
                    height: 1.1,
                  ),
                ),
                Text(
                  'LEVEL',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.5),
                    fontSize: 7,
                    letterSpacing: 1.2,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.progress, required this.complete});

  final double progress;
  final bool complete;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 6.0;
    final rect = Offset.zero & size;
    final center = rect.center;
    final radius = (size.shortestSide - stroke) / 2;

    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = Colors.white.withValues(alpha: 0.2);
    canvas.drawCircle(center, radius, track);

    if (progress <= 0) {
      return;
    }

    final arcPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..shader = SweepGradient(
        startAngle: -1.5707963,
        endAngle: 4.712389,
        colors: complete
            ? const <Color>[
                Color(0xFFFDE68A),
                Color(0xFFFBBF24),
                Color(0xFFFDE68A),
              ]
            : const <Color>[
                Color(0xCCFFFFFF),
                Color(0xFFFFFFFF),
                Color(0xFFFDE68A),
              ],
      ).createShader(rect);

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -1.5707963,
      6.2831853 * progress,
      false,
      arcPaint,
    );
  }

  @override
  bool shouldRepaint(covariant _RingPainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.complete != complete;
}

/* ------------------------------ 连续打卡徽标 ------------------------------ */

class _StreakChip extends StatelessWidget {
  const _StreakChip({required this.streak});

  final int streak;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final active = streak > 0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: (active ? colors.gold : colors.inkFaint).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(
            Icons.local_fire_department_rounded,
            size: 17,
            color: active ? colors.gold : colors.inkFaint,
          ),
          const SizedBox(width: 4),
          Text(
            '$streak 天',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: active ? colors.gold : colors.inkFaint,
            ),
          ),
        ],
      ),
    );
  }
}

/* ------------------------------ 领取句签入口 ------------------------------ */

class _ClaimCardBanner extends StatelessWidget {
  const _ClaimCardBanner({required this.busy, required this.onClaim});

  final bool busy;
  final VoidCallback onClaim;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return PressScale(
      onTap: busy ? null : onClaim,
      scale: 0.98,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          gradient: LinearGradient(
            colors: <Color>[
              colors.gold.withValues(alpha: 0.16),
              const Color(0xFFF97316).withValues(alpha: 0.10),
            ],
          ),
          border: Border.all(color: colors.gold.withValues(alpha: 0.35)),
        ),
        child: Row(
          children: <Widget>[
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: <Color>[colors.gold, const Color(0xFFF97316)],
                ),
                boxShadow: <BoxShadow>[
                  BoxShadow(
                    color: colors.gold.withValues(alpha: 0.35),
                    blurRadius: 14,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              child: const Icon(
                Icons.auto_awesome_rounded,
                color: Colors.white,
                size: 22,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    '今日句签可以领了',
                    style: Theme.of(context).textTheme.titleSmall
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '完成后领取，收进你的句签册',
                    style: Theme.of(context).textTheme.labelSmall
                        ?.copyWith(color: colors.inkSoft),
                  ),
                ],
              ),
            ),
            if (busy)
              const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            else
              Icon(Icons.chevron_right_rounded, color: colors.gold),
          ],
        ),
      ),
    );
  }
}

/// 记忆健康概览（遗忘曲线 / 待复习分布可视化）。
final memoryStatsProvider = FutureProvider<MemoryStats>((ref) async {
  final api = ref.watch(questionsApiProvider);
  return api.getMemoryStats();
});

class _MemoryHealthCard extends StatelessWidget {
  const _MemoryHealthCard({required this.stats});
  final MemoryStats stats;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final theme = Theme.of(context);
    final hint = theme.textTheme.bodySmall?.color;
    final maxDist = stats.distribution.isEmpty
        ? 1
        : stats.distribution.reduce((a, b) => a > b ? a : b);
    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Text('记忆巩固',
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w700)),
              const Spacer(),
              Text('你的遗忘曲线',
                  style: theme.textTheme.labelSmall?.copyWith(color: hint)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: <Widget>[
              _MemoryStat(value: '${stats.reviewed}', label: '已复习', color: colors.brand),
              _MemoryStat(value: '${stats.graduated}', label: '已毕业', color: Colors.green),
              _MemoryStat(value: '${stats.dueToday}', label: '今日待复习', color: Colors.orange),
              _MemoryStat(value: '${stats.dueIn7}', label: '7天待复习', color: Colors.indigo),
            ],
          ),
          const SizedBox(height: 14),
          Text('未来 30 天复习分布',
              style: theme.textTheme.labelSmall?.copyWith(color: hint)),
          const SizedBox(height: 6),
          SizedBox(
            height: 56,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: <Widget>[
                for (var i = 0; i < stats.distribution.length; i++)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 0.5),
                      child: Container(
                        height: maxDist == 0
                            ? 0
                            : (stats.distribution[i] / maxDist) * 54,
                        decoration: BoxDecoration(
                          color: colors.brand.withValues(alpha: 0.55),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Text('记忆保留率（每复习一次即被拉平）',
              style: theme.textTheme.labelSmall?.copyWith(color: hint)),
          const SizedBox(height: 6),
          SizedBox(
            height: 56,
            child: CustomPaint(
              size: const Size(double.infinity, 56),
              painter: _RetentionPainter(
                points: stats.retentionCurve,
                color: Colors.indigo,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MemoryStat extends StatelessWidget {
  const _MemoryStat({
    required this.value,
    required this.label,
    required this.color,
  });
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Column(
          children: <Widget>[
            Text(value,
                style: TextStyle(
                    fontSize: 18, fontWeight: FontWeight.bold, color: color)),
            const SizedBox(height: 2),
            Text(label,
                style: Theme.of(context)
                    .textTheme
                    .labelSmall
                    ?.copyWith(color: Theme.of(context).textTheme.bodySmall?.color)),
          ],
        ),
      );
}

class _RetentionPainter extends CustomPainter {
  const _RetentionPainter({required this.points, required this.color});
  final List<RetentionPoint> points;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;
    final paint = Paint()
      ..color = color.withValues(alpha: 0.85)
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    final path = Path();
    for (var i = 0; i < points.length; i++) {
      final x = (points[i].day / 30) * size.width;
      final y = size.height - points[i].retention * (size.height - 6) - 3;
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _RetentionPainter old) => false;
}

/* ------------------------------ 记忆星系 ------------------------------ */

/// 记忆星系数据（与记忆巩固互补：一个讲趋势，一个讲收藏感）。
final memoryGalaxyProvider = FutureProvider<MemoryGalaxy>((ref) async {
  final api = ref.watch(questionsApiProvider);
  return api.getMemoryGalaxy();
});

class _MemoryGalaxyCard extends StatelessWidget {
  const _MemoryGalaxyCard({required this.galaxy});

  final MemoryGalaxy galaxy;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hint = theme.textTheme.bodySmall?.color;
    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Text('记忆星系',
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w700)),
              const Spacer(),
              Text('每一句都是一颗星',
                  style: theme.textTheme.labelSmall?.copyWith(color: hint)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: <Widget>[
              _MemoryStat(
                  value: '${galaxy.litClusters}/${galaxy.totalClusters}',
                  label: '已点亮星座',
                  color: Colors.lightBlue),
              _MemoryStat(
                  value: '${galaxy.graduated}',
                  label: '毕业之星',
                  color: Colors.amber),
              _MemoryStat(
                  value: '${galaxy.dueCount}',
                  label: '该复习了',
                  color: Colors.orange),
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: AspectRatio(
              aspectRatio: 1,
              child: CustomPaint(painter: _GalaxyPainter(galaxy: galaxy)),
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 12,
            runSpacing: 4,
            children: const <Widget>[
              _GalaxyLegend(color: Color(0xFFFBBF24), label: '已毕业'),
              _GalaxyLegend(color: Color(0xFF7DD3FC), label: '记忆稳固'),
              _GalaxyLegend(color: Color(0xFFFB923C), label: '到期该复习'),
            ],
          ),
        ],
      ),
    );
  }
}

class _GalaxyLegend extends StatelessWidget {
  const _GalaxyLegend({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: Theme.of(context).textTheme.bodySmall?.color),
          ),
        ],
      );
}

/// 星空自绘：坐标 / 颜色 / 亮度全部来自后端，与 Web 端同一套数据。
/// 这里不加入闪烁动画（静态星图功耗更低，也不需要在 Widget 测试里关循环动画）。
class _GalaxyPainter extends CustomPainter {
  const _GalaxyPainter({required this.galaxy});

  final MemoryGalaxy galaxy;

  static const Color _gold = Color(0xFFFBBF24);
  static const Color _stable = Color(0xFF7DD3FC);
  static const Color _faded = Color(0xFFFB923C);

  Color _tone(String tone) {
    if (tone == 'gold') return _gold;
    if (tone == 'faded') return _faded;
    return _stable;
  }

  void _drawLabel(Canvas canvas, String text, double x, double y, Color color) {
    final tp = TextPainter(
      text: TextSpan(text: text, style: TextStyle(fontSize: 7.5, color: color)),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, Offset(x - tp.width / 2, y));
  }

  @override
  void paint(Canvas canvas, Size size) {
    final bg = Paint()
      ..shader = ui.Gradient.radial(
        Offset(size.width * 0.5, size.height * 0.45),
        size.width * 0.72,
        const <Color>[
          Color(0xFF1B2450),
          Color(0xFF111832),
          Color(0xFF080C1A),
        ],
        const <double>[0.0, 0.6, 1.0],
      );
    canvas.drawRect(Offset.zero & size, bg);

    // 背景星尘：与 Web 端同 seed 同算法，纯装饰
    var seed = 20261108;
    double rnd() {
      seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
      return seed / 4294967296;
    }

    for (var i = 0; i < 70; i++) {
      final x = rnd() * size.width;
      final y = rnd() * size.height;
      final r = 0.35 + rnd() * 0.75;
      final o = 0.12 + rnd() * 0.35;
      canvas.drawCircle(
        Offset(x, y),
        r,
        Paint()..color = const Color(0xFFCBD5E1).withValues(alpha: o),
      );
    }

    // 星座轮廓：点亮为实线圈、未探索为虚线圈
    for (final c in galaxy.clusters) {
      final center = Offset(c.x * size.width, c.y * size.height);
      final ring = 12.0 + math.min(26.0, c.starCount * 1.6);
      final lit = c.starCount > 0;
      final ringPaint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 0.8
        ..color = lit
            ? const Color(0xFF60A5FA).withValues(alpha: 0.22)
            : const Color(0xFF475569).withValues(alpha: 0.16);
      if (lit) {
        canvas.drawCircle(center, ring, ringPaint);
      } else {
        // 12 段弧隔段绘制 = 虚线圈，表示「待探索」
        const segments = 12;
        for (var k = 0; k < segments; k += 2) {
          canvas.drawArc(
            Rect.fromCircle(center: center, radius: ring),
            k * 2 * math.pi / segments,
            2 * math.pi / segments,
            false,
            ringPaint,
          );
        }
      }
      _drawLabel(
        canvas,
        c.name,
        center.dx,
        math.min(size.height - 10, center.dy + ring + 10),
        lit ? const Color(0xFF94A3B8) : const Color(0xFF475569),
      );
    }

    // 记忆星：光晕 + 实心核
    for (final s in galaxy.stars) {
      final center = Offset(s.x * size.width, s.y * size.height);
      final r = s.radius * 1.35;
      final color = _tone(s.tone);
      if (s.tone == 'gold' || s.radius > 2.6) {
        canvas.drawCircle(
          center,
          r * 2.4,
          Paint()..color = color.withValues(alpha: 0.13),
        );
      }
      canvas.drawCircle(
        center,
        r,
        Paint()..color = color.withValues(alpha: 0.35 + s.brightness * 0.65),
      );
    }

    if (galaxy.stars.isEmpty) {
      final tp = TextPainter(
        text: const TextSpan(
          text: '星空还是空的，去练第一句吧',
          style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas,
          Offset((size.width - tp.width) / 2, size.height / 2));
    }
  }

  @override
  bool shouldRepaint(covariant _GalaxyPainter old) => old.galaxy != galaxy;
}

/* ------------------------------ 成就墙 ------------------------------ */

class _AchievementGrid extends StatelessWidget {
  const _AchievementGrid({required this.items});

  final List<AchievementView> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const AppCard(
        child: SizedBox(height: 96, child: Center(child: Text('成就正在准备中'))),
      );
    }
    return GridView.builder(
      shrinkWrap: true,
      padding: EdgeInsets.zero,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 0.92,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) => StaggeredEntrance(
        index: 3 + index,
        child: _AchievementTile(item: items[index]),
      ),
    );
  }
}

class _AchievementTile extends StatelessWidget {
  const _AchievementTile({required this.item});

  final AchievementView item;

  void _showDetail(BuildContext context) {
    final colors = context.colors;
    showModalBottomSheet<void>(
      context: context,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 4, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: item.unlocked
                    ? const LinearGradient(
                        colors: <Color>[Color(0xFFFBBF24), Color(0xFFF97316)],
                      )
                    : null,
                color: item.unlocked ? null : colors.cardMuted,
              ),
              child: Icon(
                item.unlocked ? appIcon(item.icon) : Icons.lock_rounded,
                size: 28,
                color: item.unlocked ? Colors.white : colors.inkFaint,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              item.name,
              style: Theme.of(sheetContext).textTheme.titleMedium,
            ),
            const SizedBox(height: 6),
            Text(
              item.description,
              textAlign: TextAlign.center,
              style: Theme.of(sheetContext).textTheme.bodySmall
                  ?.copyWith(color: colors.inkSoft, height: 1.6),
            ),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                Pill(
                  label: item.unlocked ? '已解锁' : '未解锁',
                  background: (item.unlocked ? colors.success : colors.inkFaint)
                      .withValues(alpha: 0.1),
                  foreground: item.unlocked ? colors.success : colors.inkFaint,
                ),
                const SizedBox(width: 8),
                Pill(
                  label: '+${item.rewardXp} XP',
                  background: colors.gold.withValues(alpha: 0.1),
                  foreground: colors.gold,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final unlocked = item.unlocked;
    return PressScale(
      onTap: () => _showDetail(context),
      scale: 0.95,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
        decoration: BoxDecoration(
          color: unlocked
              ? colors.card
              : colors.cardMuted.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: unlocked ? colors.gold.withValues(alpha: 0.35) : colors.line,
          ),
          boxShadow: unlocked
              ? <BoxShadow>[
                  BoxShadow(
                    color: colors.gold.withValues(alpha: 0.12),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ]
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: unlocked
                    ? const LinearGradient(
                        colors: <Color>[Color(0xFFFBBF24), Color(0xFFF97316)],
                      )
                    : null,
                color: unlocked ? null : colors.card,
              ),
              child: Icon(
                unlocked ? appIcon(item.icon) : Icons.lock_rounded,
                size: 19,
                color: unlocked ? Colors.white : colors.inkFaint,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              item.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: unlocked ? FontWeight.w600 : FontWeight.w500,
                color: unlocked ? colors.ink : colors.inkFaint,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/* ------------------------------ 场景地图 ------------------------------ */

class _SceneMap extends StatelessWidget {
  const _SceneMap({required this.items});

  final List<SceneMapItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return AppCard(
        child: SizedBox(height: 72, child: Center(child: Text('暂无场景数据'))),
      );
    }
    return SizedBox(
      height: 120,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        padding: const EdgeInsets.symmetric(vertical: 2),
        itemCount: items.length,
        separatorBuilder: (context, index) => const SizedBox(width: 10),
        itemBuilder: (context, index) => StaggeredEntrance(
          index: 5 + index,
          offset: const Offset(18, 0),
          child: _SceneCard(item: items[index]),
        ),
      ),
    );
  }
}

class _SceneCard extends StatelessWidget {
  const _SceneCard({required this.item});

  final SceneMapItem item;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final unlocked = item.unlocked;
    return Container(
      width: 124,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.line.withValues(alpha: 0.8)),
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: colors.shadow.withValues(alpha: 0.05),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(13),
              gradient: unlocked
                  ? LinearGradient(
                      colors: <Color>[
                        colors.brand.withValues(alpha: 0.9),
                        const Color(0xFF8B5CF6).withValues(alpha: 0.9),
                      ],
                    )
                  : null,
              color: unlocked ? null : colors.cardMuted,
            ),
            child: Icon(
              unlocked ? appIcon(item.icon) : Icons.lock_outline_rounded,
              size: 19,
              color: unlocked ? Colors.white : colors.inkFaint,
            ),
          ),
          const Spacer(),
          Text(
            item.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: unlocked ? colors.ink : colors.inkSoft,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            unlocked ? '练过 ${item.practicedCount} 句' : '还没去过',
            style: TextStyle(fontSize: 10.5, color: colors.inkFaint),
          ),
        ],
      ),
    );
  }
}

/* ------------------------------ 句签墙 ------------------------------ */

class _CardWall extends StatelessWidget {
  const _CardWall({required this.cards, required this.onTap});

  final List<SentenceCard> cards;
  final ValueChanged<SentenceCard> onTap;

  @override
  Widget build(BuildContext context) {
    if (cards.isEmpty) {
      return AppCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        child: Row(
          children: <Widget>[
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: context.colors.gold.withValues(alpha: 0.12),
              ),
              child: Icon(
                Icons.auto_awesome_rounded,
                size: 20,
                color: context.colors.gold,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                '完成今日目标后可以领取第一张句签',
                style: Theme.of(context).textTheme.bodySmall
                    ?.copyWith(color: context.colors.inkSoft),
              ),
            ),
          ],
        ),
      );
    }
    // 两列网格，与网页端 profile 的句签墙一致（grid-cols-2 + 浅色磁贴）
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 10.0;
        final tileWidth = (constraints.maxWidth - gap) / 2;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: <Widget>[
            for (var i = 0; i < cards.length; i++)
              StaggeredEntrance(
                index: 7 + i,
                offset: const Offset(0, 14),
                child: SizedBox(
                  width: tileWidth,
                  child: PressScale(
                    onTap: () => onTap(cards[i]),
                    scale: 0.97,
                    child: _CardTile(card: cards[i]),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _CardTile extends StatelessWidget {
  const _CardTile({required this.card});

  final SentenceCard card;

  @override
  Widget build(BuildContext context) {
    // 色板与网页端 profile 的句签墙磁贴一致（slate-50 底 / slate-200 环）
    const Color tileBg = Color(0xFFF8FAFC);
    const Color tileRing = Color(0xFFE2E8F0);
    const Color imageBg = Color(0xFFF1F5F9);
    const Color titleColor = Color(0xFF1E293B);
    const Color dateColor = Color(0xFF94A3B8);

    return Container(
      decoration: BoxDecoration(
        color: tileBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tileRing),
      ),
      // 必须裁剪：`borderRadius` 只影响背景与边框的**绘制**，不会裁子元素。
      // 不裁剪时顶部图片是直角、正好盖住卡片圆角，看起来像「图片冲出卡片」。
      // Web 端对应写法是 `overflow-hidden rounded-2xl`。
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          AspectRatio(
            aspectRatio: 16 / 9,
            child: card.imageUrl == null || card.imageUrl!.isEmpty
                ? const ColoredBox(color: imageBg)
                : CachedNetworkImage(
                    imageUrl: staticUrl(card.imageUrl),
                    fit: BoxFit.cover,
                    // 磁贴约半屏宽，按 3 倍屏解码即可
                    memCacheWidth: 660,
                    fadeInDuration: Motion.normal,
                    placeholder: (context, _) =>
                        const ColoredBox(color: imageBg),
                    errorWidget: (context, _, _) =>
                        const ColoredBox(color: imageBg),
                  ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  card.titleZh.isEmpty ? card.title : card.titleZh,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: titleColor,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  card.bizDate,
                  maxLines: 1,
                  style: const TextStyle(color: dateColor, fontSize: 10),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/* ------------------------------ 骨架 ------------------------------ */

class _GrowthSkeleton extends StatelessWidget {
  const _GrowthSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 2, 16, 108),
      physics: const NeverScrollableScrollPhysics(),
      children: <Widget>[
        const ShimmerBox(height: 220, radius: 26),
        const SizedBox(height: 20),
        const ShimmerBox(height: 20, width: 96, radius: 8),
        const SizedBox(height: 12),
        Row(
          children: <Widget>[
            for (var i = 0; i < 3; i++) ...<Widget>[
              if (i > 0) const SizedBox(width: 10),
              const Expanded(child: ShimmerBox(height: 92, radius: 18)),
            ],
          ],
        ),
        const SizedBox(height: 20),
        const ShimmerBox(height: 20, width: 96, radius: 8),
        const SizedBox(height: 12),
        const ShimmerBox(height: 120, radius: 20),
      ],
    );
  }
}

/// 全部成就弹窗。
class _AllAchievementsSheet extends StatelessWidget {
  const _AllAchievementsSheet({required this.items});

  final List<AchievementView> items;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final unlocked = items.where((item) => item.unlocked).length;
    return ConstrainedBox(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.82,
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 2, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        '全部成就',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '已解锁 $unlocked / ${items.length}',
                        style: TextStyle(
                          fontSize: 11.5,
                          color: colors.inkFaint,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: Icon(
                    Icons.close_rounded,
                    size: 20,
                    color: colors.inkSoft,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Expanded(
              child: GridView.builder(
                padding: const EdgeInsets.only(bottom: 8),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                  childAspectRatio: 0.92,
                ),
                itemCount: items.length,
                itemBuilder: (context, index) =>
                    _AchievementTile(item: items[index]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
