/// 客户端产品反馈模型（用户提交 + 我的反馈）。
///
/// 与后端 `FeedbackService.ClientFeedbackItem` 逐字段对应
/// （见 api 的 `modules/client/feedback/feedback.service.ts`）。
///
/// 注意：后端把 `reply`（下发用户端）与 `handleNote`（内部备注）分开，
/// 这条模型**只映射会下发的字段**——内部备注绝不下发，也不进 App 内存。
library;

/// 反馈类型（与后端白名单一致）。
enum FeedbackType {
  bug('bug', '使用异常'),
  question('question', '内容问题'),
  feature('feature', '功能建议'),
  experience('experience', '体验建议');

  const FeedbackType(this.value, this.label);

  final String value;
  final String label;
}

/// 处理状态（0 待处理 / 1 已处理 / 2 已忽略）。
enum FeedbackStatus {
  pending(0, '待处理'),
  handled(1, '已处理'),
  ignored(2, '已忽略');

  const FeedbackStatus(this.value, this.label);

  final int value;
  final String label;
}

/// 反馈条目。
class ClientFeedbackItem {
  const ClientFeedbackItem({
    required this.id,
    required this.type,
    required this.content,
    required this.contact,
    required this.platform,
    required this.status,
    required this.reply,
    required this.createdAt,
    required this.handledAt,
  });

  final int id;
  final String type;
  final String content;
  final String? contact;
  final String? platform;
  final int status;
  final String? reply;
  final DateTime? createdAt;
  final DateTime? handledAt;

  factory ClientFeedbackItem.fromJson(Map<String, dynamic> json) {
    return ClientFeedbackItem(
      id: (json['id'] as num?)?.toInt() ?? 0,
      type: json['type'] as String? ?? 'feature',
      content: json['content'] as String? ?? '',
      contact: json['contact'] as String?,
      platform: json['platform'] as String?,
      status: (json['status'] as num?)?.toInt() ?? 0,
      reply: json['reply'] as String?,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
      handledAt: DateTime.tryParse(json['handledAt'] as String? ?? ''),
    );
  }
}
