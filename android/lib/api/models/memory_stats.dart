/// 记忆健康概览（遗忘曲线 / 待复习分布可视化）。
///
/// 字段与后端 `QuestionsService.getMemoryStats` 的返回同构。
class MemoryStats {
  const MemoryStats({
    required this.reviewed,
    required this.graduated,
    required this.dueToday,
    required this.dueIn7,
    required this.dueIn30,
    required this.distribution,
    required this.retentionCurve,
  });

  final int reviewed;
  final int graduated;
  final int dueToday;
  final int dueIn7;
  final int dueIn30;
  final List<int> distribution;
  final List<RetentionPoint> retentionCurve;

  factory MemoryStats.fromJson(Map<String, dynamic> json) {
    return MemoryStats(
      reviewed: json['reviewed'] as int? ?? 0,
      graduated: json['graduated'] as int? ?? 0,
      dueToday: json['dueToday'] as int? ?? 0,
      dueIn7: json['dueIn7'] as int? ?? 0,
      dueIn30: json['dueIn30'] as int? ?? 0,
      distribution: (json['distribution'] as List?)
              ?.whereType<int>()
              .toList() ??
          const <int>[],
      retentionCurve: (json['retentionCurve'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(RetentionPoint.fromJson)
              .toList() ??
          const <RetentionPoint>[],
    );
  }
}

/// 理论遗忘曲线上的一个点：第 day 天的记忆保留率 retention（0~1）。
class RetentionPoint {
  const RetentionPoint({required this.day, required this.retention});

  final int day;
  final double retention;

  factory RetentionPoint.fromJson(Map<String, dynamic> json) {
    return RetentionPoint(
      day: json['day'] as int? ?? 0,
      retention: (json['retention'] as num?)?.toDouble() ?? 0,
    );
  }
}
