/// 排行榜模型（今日 / 近 7 天 / 近 30 天的答题数与答对数，以及累计打卡天数）。
///
/// 与后端 `LeaderboardService.LeaderboardResult` 逐字段对应
/// （见 api 的 `modules/client/leaderboard/leaderboard.service.ts`）。
/// 周/月榜是「最近 N 个自然日」的滚动窗口，与答题记录 30 天保留期对齐。
library;

/// 榜单类型（后端 query 值见 [LeaderboardTypeX.apiValue]）。
enum LeaderboardType {
  todayAnswered,
  todayCorrect,
  weekAnswered,
  weekCorrect,
  monthAnswered,
  monthCorrect,
  checkinTotal,
}

/// 周期维度（页面第一排分段）。
enum LeaderboardPeriod { today, week, month, checkin }

/// 指标维度（页面第二排分段；打卡周期下隐藏）。
enum LeaderboardMetric { answered, correct }

/// 周期 × 指标 → 后端榜单类型。打卡周期只有累计天数一个口径。
LeaderboardType leaderboardTypeOf(LeaderboardPeriod period, LeaderboardMetric metric) {
  return switch (period) {
    LeaderboardPeriod.today => metric == LeaderboardMetric.answered
        ? LeaderboardType.todayAnswered
        : LeaderboardType.todayCorrect,
    LeaderboardPeriod.week => metric == LeaderboardMetric.answered
        ? LeaderboardType.weekAnswered
        : LeaderboardType.weekCorrect,
    LeaderboardPeriod.month => metric == LeaderboardMetric.answered
        ? LeaderboardType.monthAnswered
        : LeaderboardType.monthCorrect,
    LeaderboardPeriod.checkin => LeaderboardType.checkinTotal,
  };
}

extension LeaderboardTypeX on LeaderboardType {
  /// 传给后端的 query 值。
  String get apiValue => switch (this) {
        LeaderboardType.todayAnswered => 'today_answered',
        LeaderboardType.todayCorrect => 'today_correct',
        LeaderboardType.weekAnswered => 'week_answered',
        LeaderboardType.weekCorrect => 'week_correct',
        LeaderboardType.monthAnswered => 'month_answered',
        LeaderboardType.monthCorrect => 'month_correct',
        LeaderboardType.checkinTotal => 'checkin_total',
      };

  /// 界面文案（调试 / 无障碍用）。
  String get label => switch (this) {
        LeaderboardType.todayAnswered => '今日答题榜',
        LeaderboardType.todayCorrect => '今日答对榜',
        LeaderboardType.weekAnswered => '周榜答题数',
        LeaderboardType.weekCorrect => '周榜答对数',
        LeaderboardType.monthAnswered => '月榜答题数',
        LeaderboardType.monthCorrect => '月榜答对数',
        LeaderboardType.checkinTotal => '累计打卡榜',
      };

  /// 计数单位：题 / 天。
  String get unit => switch (this) {
        LeaderboardType.checkinTotal => '天',
        _ => '题',
      };

  bool get isCheckin => this == LeaderboardType.checkinTotal;
  bool get isCorrect => switch (this) {
        LeaderboardType.todayCorrect || LeaderboardType.weekCorrect || LeaderboardType.monthCorrect => true,
        _ => false,
      };

  /// 周期标题（页头副标题）。
  String get periodTitle => switch (this) {
        LeaderboardType.todayAnswered || LeaderboardType.todayCorrect => '今日',
        LeaderboardType.weekAnswered || LeaderboardType.weekCorrect => '近 7 天',
        LeaderboardType.monthAnswered || LeaderboardType.monthCorrect => '近 30 天',
        LeaderboardType.checkinTotal => '累计打卡',
      };

  /// 文案里的口径词（今日两榜刻意保留「今天」，与既有文案一致）。
  String get scope => switch (this) {
        LeaderboardType.todayAnswered || LeaderboardType.todayCorrect => '今天',
        LeaderboardType.weekAnswered || LeaderboardType.weekCorrect => '近 7 天',
        LeaderboardType.monthAnswered || LeaderboardType.monthCorrect => '近 30 天',
        LeaderboardType.checkinTotal => '累计',
      };

  /// 我的名次文案（打卡榜为累计口径）。
  String meText(int rank, int count) => switch (this) {
        LeaderboardType.checkinTotal => '你累计打卡第 $rank 名 · $count 天',
        _ => '你$scope${isCorrect ? '答对' : '答题'}第 $rank 名 · $count 题',
      };

  /// 未上榜时的横幅文案。
  String get bannerEmpty => isCheckin ? '还没打过卡，去完成今日目标吧' : '$scope还没上榜，去刷几题吧';

  /// 空榜标题与说明。
  String get emptyTitle => isCheckin ? '还没有人打卡' : '$scope还没有人上榜';
  String get emptyMessage => isCheckin ? '完成今日目标，你就是打卡第一人' : '答完第一题，你就是榜一';
}

/// 榜单一行。
class LeaderboardRow {
  const LeaderboardRow({
    required this.rank,
    required this.userId,
    required this.nickname,
    required this.avatarUrl,
    required this.count,
  });

  final int rank;
  final int userId;
  final String nickname;
  final String? avatarUrl;
  final int count;

  factory LeaderboardRow.fromJson(Map<String, dynamic> json) {
    return LeaderboardRow(
      rank: (json['rank'] as num?)?.toInt() ?? 0,
      userId: (json['userId'] as num?)?.toInt() ?? 0,
      nickname: json['nickname'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      count: (json['count'] as num?)?.toInt() ?? 0,
    );
  }
}

/// 当前用户名次（未上榜为 null）。
class LeaderboardMe {
  const LeaderboardMe({required this.rank, required this.count});

  final int rank;
  final int count;

  factory LeaderboardMe.fromJson(Map<String, dynamic> json) {
    return LeaderboardMe(
      rank: (json['rank'] as num?)?.toInt() ?? 0,
      count: (json['count'] as num?)?.toInt() ?? 0,
    );
  }
}

/// 排行榜响应。
class LeaderboardResult {
  const LeaderboardResult({
    required this.type,
    required this.date,
    required this.top,
    required this.me,
  });

  final LeaderboardType type;
  /// 榜单统计截止自然日 YYYY-MM-DD
  final String date;
  final List<LeaderboardRow> top;
  final LeaderboardMe? me;

  factory LeaderboardResult.fromJson(Map<String, dynamic> json, LeaderboardType type) {
    final topRaw = json['top'];
    return LeaderboardResult(
      type: type,
      date: json['date'] as String? ?? '',
      top: topRaw is List
          ? topRaw.whereType<Map<String, dynamic>>().map(LeaderboardRow.fromJson).toList()
          : const <LeaderboardRow>[],
      me: json['me'] is Map<String, dynamic> ? LeaderboardMe.fromJson(json['me'] as Map<String, dynamic>) : null,
    );
  }
}
