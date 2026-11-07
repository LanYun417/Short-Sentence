/// 排行榜模型（今日答题数 / 答对数前 100）。
///
/// 与后端 `LeaderboardService.LeaderboardResult` 逐字段对应
/// （见 api 的 `modules/client/leaderboard/leaderboard.service.ts`）。
library;

/// 榜单类型。
enum LeaderboardType { todayAnswered, todayCorrect }

extension LeaderboardTypeX on LeaderboardType {
  /// 传给后端的 query 值。
  String get apiValue => switch (this) {
        LeaderboardType.todayAnswered => 'today_answered',
        LeaderboardType.todayCorrect => 'today_correct',
      };

  /// 界面文案。
  String get label => switch (this) {
        LeaderboardType.todayAnswered => '答题榜',
        LeaderboardType.todayCorrect => '答对榜',
      };

  String get unit => switch (this) {
        LeaderboardType.todayAnswered => '答了',
        LeaderboardType.todayCorrect => '答对',
      };
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

/// 今日排行榜响应。
class LeaderboardResult {
  const LeaderboardResult({
    required this.type,
    required this.date,
    required this.top,
    required this.me,
  });

  final LeaderboardType type;
  /// 榜单所属自然日 YYYY-MM-DD
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
