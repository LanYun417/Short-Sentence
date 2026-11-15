/// 用户投稿（UGC）模型（对应后端 /client/submissions）。
library;

/// 我的投稿条目。
class SubmissionItem {
  const SubmissionItem({
    required this.id,
    required this.sentenceEn,
    required this.translationZh,
    required this.note,
    required this.status,
    required this.reviewNote,
    required this.createdAt,
  });

  final int id;
  final String sentenceEn;
  final String translationZh;
  final String? note;

  /// pending 待审核 / approved 已通过 / rejected 已驳回
  final String status;

  /// 审核备注（驳回原因）
  final String? reviewNote;
  final String createdAt;

  factory SubmissionItem.fromJson(Map<String, dynamic> json) {
    return SubmissionItem(
      id: (json['id'] as num?)?.toInt() ?? 0,
      sentenceEn: json['sentenceEn'] as String? ?? '',
      translationZh: json['translationZh'] as String? ?? '',
      note: json['note'] as String?,
      status: json['status'] as String? ?? 'pending',
      reviewNote: json['reviewNote'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }
}

/// 投稿精选条目（带作者昵称）。
class FeaturedSubmission {
  const FeaturedSubmission({
    required this.id,
    required this.sentenceEn,
    required this.translationZh,
    required this.note,
    required this.author,
  });

  final int id;
  final String sentenceEn;
  final String translationZh;
  final String? note;
  final String author;

  factory FeaturedSubmission.fromJson(Map<String, dynamic> json) {
    return FeaturedSubmission(
      id: (json['id'] as num?)?.toInt() ?? 0,
      sentenceEn: json['sentenceEn'] as String? ?? '',
      translationZh: json['translationZh'] as String? ?? '',
      note: json['note'] as String?,
      author: json['author'] as String? ?? '匿名用户',
    );
  }
}