/// 每日 Boss 模型（对应后端 /client/questions/boss）。
///
/// 题面**不含英文原句**（与刷题同一套防偷看口径）：答案只在提交后由
/// BossAnswerResult 下发。Boss 每天固定一题（服务端按日期确定性选取）。
library;

/// Boss 题目（题面）。
class BossQuestion {
  const BossQuestion({
    required this.sentenceId,
    required this.translationZh,
    required this.ipa,
    required this.imageUrl,
    required this.difficulty,
    required this.categoryName,
  });

  final int sentenceId;
  final String translationZh;
  final String? ipa;
  final String? imageUrl;
  final int difficulty;
  final String? categoryName;

  factory BossQuestion.fromJson(Map<String, dynamic> json) {
    return BossQuestion(
      sentenceId: (json['sentenceId'] as num?)?.toInt() ?? 0,
      translationZh: json['translationZh'] as String? ?? '',
      ipa: json['ipa'] as String?,
      imageUrl: json['imageUrl'] as String?,
      difficulty: (json['difficulty'] as num?)?.toInt() ?? 1,
      categoryName: json['categoryName'] as String?,
    );
  }
}

/// 今日 Boss 状态。
class BossToday {
  const BossToday({
    required this.date,
    required this.cleared,
    required this.bonusXp,
    required this.question,
  });

  /// 东八区日期（YYYY-MM-DD）
  final String date;

  /// 今天是否已通关
  final bool cleared;

  /// 通关额外经验
  final int bonusXp;

  /// 题目（池子为空为 null）
  final BossQuestion? question;

  factory BossToday.fromJson(Map<String, dynamic> json) {
    final question = json['question'];
    return BossToday(
      date: json['date'] as String? ?? '',
      cleared: json['cleared'] as bool? ?? false,
      bonusXp: (json['bonusXp'] as num?)?.toInt() ?? 0,
      question: question is Map
          ? BossQuestion.fromJson(question.map((key, value) => MapEntry(key.toString(), value)))
          : null,
    );
  }
}

/// Boss 作答结果（判分口径与刷题一致，额外带通关信息）。
class BossAnswerResult {
  const BossAnswerResult({
    required this.isCorrect,
    required this.sentenceEn,
    required this.translationZh,
    required this.ipa,
    required this.explanation,
    required this.xpEarned,
    required this.bossCleared,
    required this.bossBonus,
  });

  final bool isCorrect;

  /// 标准答案（提交后才下发）
  final String sentenceEn;
  final String translationZh;
  final String? ipa;
  final String? explanation;

  /// 本次获得的总经验（含通关奖励）
  final int xpEarned;

  /// 本次是否首次通关
  final bool bossCleared;

  /// 本次通关额外经验（0 = 未答对 / 今天已领过）
  final int bossBonus;

  factory BossAnswerResult.fromJson(Map<String, dynamic> json) {
    return BossAnswerResult(
      isCorrect: json['isCorrect'] as bool? ?? false,
      sentenceEn: json['sentenceEn'] as String? ?? '',
      translationZh: json['translationZh'] as String? ?? '',
      ipa: json['ipa'] as String?,
      explanation: json['explanation'] as String?,
      xpEarned: (json['xpEarned'] as num?)?.toInt() ?? 0,
      bossCleared: json['bossCleared'] as bool? ?? false,
      bossBonus: (json['bossBonus'] as num?)?.toInt() ?? 0,
    );
  }
}