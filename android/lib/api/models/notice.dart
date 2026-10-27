/// 客户端公告模型（消息中心）。
///
/// 与后端 `ClientNoticeService.ClientNoticeItem` 逐字段对应
/// （见 api 的 `modules/client/notice/client-notice.service.ts`）。
///
/// `isRead` 是**按当前用户**计算的派生值（公告本身是广播的，只有已读记录按人存），
/// 所以模型保持不可变，界面上「刚点开」的乐观标记由调用方维护一个本地 id 集合。
library;

/// 公告条目。
class ClientNoticeItem {
  const ClientNoticeItem({
    required this.id,
    required this.title,
    required this.content,
    required this.noticeType,
    required this.link,
    required this.isRead,
    required this.pinned,
    required this.publishedAt,
  });

  final int id;
  final String title;
  final String content;

  /// 1 系统通知 / 2 公告 / 3 活动。
  final int noticeType;

  /// 点击跳转的客户端路由（空 = 不跳转）。
  final String? link;

  /// 是否已读（服务端口径）。
  final bool isRead;

  /// 是否置顶。
  final bool pinned;

  /// 发布时间（未发布为空）。
  final DateTime? publishedAt;

  factory ClientNoticeItem.fromJson(Map<String, dynamic> json) {
    return ClientNoticeItem(
      id: (json['id'] as num?)?.toInt() ?? 0,
      title: json['title'] as String? ?? '',
      content: json['content'] as String? ?? '',
      noticeType: (json['noticeType'] as num?)?.toInt() ?? 2,
      link: json['link'] as String?,
      isRead: (json['isRead'] as num?)?.toInt() == 1,
      pinned: (json['pinned'] as num?)?.toInt() == 1,
      publishedAt: DateTime.tryParse(json['publishedAt'] as String? ?? ''),
    );
  }
}
