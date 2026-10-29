/// 刷题模型。
///
/// 字段与后端 `NextQuestion` / `AnswerResult` 一一对应
/// （见 api 的 `modules/client/questions/questions.service.ts`），
/// 也与 Web 端 `client/app/types/index.ts` 的 `NextQuestion` 同构。
library;

/// 题目来源。
enum QuestionSource {
  /// 新题
  newQuestion('new'),

  /// 复习题（间隔重复排期到期）
  review('review');

  const QuestionSource(this.value);

  final String value;

  static QuestionSource fromValue(String? value) =>
      values.firstWhere((e) => e.value == value, orElse: () => QuestionSource.newQuestion);
}

/// 作答模式。
enum AnswerMode {
  /// 默写（自己敲整句）
  input('input'),

  /// 拼词（点选词块）
  assemble('assemble');

  const AnswerMode(this.value);

  final String value;
}

/// 下一题。
class Question {
  const Question({
    required this.sentenceId,
    required this.translationZh,
    required this.imageUrl,
    required this.categoryName,
    required this.difficulty,
    required this.todayDone,
    required this.todayGoal,
    required this.source,
    this.words,
  });

  final int sentenceId;

  /// 中文题干
  final String translationZh;

  /// 场景图 URL（16:9）
  final String? imageUrl;

  final String? categoryName;

  /// 难度 1/2/3
  final int difficulty;

  /// 今日已完成题数
  final int todayDone;

  /// 今日目标题数
  final int todayGoal;

  final QuestionSource source;

  /// 拼词模式候选词块（仅 assemble 下发；input 恒 null）
  final List<String>? words;

  factory Question.fromJson(Map<String, dynamic> json) {
    final words = json['words'];
    return Question(
      sentenceId: (json['sentenceId'] as num?)?.toInt() ?? 0,
      translationZh: json['translationZh'] as String? ?? '',
      imageUrl: json['imageUrl'] as String?,
      categoryName: json['categoryName'] as String?,
      difficulty: (json['difficulty'] as num?)?.toInt() ?? 1,
      todayDone: (json['todayDone'] as num?)?.toInt() ?? 0,
      todayGoal: (json['todayGoal'] as num?)?.toInt() ?? 0,
      source: QuestionSource.fromValue(json['source'] as String?),
      words: words is List ? words.whereType<String>().toList() : null,
    );
  }

  /// 今日进度 0~1（进度条用）。
  double get todayProgress {
    if (todayGoal <= 0) {
      return 0;
    }
    return (todayDone / todayGoal).clamp(0, 1).toDouble();
  }

  String get difficultyLabel => switch (difficulty) {
        1 => '基础',
        2 => '进阶',
        3 => '挑战',
        _ => '基础',
      };
}

/// 提交答案结果（含正确答案，用于翻卡背面）。
class AnswerResult {
  const AnswerResult({
    required this.sentenceId,
    required this.isCorrect,
    required this.sentenceEn,
    required this.validAnswers,
    required this.translationZh,
    required this.ipa,
    required this.explanation,
    required this.imageUrl,
    required this.favorited,
    required this.todayDone,
    required this.todayGoal,
    this.xpEarned = 0,
    this.goalBonus = 0,
    this.newAchievements = const <AchievementUnlock>[],
  });

  final int sentenceId;
  final bool isCorrect;

  /// 标准答案（完整英文句）
  final String sentenceEn;

  /// 其他可接受表达
  final List<String> validAnswers;

  final String translationZh;

  /// 音标
  final String? ipa;

  /// 题目解析（语法 / 时态 / 词形；生题时生成，老题为 null 则不显示解析块）
  final String? explanation;

  final String? imageUrl;

  /// 当前是否已收藏
  final bool favorited;

  final int todayDone;
  final int todayGoal;

  /// 本次作答获得的经验（重复提交命中幂等时为 0）。
  final int xpEarned;

  /// 本次恰好完成每日目标的额外奖励经验。
  final int goalBonus;

  /// 本次新解锁的成就。
  final List<AchievementUnlock> newAchievements;

  /// 本次总共该展示的经验（作答 + 目标奖励）。
  int get totalXp => xpEarned + goalBonus;

  AnswerResult copyWith({bool? favorited}) {
    return AnswerResult(
      sentenceId: sentenceId,
      isCorrect: isCorrect,
      sentenceEn: sentenceEn,
      validAnswers: validAnswers,
      translationZh: translationZh,
      ipa: ipa,
      explanation: explanation,
      imageUrl: imageUrl,
      favorited: favorited ?? this.favorited,
      todayDone: todayDone,
      todayGoal: todayGoal,
      xpEarned: xpEarned,
      goalBonus: goalBonus,
      newAchievements: newAchievements,
    );
  }

  factory AnswerResult.fromJson(Map<String, dynamic> json) {
    final valid = json['validAnswers'];
    final unlocked = json['newAchievements'];
    return AnswerResult(
      sentenceId: (json['sentenceId'] as num?)?.toInt() ?? 0,
      isCorrect: json['isCorrect'] as bool? ?? false,
      sentenceEn: json['sentenceEn'] as String? ?? '',
      validAnswers: valid is List ? valid.whereType<String>().toList() : const <String>[],
      translationZh: json['translationZh'] as String? ?? '',
      ipa: json['ipa'] as String?,
      explanation: json['explanation'] as String?,
      imageUrl: json['imageUrl'] as String?,
      favorited: json['favorited'] as bool? ?? false,
      todayDone: (json['todayDone'] as num?)?.toInt() ?? 0,
      todayGoal: (json['todayGoal'] as num?)?.toInt() ?? 0,
      xpEarned: (json['xpEarned'] as num?)?.toInt() ?? 0,
      goalBonus: (json['goalBonus'] as num?)?.toInt() ?? 0,
      newAchievements: unlocked is List
          ? unlocked
              .whereType<Map<String, dynamic>>()
              .map(AchievementUnlock.fromJson)
              .toList()
          : const <AchievementUnlock>[],
    );
  }
}

/// 新解锁的成就。
class AchievementUnlock {
  const AchievementUnlock({required this.code, required this.name});

  final String code;
  final String name;

  factory AchievementUnlock.fromJson(Map<String, dynamic> json) {
    return AchievementUnlock(
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
    );
  }
}
