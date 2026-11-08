/// 句子接龙视图（GET /client/chains、GET /client/chains/{id}）。
///
/// 与后端 `ChainService` 各 View 同构。作者只以匿名化名出现（服务端按
/// userId + topicId 派生，同一主题下恒定），App 端拿不到也画不出真实身份。
class ChainTopic {
  const ChainTopic({
    required this.id,
    required this.title,
    required this.starterEn,
    required this.promptZh,
    required this.entryCount,
    required this.myEntryCount,
  });

  final int id;
  final String title;

  /// 起始句（英文引子）
  final String starterEn;

  /// 中文提示
  final String promptZh;
  final int entryCount;
  final int myEntryCount;

  factory ChainTopic.fromJson(Map<String, dynamic> json) {
    return ChainTopic(
      id: json['id'] as int? ?? 0,
      title: json['title'] as String? ?? '',
      starterEn: json['starterEn'] as String? ?? '',
      promptZh: json['promptZh'] as String? ?? '',
      entryCount: json['entryCount'] as int? ?? 0,
      myEntryCount: json['myEntryCount'] as int? ?? 0,
    );
  }
}

class ChainEntry {
  const ChainEntry({
    required this.id,
    required this.alias,
    required this.contentEn,
    required this.contentZh,
    required this.likeCount,
    required this.liked,
    required this.mine,
    required this.createdAt,
  });

  final int id;
  final String alias;
  final String contentEn;
  final String? contentZh;
  final int likeCount;
  final bool liked;
  final bool mine;
  final String createdAt;

  ChainEntry copyWith({int? likeCount, bool? liked}) {
    return ChainEntry(
      id: id,
      alias: alias,
      contentEn: contentEn,
      contentZh: contentZh,
      likeCount: likeCount ?? this.likeCount,
      liked: liked ?? this.liked,
      mine: mine,
      createdAt: createdAt,
    );
  }

  factory ChainEntry.fromJson(Map<String, dynamic> json) {
    return ChainEntry(
      id: json['id'] as int? ?? 0,
      alias: json['alias'] as String? ?? '过客',
      contentEn: json['contentEn'] as String? ?? '',
      contentZh: json['contentZh'] as String?,
      likeCount: json['likeCount'] as int? ?? 0,
      liked: json['liked'] as bool? ?? false,
      mine: json['mine'] as bool? ?? false,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }
}

class ChainTopicDetail {
  const ChainTopicDetail({
    required this.topic,
    required this.entries,
    required this.remainingToday,
    required this.dailyLimit,
  });

  final ChainTopic topic;
  final List<ChainEntry> entries;
  final int remainingToday;
  final int dailyLimit;

  factory ChainTopicDetail.fromJson(Map<String, dynamic> json) {
    return ChainTopicDetail(
      topic: ChainTopic.fromJson((json['topic'] as Map<String, dynamic>?) ?? <String, dynamic>{}),
      entries: (json['entries'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(ChainEntry.fromJson)
              .toList() ??
          const <ChainEntry>[],
      remainingToday: json['remainingToday'] as int? ?? 0,
      dailyLimit: json['dailyLimit'] as int? ?? 3,
    );
  }
}
