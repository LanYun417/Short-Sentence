/// 成长页：等级 / XP / 连续打卡 / 成就墙 / 场景地图 / 句签册。
///
/// 版式逻辑：**先给身份，再给细节**。顶部渐变卡回答「我现在几级、还差多少」，
/// 下面的白卡再展开成就与场景——一屏之内不出现第二个渐变块，避免抢焦点。
library;


import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../api/api_exception.dart';
import '../api/auth_api.dart';
import '../api/coach_api.dart';
import '../api/models/coach.dart';
import '../api/models/growth.dart';
import '../api/models/stage.dart';
import '../api/models/team.dart';
import '../api/stage_api.dart';
import '../api/team_api.dart';
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
import '../api/gamify_api.dart';
import '../api/models/weekly_report.dart';
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
    // 记忆概览 / 小队 / 私教画像随成长页一起刷新（答题后都会变）
    ref.invalidate(memoryStatsProvider);
    ref.invalidate(teamProvider);
    ref.invalidate(coachProfileProvider);
    ref.invalidate(stageOverviewProvider);
    await Future.wait(<Future<void>>[
      ref.read(growthControllerProvider.notifier).refresh(),
      ref.read(cardControllerProvider.notifier).refresh(),
    ]);
  }

  /// 查看未拥有的句签（拉数据后弹底部面板）。
  Future<void> _showMissingSheet() async {
    final notifier = ref.read(cardControllerProvider.notifier);
    await notifier.loadMissing();
    if (!mounted) {
      return;
    }
    final state = ref.read(cardControllerProvider);
    if (state.missing.isEmpty && state.missingTotal == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('你已经集齐了所有句签，真厉害！')),
      );
      return;
    }
    if (!mounted) {
      return;
    }
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _MissingSheet(
        cards: state.missing,
        total: state.missingTotal,
      ),
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
                          // 学习小队放靠前：「就差你啦」是最强的即时行动召唤
                          ref.watch(teamProvider).when(
                            data: (team) => _TeamCard(team: team),
                            loading: () => const SizedBox.shrink(),
                            error: (_, _) => const SizedBox.shrink(),
                          ),
                          const SizedBox(height: 14),
                          // 情景闯关：给「下一步练什么」一个带剧情的答案（关卡 = 场景）
                          ref.watch(stageOverviewProvider).when(
                            data: (overview) => _StageCard(overview: overview),
                            loading: () => const SizedBox.shrink(),
                            error: (_, _) => const SizedBox.shrink(),
                          ),
                          const SizedBox(height: 14),
                          ref.watch(weeklyReportProvider).when(
                            data: (report) => _WeeklyReportCard(report: report),
                            loading: () => const SizedBox.shrink(),
                            error: (_, _) => const SizedBox.shrink(),
                          ),
                          const SizedBox(height: 14),
                          ref.watch(memoryStatsProvider).when(
                            data: (stats) => _MemoryHealthCard(stats: stats),
                            loading: () => const SizedBox.shrink(),
                            error: (_, _) => const SizedBox.shrink(),
                          ),
                          const SizedBox(height: 14),
                          ref.watch(coachProfileProvider).when(
                            data: (profile) => _AiCoachCard(profile: profile),
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
                                ? () => context.push('/achievements')
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
                            actionLabel: growth.scenes.length > 6 ? '全部' : null,
                            onAction: growth.scenes.length > 6
                                ? () => context.push('/scenes')
                                : null,
                          ),
                          _SceneMap(items: growth.scenes.take(6).toList()),
                          const SizedBox(height: 20),
                          SectionHeader(
                            title: '我的句签',
                            subtitle: cards.mine.isEmpty
                                ? '达标后领取，收进册子'
                                : '共 ${cards.mine.length} 张',
                            icon: Icons.auto_awesome_rounded,
                            actionLabel: cards.missingLoaded && cards.missingTotal > 0
                                ? '查看未拥有 (${cards.missingTotal})'
                                : '查看未拥有',
                            onAction: _showMissingSheet,
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

/// 周学习报告（服务端按东八区周一 00:00 聚合）。
final weeklyReportProvider = FutureProvider<WeeklyReport>((ref) async {
  final api = ref.watch(gamifyApiProvider);
  return api.weeklyReport();
});

/// 周学习报告卡片：把这一周的努力变成看得懂的一屏（答题 / 正确率 / 活跃天数 /
/// 每日柱状 / 经验 / 连续打卡 / 最常练 / 与上周对比）。
///
/// 数字全部来自服务端聚合，客户端不自己算「本周」——否则与分享文案、Web 端口径会漂移。
class _WeeklyReportCard extends StatelessWidget {
  const _WeeklyReportCard({required this.report});
  final WeeklyReport report;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hint = theme.textTheme.bodySmall?.color;
    final maxDaily = report.daily.fold<int>(1, (max, d) => d.answered > max ? d.answered : max);

    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Text('本周学习报告',
                  style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
              const Spacer(),
              Text('周一 00:00 至今',
                  style: theme.textTheme.labelSmall?.copyWith(color: hint)),
            ],
          ),
          const SizedBox(height: 12),
          if (report.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 18),
              child: Column(
                children: <Widget>[
                  Text('本周还没有学习记录',
                      style: theme.textTheme.bodyMedium?.copyWith(color: hint)),
                  const SizedBox(height: 4),
                  Text('刷几道题，周日回来看看这一周攒下了什么',
                      style: theme.textTheme.labelSmall?.copyWith(color: hint)),
                ],
              ),
            )
          else ...<Widget>[
            Row(
              children: <Widget>[
                _MemoryStat(value: '${report.answered}', label: '本周答题', color: context.colors.brand),
                _MemoryStat(
                    value: '${(report.accuracy * 100).round()}%', label: '正确率', color: Colors.green),
                _MemoryStat(value: '${report.activeDays}/7', label: '活跃天数', color: Colors.orange),
              ],
            ),
            const SizedBox(height: 14),
            SizedBox(
              height: 56,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: <Widget>[
                  for (final day in report.daily)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: <Widget>[
                            Container(
                              height: day.answered == 0 ? 3 : (day.answered / maxDaily) * 40,
                              decoration: BoxDecoration(
                                color: context.colors.brand.withValues(
                                    alpha: day.answered == 0 ? 0.15 : 0.85),
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(day.weekday.replaceFirst('周', ''),
                                style: theme.textTheme.labelSmall?.copyWith(color: hint)),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 6,
              children: <Widget>[
                Text('本周 +${report.xpGained} 经验',
                    style: theme.textTheme.labelSmall?.copyWith(color: hint)),
                if (report.newAchievements > 0)
                  Text('新解锁 ${report.newAchievements} 个成就',
                      style: theme.textTheme.labelSmall?.copyWith(color: Colors.amber.shade700)),
                if (report.streak > 0)
                  Text('连续打卡 ${report.streak} 天',
                      style: theme.textTheme.labelSmall?.copyWith(color: Colors.deepOrange)),
                if (report.topCategory != null)
                  Text('最常练「${report.topCategory!.name}」',
                      style: theme.textTheme.labelSmall?.copyWith(color: hint)),
                Text(
                  '比上周${report.deltaAnswered >= 0 ? '多' : '少'} ${report.deltaAnswered.abs()} 题',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: report.deltaAnswered >= 0 ? Colors.green : hint,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

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
            height: 64,
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
                            : (stats.distribution[i] / maxDist) * 60,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: i == 0
                                ? [colors.brand, colors.brand.withValues(alpha: 0.45)]
                                : [
                                    colors.brand.withValues(alpha: 0.7),
                                    colors.brand.withValues(alpha: 0.22),
                                  ],
                          ),
                          borderRadius: const BorderRadius.only(
                            topLeft: Radius.circular(3),
                            topRight: Radius.circular(3),
                          ),
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
            height: 64,
            child: CustomPaint(
              size: const Size(double.infinity, 64),
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
    final pts = points
        .map((p) => Offset((p.day / 30) * size.width, size.height - p.retention * (size.height - 8) - 4))
        .toList();

    // 基线
    canvas.drawLine(
      Offset(0, size.height - 0.5),
      Offset(size.width, size.height - 0.5),
      Paint()..color = color.withValues(alpha: 0.15)..strokeWidth = 1,
    );

    // 面积填充（曲线下渐变）
    final area = Path()..moveTo(pts.first.dx, size.height);
    for (final p in pts) {
      area.lineTo(p.dx, p.dy);
    }
    area.lineTo(pts.last.dx, size.height);
    area.close();
    canvas.drawPath(
      area,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [color.withValues(alpha: 0.28), color.withValues(alpha: 0.01)],
        ).createShader(Rect.fromLTWH(0, 0, size.width, size.height))
        ..style = PaintingStyle.fill,
    );

    // 平滑折线（二次贝塞尔过中点）
    final path = Path()..moveTo(pts.first.dx, pts.first.dy);
    for (var i = 1; i < pts.length; i++) {
      final prev = pts[i - 1];
      final cur = pts[i];
      final mid = Offset((prev.dx + cur.dx) / 2, (prev.dy + cur.dy) / 2);
      path.quadraticBezierTo(prev.dx, prev.dy, mid.dx, mid.dy);
    }
    path.lineTo(pts.last.dx, pts.last.dy);
    canvas.drawPath(
      path,
      Paint()
        ..color = color.withValues(alpha: 0.9)
        ..strokeWidth = 2.5
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round,
    );

    // 终点圆点
    canvas.drawCircle(
      pts.last,
      3.5,
      Paint()..color = color,
    );
  }

  @override
  bool shouldRepaint(covariant _RetentionPainter old) => true;
}

/* ------------------------------ AI 私教 ------------------------------ */

/// 薄弱点画像（纯计算，始终可用）。
final coachProfileProvider = FutureProvider<CoachProfile>((ref) async {
  final api = ref.watch(coachApiProvider);
  return api.profile();
});

class _AiCoachCard extends ConsumerStatefulWidget {
  const _AiCoachCard({required this.profile});

  final CoachProfile profile;

  @override
  ConsumerState<_AiCoachCard> createState() => _AiCoachCardState();
}

class _AiCoachCardState extends ConsumerState<_AiCoachCard> {
  CoachAdvice? _advice;
  bool _busy = false;
  String? _error;

  Future<void> _ask() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final advice = await ref.read(coachApiProvider).advice();
      if (mounted) setState(() => _advice = advice);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = '生成失败，请稍后重试');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hint = theme.textTheme.bodySmall?.color;
    final p = widget.profile;
    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(Icons.school_rounded, size: 16, color: Colors.indigo),
              const SizedBox(width: 6),
              Text('AI 私教',
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w700)),
              const Spacer(),
              Text('按你的数据排计划',
                  style: theme.textTheme.labelSmall?.copyWith(color: hint)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: <Widget>[
              _MemoryStat(
                  value: '${(p.accuracy * 100).round()}%',
                  label: '正确率',
                  color: Colors.indigo),
              _MemoryStat(
                  value: '${p.totalAnswers}',
                  label: '累计作答',
                  color: context.colors.brand),
              _MemoryStat(
                  value: '${p.streak}',
                  label: '连续打卡',
                  color: Colors.amber),
              _MemoryStat(
                  value: '${p.dueToday}',
                  label: '待复习',
                  color: Colors.orange),
            ],
          ),
          if (p.focus.isNotEmpty) ...<Widget>[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.indigo.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: <Widget>[
                  const Icon(Icons.my_location_rounded,
                      size: 15, color: Colors.indigo),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text('今日重点：${p.focus}',
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Colors.indigo)),
                  ),
                ],
              ),
            ),
          ],
          if (p.weakCategories.isNotEmpty) ...<Widget>[
            const SizedBox(height: 12),
            Text('需要补的场景',
                style: theme.textTheme.labelSmall?.copyWith(color: hint)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: <Widget>[
                for (final c in p.weakCategories)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.orange.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text('${c.name} · ${(c.accuracy * 100).round()}%',
                        style: const TextStyle(
                            fontSize: 11, color: Colors.orange)),
                  ),
              ],
            ),
          ],
          if (p.plan.isNotEmpty) ...<Widget>[
            const SizedBox(height: 12),
            Text('今日复习计划',
                style: theme.textTheme.labelSmall?.copyWith(color: hint)),
            const SizedBox(height: 6),
            for (var i = 0; i < p.plan.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Container(
                      width: 16,
                      height: 16,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: Colors.indigo.withValues(alpha: 0.12),
                        shape: BoxShape.circle,
                      ),
                      child: Text('${i + 1}',
                          style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Colors.indigo)),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(p.plan[i],
                          style: theme.textTheme.bodySmall
                              ?.copyWith(height: 1.4)),
                    ),
                  ],
                ),
              ),
          ],
          if (p.toughSentences.isNotEmpty) ...<Widget>[
            const SizedBox(height: 6),
            Text('总也记不住的句子',
                style: theme.textTheme.labelSmall?.copyWith(color: hint)),
            const SizedBox(height: 4),
            Text(
              p.toughSentences
                  .map((t) => '「${t.translationZh}」×${t.wrongCount}')
                  .join('、'),
              style: theme.textTheme.labelSmall?.copyWith(height: 1.5),
            ),
          ],
          const SizedBox(height: 12),
          Divider(height: 1, color: theme.dividerColor.withValues(alpha: 0.5)),
          const SizedBox(height: 10),
          Row(
            children: <Widget>[
              FilledButton.icon(
                onPressed: _busy ? null : _ask,
                icon: const Icon(Icons.auto_awesome_rounded, size: 15),
                label: Text(
                  _busy
                      ? '思考中…'
                      : _advice != null
                          ? '再听一句'
                          : '让私教说两句',
                  style: const TextStyle(fontSize: 12),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  p.aiAvailable ? '会占用 1 次今日 AI 额度' : '当前为规则建议',
                  textAlign: TextAlign.right,
                  style: theme.textTheme.labelSmall?.copyWith(color: hint),
                ),
              ),
            ],
          ),
          if (_advice != null) ...<Widget>[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Theme.of(context)
                    .colorScheme
                    .onSurface
                    .withValues(alpha: 0.04),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                '${_advice!.text}${_advice!.source == 'rule' ? '（规则建议）' : ''}',
                style: theme.textTheme.bodySmall?.copyWith(height: 1.5),
              ),
            ),
          ],
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_error!,
                  style: const TextStyle(fontSize: 12, color: Colors.redAccent)),
            ),
        ],
      ),
    );
  }
}

/* ------------------------------ 情景闯关 ------------------------------ */

/// 情景闯关入口卡片：只给总进度与「当前推荐关卡」，完整地图在 /stages。
///
/// 刻意不在成长页铺 14 个关卡：成长页已有 5 张卡片，关卡地图需要纵向空间讲剧情，
/// 挤成图标墙就没人看得出这是个有故事的玩法。
class _StageCard extends StatelessWidget {
  const _StageCard({required this.overview});

  final StageOverview overview;

  StageView? get _recommended {
    final int? id = overview.recommendedId;
    if (id == null) return null;
    for (final StageChapter chapter in overview.chapters) {
      for (final StageView stage in chapter.stages) {
        if (stage.id == id) return stage;
      }
    }
    return null;
  }

  StageChapter? get _chapter {
    final int? id = overview.recommendedId;
    if (id == null) return null;
    for (final StageChapter chapter in overview.chapters) {
      if (chapter.stages.any((StageView stage) => stage.id == id)) return chapter;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final StageView? stage = _recommended;
    final StageChapter? chapter = _chapter;
    final double percent = overview.totalStages == 0
        ? 0
        : overview.clearedStages / overview.totalStages;

    return AppCard(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      radius: 22,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(Icons.map_rounded, size: 16, color: colors.brand),
              const SizedBox(width: 6),
              Text(
                '情景闯关',
                style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: colors.ink),
              ),
              const Spacer(),
              Text(
                '已通关 ${overview.clearedStages} / ${overview.totalStages}',
                style: TextStyle(fontSize: 11, color: colors.inkSoft),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: LinearProgressIndicator(
              value: percent,
              minHeight: 6,
              backgroundColor: colors.cardMuted,
              valueColor: AlwaysStoppedAnimation<Color>(colors.brand),
            ),
          ),
          const SizedBox(height: 12),
          if (stage != null)
            GestureDetector(
              onTap: () => context.push('/stages'),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: colors.brand.withValues(alpha: 0.07),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      chapter == null
                          ? stage.name
                          : '${chapter.name.replaceAll(' ', '')} · ${stage.name}',
                      style: TextStyle(fontSize: 10.5, color: colors.brand),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      stage.title,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: colors.ink,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      stage.intro,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 11.5, height: 1.6, color: colors.inkSoft),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(20),
                            child: LinearProgressIndicator(
                              value: stage.progress / 100,
                              minHeight: 5,
                              backgroundColor: colors.card,
                              valueColor: AlwaysStoppedAnimation<Color>(colors.brand),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${stage.correctCount} / ${stage.target} 句',
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                            color: colors.brand,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            )
          else
            Text(
              '全部关卡已通关。回去复习，或者等新的章节上线。',
              style: TextStyle(fontSize: 12, color: colors.inkSoft),
            ),
          const SizedBox(height: 10),
          Row(
            children: <Widget>[
              if (overview.claimable > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: colors.gold.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '${overview.claimable} 个通关奖励待领取',
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w600,
                      color: colors.gold,
                    ),
                  ),
                )
              else
                Text(
                  '每关答对该场景若干句即可通关',
                  style: TextStyle(fontSize: 10.5, color: colors.inkFaint),
                ),
              const Spacer(),
              InkWell(
                onTap: () => context.push('/stages'),
                child: Row(
                  children: <Widget>[
                    Text(
                      '查看地图',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                        color: colors.brand,
                      ),
                    ),
                    Icon(Icons.chevron_right_rounded, size: 16, color: colors.brand),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/* ------------------------------ 学习小队 ------------------------------ */

/// 我的小队（成长页靠前展示；null = 未组队）。
final teamProvider = FutureProvider<TeamView?>((ref) async {
  final api = ref.watch(teamApiProvider);
  return api.my();
});

class _TeamCard extends ConsumerStatefulWidget {
  const _TeamCard({required this.team});

  final TeamView? team;

  @override
  ConsumerState<_TeamCard> createState() => _TeamCardState();
}

class _TeamCardState extends ConsumerState<_TeamCard> {
  bool _busy = false;
  String? _error;

  Future<void> _act(Future<void> Function(TeamApi api) action) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action(ref.read(teamApiProvider));
      ref.invalidate(teamProvider);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = '操作失败，请稍后重试');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hint = theme.textTheme.bodySmall?.color;
    final team = widget.team;
    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(Icons.groups_rounded,
                  size: 16, color: context.colors.brand),
              const SizedBox(width: 6),
              Text('学习小队',
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w700)),
              const Spacer(),
              PressScale(
                onTap: () => context.push('/team'),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Text('进入小队',
                        style: theme.textTheme.labelSmall
                            ?.copyWith(color: context.colors.brand)),
                    Icon(Icons.chevron_right_rounded,
                        size: 14, color: context.colors.brand),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (team == null)
            _buildEmpty(theme, hint)
          else
            _buildTeam(context, theme, team),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(_error!,
                  style: const TextStyle(fontSize: 12, color: Colors.redAccent)),
            ),
        ],
      ),
    );
  }

  Widget _buildEmpty(ThemeData theme, Color? hint) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text('和节奏相近的人，一起把每天坚持下来',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium),
        const SizedBox(height: 6),
        Text('最多 10 人：可随机匹配，也可自建队伍或凭组队码加入，队伍内还能群聊。'
            '全员完成每人额外 +15 XP，小队连续天数一起涨。',
            textAlign: TextAlign.center,
            style: theme.textTheme.labelSmall?.copyWith(color: hint, height: 1.5)),
        const SizedBox(height: 12),
        Row(
          children: <Widget>[
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _busy ? null : _showFindSheet,
                icon: const Icon(Icons.shuffle_rounded, size: 16),
                label: const Text('找队友'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton.icon(
                onPressed: _busy ? null : _createTeam,
                icon: const Icon(Icons.flag_rounded, size: 16),
                label: const Text('创建小队'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  /// 「找队友」点开给两个选择：随机匹配 / 组队码加入；「创建小队」在旁边，凑齐三种组队方式。
  void _showFindSheet() {
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            ListTile(
              leading: const Icon(Icons.shuffle_rounded),
              title: const Text('随机匹配'),
              subtitle: const Text('按近 7 天练习节奏匹配陌生队友'),
              onTap: () {
                Navigator.pop(ctx);
                _act((api) async {
                  await api.match();
                });
              },
            ),
            ListTile(
              leading: const Icon(Icons.vpn_key_rounded),
              title: const Text('组队码加入'),
              subtitle: const Text('输入朋友给你的组队码'),
              onTap: () {
                Navigator.pop(ctx);
                _joinByCode();
              },
            ),
          ],
        ),
      ),
    );
  }

  /// 弹窗输入一段文字（建队名 / 组队码共用）。
  Future<String?> _promptText(String title, String hint) {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(controller: controller, autofocus: true, decoration: InputDecoration(hintText: hint)),
        actions: <Widget>[
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(ctx, controller.text.trim()), child: const Text('确定')),
        ],
      ),
    ).whenComplete(controller.dispose);
  }

  /// 创建小队：弹队名 → 建队（单人也可成队，之后拿组队码邀请别人）。
  Future<void> _createTeam() async {
    final name = await _promptText('创建小队', '小队名 2~20 字');
    if (name == null || name.isEmpty) return;
    await _act((api) async {
      await api.create(name);
    });
  }

  /// 组队码加入：弹码 → 入队。
  Future<void> _joinByCode() async {
    final code = await _promptText('组队码加入', '6 位组队码');
    if (code == null || code.isEmpty) return;
    await _act((api) async {
      await api.join(code.toUpperCase());
    });
  }

  Widget _buildTeam(BuildContext context, ThemeData theme, TeamView team) {
    final hint = theme.textTheme.bodySmall?.color;
    final Color toneColor;
    final IconData toneIcon;
    switch (team.hintTone) {
      case 'urge':
        toneColor = Colors.orange;
        toneIcon = Icons.notifications_active_rounded;
      case 'success':
        toneColor = Colors.green;
        toneIcon = Icons.check_circle_rounded;
      default:
        toneColor = context.colors.brand;
        toneIcon = Icons.info_rounded;
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Row(
          children: <Widget>[
            Text(team.name,
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.amber.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text('连续 ${team.streak} 天',
                  style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Colors.amber)),
            ),
          ],
        ),
        const SizedBox(height: 12),
        // 应用内提醒条：urge「就差你啦」是留存关键
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: toneColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: <Widget>[
              Icon(toneIcon, size: 16, color: toneColor),
              const SizedBox(width: 8),
              Expanded(
                child: Text(team.hint,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: toneColor)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        for (final m in team.members)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: <Widget>[
                CircleAvatar(
                  radius: 16,
                  backgroundColor: m.isMe
                      ? context.colors.brand
                      : Colors.indigo.withValues(alpha: 0.7),
                  child: Text(
                    m.nickname.isEmpty ? '?' : m.nickname.substring(0, 1),
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '${m.nickname}${m.isMe ? "（我）" : ""}',
                    style: theme.textTheme.bodySmall,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Text(
                  m.checkedIn ? '今日已打卡' : '待打卡',
                  style: TextStyle(
                      fontSize: 11,
                      color: m.checkedIn ? Colors.green : hint),
                ),
              ],
            ),
          ),
        Row(
          children: <Widget>[
            Text('今日 ${team.doneCount} / ${team.memberCount} 人完成 · 满 ${team.maxMembers} 人',
                style: theme.textTheme.labelSmall?.copyWith(color: hint)),
            const Spacer(),
            TextButton(
              onPressed: _busy
                  ? null
                  : () => _act((api) async {
                        await api.leave();
                        await api.match();
                      }),
              child: Text(_busy ? '处理中…' : '换一批队友',
                  style: const TextStyle(fontSize: 12)),
            ),
          ],
        ),
      ],
    );
  }
}

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
    // 紧凑布局：一行 6 个纯图标（点开看详情），18 枚成就也只占一两行，页面不被拉长
    return GridView.builder(
      shrinkWrap: true,
      padding: EdgeInsets.zero,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 6,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
        childAspectRatio: 1,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) => StaggeredEntrance(
        index: 3 + index,
        child: _CompactAchievementIcon(item: items[index]),
      ),
    );
  }
}

/// 首页成就墙的紧凑图标（无文字，点开弹详情）。
class _CompactAchievementIcon extends StatelessWidget {
  const _CompactAchievementIcon({required this.item});

  final AchievementView item;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final unlocked = item.unlocked;
    return PressScale(
      onTap: () => showAchievementDetail(context, item),
      scale: 0.9,
      child: Tooltip(
        message: '${item.name} · ${item.description}',
        child: Container(
          decoration: BoxDecoration(
            color: unlocked ? colors.card : colors.cardMuted.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: unlocked ? colors.gold.withValues(alpha: 0.35) : colors.line),
          ),
          child: Center(
            child: Icon(
              unlocked ? appIcon(item.icon) : Icons.lock_rounded,
              size: 22,
              color: unlocked ? colors.gold : colors.inkFaint,
            ),
          ),
        ),
      ),
    );
  }
}

/// 成就详情弹窗（首页图标与「全部成就」卡片共用）。
Future<void> showAchievementDetail(BuildContext context, AchievementView item) {
  final colors = context.colors;
  return showModalBottomSheet<void>(
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
                  ? const LinearGradient(colors: <Color>[Color(0xFFFBBF24), Color(0xFFF97316)])
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
          Text(item.name, style: Theme.of(sheetContext).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(
            item.description,
            textAlign: TextAlign.center,
            style:
                Theme.of(sheetContext).textTheme.bodySmall?.copyWith(color: colors.inkSoft, height: 1.6),
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Pill(
                label: item.unlocked ? '已解锁' : '未解锁',
                background:
                    (item.unlocked ? colors.success : colors.inkFaint).withValues(alpha: 0.1),
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
    // 预览用 3 列紧凑网格（首页只传前 6 个），全部场景进 /scenes 页，不用横向滚动
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 1.1,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) => StaggeredEntrance(
        index: 5 + index,
        child: _ScenePreviewTile(item: items[index]),
      ),
    );
  }
}

/// 首页场景预览的紧凑小卡片。
class _ScenePreviewTile extends StatelessWidget {
  const _ScenePreviewTile({required this.item});

  final SceneMapItem item;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final unlocked = item.unlocked;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: unlocked ? colors.card : colors.cardMuted.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: unlocked ? colors.brand.withValues(alpha: 0.3) : colors.line,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: unlocked ? colors.brand.withValues(alpha: 0.15) : colors.cardMuted,
            ),
            child: Icon(
              unlocked ? appIcon(item.icon) : Icons.lock_outline_rounded,
              size: 16,
              color: unlocked ? colors.brand : colors.inkFaint,
            ),
          ),
          const Spacer(),
          Text(
            item.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: unlocked ? colors.ink : colors.inkSoft,
            ),
          ),
          Text(
            unlocked ? '练过 ${item.practicedCount} 句' : '未解锁',
            style: TextStyle(fontSize: 9.5, color: colors.inkFaint),
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

/// 未拥有句签底部面板。
class _MissingSheet extends StatelessWidget {
  const _MissingSheet({required this.cards, required this.total});

  final List<SentenceCard> cards;
  final int total;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      maxChildSize: 0.9,
      minChildSize: 0.4,
      expand: false,
      builder: (context, scroll) => Column(
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 10),
            child: Row(
              children: <Widget>[
                Icon(Icons.auto_awesome_rounded, size: 20, color: colors.gold),
                const SizedBox(width: 8),
                Text(
                  '未拥有的句签',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: colors.ink,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: colors.cardMuted,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '$total 张',
                    style: TextStyle(fontSize: 11, color: colors.inkSoft),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: cards.isEmpty
                ? Center(
                    child: Text(
                      '加载中…',
                      style: TextStyle(color: colors.inkFaint),
                    ),
                  )
                : LayoutBuilder(
                    builder: (context, constraints) {
                      const gap = 10.0;
                      final tileWidth = (constraints.maxWidth - gap) / 2;
                      return ListView(
                        controller: scroll,
                        padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                        children: <Widget>[
                          Wrap(
                            spacing: gap,
                            runSpacing: gap,
                            children: <Widget>[
                              for (final card in cards)
                                SizedBox(
                                  width: tileWidth,
                                  child: _CardTile(card: card),
                                ),
                            ],
                          ),
                          if (total > cards.length)
                            Padding(
                              padding: const EdgeInsets.only(top: 16),
                              child: Center(
                                child: Text(
                                  '仅展示最近 ${cards.length} 张，还有 ${total - cards.length} 张待你解锁',
                                  style: TextStyle(fontSize: 12, color: colors.inkFaint),
                                ),
                              ),
                            ),
                        ],
                      );
                    },
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

