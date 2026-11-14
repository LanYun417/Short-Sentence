/// 周学习报告（服务端聚合：/client/gamify/weekly-report）。
///
/// 「本周」的边界由服务端按东八区周一 00:00 计算——客户端不自己算，
/// 避免时区/周界口径与分享文案里的数字对不上。
library;

/// 每日明细。
class WeeklyDaily {
  const WeeklyDaily({
    required this.date,
    required this.weekday,
    required this.answered,
    required this.correct,
  });

  final String date;
  final String weekday;
  final int answered;
  final int correct;

  factory WeeklyDaily.fromJson(Map<String, dynamic> json) {
    return WeeklyDaily(
      date: json['date'] as String? ?? '',
      weekday: json['weekday'] as String? ?? '',
      answered: (json['answered'] as num?)?.toInt() ?? 0,
      correct: (json['correct'] as num?)?.toInt() ?? 0,
    );
  }
}

/// 本周练得最多的场景。
class WeeklyTopCategory {
  const WeeklyTopCategory({required this.name, required this.count});

  final String name;
  final int count;

  factory WeeklyTopCategory.fromJson(Map<String, dynamic> json) {
    return WeeklyTopCategory(
      name: json['name'] as String? ?? '',
      count: (json['count'] as num?)?.toInt() ?? 0,
    );
  }
}

class WeeklyReport {
  const WeeklyReport({
    required this.answered,
    required this.correct,
    required this.accuracy,
    required this.activeDays,
    required this.xpGained,
    required this.newAchievements,
    required this.streak,
    required this.daily,
    required this.topCategory,
    required this.prevAnswered,
    required this.deltaAnswered,
  });

  final int answered;
  final int correct;

  /// 正确率（0~1）。
  final double accuracy;
  final int activeDays;
  final int xpGained;
  final int newAchievements;
  final int streak;
  final List<WeeklyDaily> daily;
  final WeeklyTopCategory? topCategory;
  final int prevAnswered;
  final int deltaAnswered;

  /// 本周是否有学习记录。
  bool get isEmpty => answered == 0;

  factory WeeklyReport.fromJson(Map<String, dynamic> json) {
    final rawDaily = json['daily'];
    final rawTop = json['topCategory'];
    return WeeklyReport(
      answered: (json['answered'] as num?)?.toInt() ?? 0,
      correct: (json['correct'] as num?)?.toInt() ?? 0,
      accuracy: (json['accuracy'] as num?)?.toDouble() ?? 0,
      activeDays: (json['activeDays'] as num?)?.toInt() ?? 0,
      xpGained: (json['xpGained'] as num?)?.toInt() ?? 0,
      newAchievements: (json['newAchievements'] as num?)?.toInt() ?? 0,
      streak: (json['streak'] as num?)?.toInt() ?? 0,
      daily: rawDaily is List
          ? rawDaily.whereType<Map<String, dynamic>>().map(WeeklyDaily.fromJson).toList(growable: false)
          : const <WeeklyDaily>[],
      topCategory: rawTop is Map<String, dynamic> ? WeeklyTopCategory.fromJson(rawTop) : null,
      prevAnswered: (json['prevAnswered'] as num?)?.toInt() ?? 0,
      deltaAnswered: (json['deltaAnswered'] as num?)?.toInt() ?? 0,
    );
  }
}