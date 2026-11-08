/// AI 私教：薄弱点画像与点评。
///
/// 与后端 `ClientCoachService` 的 CoachProfile / CoachAdvice 同构。
/// 画像纯计算、不依赖 AI 密钥；点评在 AI 不可用时由后端降级为规则文案。
class CoachProfile {
  const CoachProfile({
    required this.totalAnswers,
    required this.correctAnswers,
    required this.accuracy,
    required this.todayAnswers,
    required this.dueToday,
    required this.streak,
    required this.weakCategories,
    required this.toughSentences,
    required this.plan,
    required this.focus,
    required this.aiAvailable,
  });

  final int totalAnswers;
  final int correctAnswers;
  final double accuracy;
  final int todayAnswers;
  final int dueToday;
  final int streak;
  final List<CoachCategory> weakCategories;
  final List<CoachToughSentence> toughSentences;
  final List<String> plan;
  final String focus;
  final bool aiAvailable;

  factory CoachProfile.fromJson(Map<String, dynamic> json) {
    return CoachProfile(
      totalAnswers: json['totalAnswers'] as int? ?? 0,
      correctAnswers: json['correctAnswers'] as int? ?? 0,
      accuracy: (json['accuracy'] as num?)?.toDouble() ?? 0,
      todayAnswers: json['todayAnswers'] as int? ?? 0,
      dueToday: json['dueToday'] as int? ?? 0,
      streak: json['streak'] as int? ?? 0,
      weakCategories: (json['weakCategories'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(CoachCategory.fromJson)
              .toList() ??
          const <CoachCategory>[],
      toughSentences: (json['toughSentences'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(CoachToughSentence.fromJson)
              .toList() ??
          const <CoachToughSentence>[],
      plan: (json['plan'] as List?)?.whereType<String>().toList() ?? const <String>[],
      focus: json['focus'] as String? ?? '',
      aiAvailable: json['aiAvailable'] as bool? ?? false,
    );
  }
}

class CoachCategory {
  const CoachCategory({
    required this.categoryId,
    required this.name,
    required this.total,
    required this.correct,
    required this.accuracy,
  });

  final int categoryId;
  final String name;
  final int total;
  final int correct;
  final double accuracy;

  factory CoachCategory.fromJson(Map<String, dynamic> json) {
    return CoachCategory(
      categoryId: json['categoryId'] as int? ?? 0,
      name: json['name'] as String? ?? '',
      total: json['total'] as int? ?? 0,
      correct: json['correct'] as int? ?? 0,
      accuracy: (json['accuracy'] as num?)?.toDouble() ?? 0,
    );
  }
}

class CoachToughSentence {
  const CoachToughSentence({
    required this.sentenceId,
    required this.translationZh,
    required this.wrongCount,
  });

  final int sentenceId;
  final String translationZh;
  final int wrongCount;

  factory CoachToughSentence.fromJson(Map<String, dynamic> json) {
    return CoachToughSentence(
      sentenceId: json['sentenceId'] as int? ?? 0,
      translationZh: json['translationZh'] as String? ?? '',
      wrongCount: json['wrongCount'] as int? ?? 0,
    );
  }
}

class CoachAdvice {
  const CoachAdvice({required this.text, required this.source});

  final String text;
  /// ai / rule（rule = AI 不可用，已降级为规则文案）
  final String source;

  factory CoachAdvice.fromJson(Map<String, dynamic> json) {
    return CoachAdvice(
      text: json['text'] as String? ?? '',
      source: json['source'] as String? ?? 'rule',
    );
  }
}
