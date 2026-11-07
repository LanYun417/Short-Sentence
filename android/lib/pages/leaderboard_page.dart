/// 排行榜页（路由 /leaderboard）：今日答题数 / 今日答对数 / 累计打卡天数，各前 100。
///
/// 数据来自 GET /client/leaderboard?type=today_answered|today_correct|checkin_total（需登录），
/// 对应后端 `modules/client/leaderboard/leaderboard.controller.ts`。
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/auth_api.dart' show staticUrl;
import '../api/leaderboard_api.dart';
import '../api/models/leaderboard.dart';
import '../state/auth_controller.dart';
import '../state/growth_controller.dart';
import '../theme/palette.dart';
import '../widgets/app_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/page_header.dart';
import '../widgets/segmented.dart';

class LeaderboardPage extends ConsumerStatefulWidget {
  const LeaderboardPage({super.key});

  @override
  ConsumerState<LeaderboardPage> createState() => _LeaderboardPageState();
}

class _LeaderboardPageState extends ConsumerState<LeaderboardPage> {
  LeaderboardType _type = LeaderboardType.todayAnswered;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final myId = ref.watch(authControllerProvider).user?.id;
    final resultAsync = ref.watch(leaderboardProvider(_type));
    final result = resultAsync.valueOrNull;

    // 前三名会在后端旁路解锁「三甲之列 / 榜首加冕」。若成长页此前已加载过概览，
    // 这里主动刷一次，用户切回成长页就能立刻看到新勋章（不必下拉刷新）。
    ref.listen<AsyncValue<LeaderboardResult>>(leaderboardProvider(_type), (previous, next) {
      final rank = next.valueOrNull?.me?.rank;
      if (rank != null && rank <= 3 && ref.read(growthControllerProvider).loaded) {
        ref.read(growthControllerProvider.notifier).refresh();
      }
    });

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
          children: <Widget>[
            PageHeader(
              title: '排行榜',
              subtitle: result?.date.isNotEmpty == true ? '今日 · ${result!.date}' : '今日榜单',
            ),
            SegmentedControl<LeaderboardType>(
              segments: <Segment<LeaderboardType>>[
                Segment(value: LeaderboardType.todayAnswered, label: '答题榜', icon: Icons.format_list_numbered_rounded),
                Segment(value: LeaderboardType.todayCorrect, label: '答对榜', icon: Icons.emoji_events_outlined),
                Segment(value: LeaderboardType.checkinTotal, label: '打卡榜', icon: Icons.calendar_month_outlined),
              ],
              value: _type,
              onChanged: (LeaderboardType v) => setState(() => _type = v),
            ),
            const SizedBox(height: 12),
            _MyRankBanner(result: result, type: _type),
            const SizedBox(height: 12),
            resultAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (Object e, _) => AppCard(
                child: Text('加载失败：$e', style: TextStyle(color: colors.danger)),
              ),
              data: (LeaderboardResult r) => r.top.isEmpty
                  ? EmptyState(
                      title: _type == LeaderboardType.checkinTotal ? '还没有人打卡' : '今天还没有人上榜',
                      message: _type == LeaderboardType.checkinTotal ? '完成今日目标，你就是打卡第一人' : '答完第一题，你就是今天的榜一',
                      icon: Icons.emoji_events_outlined,
                    )
                  : Column(
                      children: <Widget>[
                        for (final LeaderboardRow row in r.top)
                          _LeaderboardRow(row: row, isMe: row.userId == myId, unit: _type.unit),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 「我的名次」横幅。 */
class _MyRankBanner extends StatelessWidget {
  const _MyRankBanner({required this.result, required this.type});

  final LeaderboardResult? result;
  final LeaderboardType type;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final me = result?.me;
    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: <Widget>[
          Icon(Icons.emoji_events_outlined, color: colors.gold, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              me != null
                  ? type.meText(me.rank, me.count)
                  : (type == LeaderboardType.checkinTotal ? '还没打过卡，去完成今日目标吧' : '今天还没上榜，去刷几题吧'),
              style: TextStyle(color: colors.ink, fontWeight: FontWeight.w600, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

/// 榜单一行。 */
class _LeaderboardRow extends StatelessWidget {
  const _LeaderboardRow({required this.row, required this.isMe, required this.unit});

  final LeaderboardRow row;
  final bool isMe;
  final String unit;

  Color _rankColor(AppColors colors) {
    if (row.rank == 1) return colors.gold;
    if (row.rank == 2) return colors.cardMuted;
    if (row.rank == 3) return colors.canvasTint;
    return colors.cardMuted;
  }

  Color _rankTextColor(AppColors colors) {
    if (row.rank <= 3) return colors.ink;
    return colors.inkSoft;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final initial = row.nickname.isNotEmpty ? row.nickname.characters.first.toUpperCase() : '?';
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: AppCard(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        elevated: isMe,
        child: Row(
          children: <Widget>[
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(color: _rankColor(colors), borderRadius: BorderRadius.circular(10)),
              child: Center(
                child: Text(
                  '${row.rank}',
                  style: TextStyle(fontWeight: FontWeight.bold, color: _rankTextColor(colors), fontSize: 13),
                ),
              ),
            ),
            const SizedBox(width: 10),
            CircleAvatar(
              radius: 18,
              backgroundColor: colors.brand.withValues(alpha: 0.12),
              backgroundImage: row.avatarUrl != null && row.avatarUrl!.isNotEmpty
                  ? CachedNetworkImageProvider(staticUrl(row.avatarUrl))
                  : null,
              child: row.avatarUrl == null || row.avatarUrl!.isEmpty
                  ? Text(initial, style: TextStyle(color: colors.brand, fontWeight: FontWeight.bold))
                  : null,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                row.nickname,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontWeight: FontWeight.w600, color: colors.ink, fontSize: 14),
              ),
            ),
            if (isMe)
              Container(
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: colors.brand.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
                child: Text('我', style: TextStyle(color: colors.brand, fontWeight: FontWeight.bold, fontSize: 11)),
              ),
            Text(
              '${row.count} $unit',
              style: TextStyle(fontWeight: FontWeight.bold, color: colors.ink, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}
