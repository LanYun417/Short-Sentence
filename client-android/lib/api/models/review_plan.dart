/// 今日复习计划（对应后端 /client/questions/review-plan）。
library;

class ReviewPlanItem {
  const ReviewPlanItem({
    required this.sentenceId,
    required this.translationZh,
    required this.dueAt,
    required this.overdue,
    required this.level,
    required this.lastCorrect,
  });

  final int sentenceId;
  final String translationZh;
  final DateTime? dueAt;
  final bool overdue;
  final int level;
  final bool lastCorrect;
}

class ReviewPlan {
  const ReviewPlan({
    required this.total,
    required this.overdue,
    required this.completedToday,
    required this.suggestedLimit,
    required this.byCategory,
    required this.items,
  });

  final int total;
  final int overdue;
  final int completedToday;
  final int suggestedLimit;
  final List<({String name, int count})> byCategory;
  final List<ReviewPlanItem> items;

  factory ReviewPlan.fromJson(Map<String, dynamic> json) {
    return ReviewPlan(
      total: (json['total'] as num?)?.toInt() ?? 0,
      overdue: (json['overdue'] as num?)?.toInt() ?? 0,
      completedToday: (json['completedToday'] as num?)?.toInt() ?? 0,
      suggestedLimit: (json['suggestedLimit'] as num?)?.toInt() ?? 20,
      byCategory: (json['byCategory'] as List<dynamic>? ?? <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(
            (item) => (
              name: item['name'] as String? ?? '',
              count: (item['count'] as num?)?.toInt() ?? 0,
            ),
          )
          .toList(),
      items: (json['items'] as List<dynamic>? ?? <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(
            (item) => ReviewPlanItem(
              sentenceId: (item['sentenceId'] as num?)?.toInt() ?? 0,
              translationZh: item['translationZh'] as String? ?? '',
              dueAt: DateTime.tryParse(item['dueAt'] as String? ?? ''),
              overdue: item['overdue'] as bool? ?? false,
              level: (item['level'] as num?)?.toInt() ?? 0,
              lastCorrect: item['lastCorrect'] as bool? ?? false,
            ),
          )
          .toList(),
    );
  }
}
