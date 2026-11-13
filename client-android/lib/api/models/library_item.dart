/// 学习库模型：收藏夹 / 复习池 / 历史记录共用条目。
///
/// 与后端 `SentenceLibraryItem` 逐字段对应（见 api 的
/// `modules/client/questions/questions.service.ts`）。
library;

/// 收藏夹 / 复习池 / 历史记录条目。
class SentenceLibraryItem {
  const SentenceLibraryItem({
    required this.sentenceId,
    required this.sentenceEn,
    required this.translationZh,
    required this.ipa,
    required this.imageUrl,
    required this.categoryName,
    required this.difficulty,
    required this.createdAt,
    this.reviewLevel,
    this.nextReviewAt,
    this.isCorrect,
    this.userAnswer,
  });

  final int sentenceId;
  final String sentenceEn;
  final String translationZh;
  final String? ipa;
  final String? imageUrl;
  final String? categoryName;
  final int difficulty;

  /// 收藏时间（收藏夹）/ 最近作答时间（复习池）。
  final DateTime createdAt;

  /// 复习池专用：连续答对等级。
  final int? reviewLevel;

  /// 复习池专用：下次复习时间。
  final DateTime? nextReviewAt;

  /// 历史记录专用：本次作答是否正确。
  final bool? isCorrect;

  /// 历史记录专用：用户本次的实际作答。
  final String? userAnswer;

  factory SentenceLibraryItem.fromJson(Map<String, dynamic> json) {
    return SentenceLibraryItem(
      sentenceId: (json['sentenceId'] as num?)?.toInt() ?? 0,
      sentenceEn: json['sentenceEn'] as String? ?? '',
      translationZh: json['translationZh'] as String? ?? '',
      ipa: json['ipa'] as String?,
      imageUrl: json['imageUrl'] as String?,
      categoryName: json['categoryName'] as String?,
      difficulty: (json['difficulty'] as num?)?.toInt() ?? 1,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      reviewLevel: (json['reviewLevel'] as num?)?.toInt(),
      nextReviewAt: DateTime.tryParse(json['nextReviewAt'] as String? ?? ''),
      isCorrect: json['isCorrect'] as bool?,
      userAnswer: json['userAnswer'] as String?,
    );
  }

  String get difficultyLabel => switch (difficulty) {
        1 => '基础',
        2 => '进阶',
        3 => '挑战',
        _ => '基础',
      };
}

/// 分页结果（后端 `PageResult<T>`）。
class PageResult<T> {
  const PageResult({required this.list, required this.total});

  final List<T> list;
  final int total;

  bool get hasMore => list.length < total;
}
