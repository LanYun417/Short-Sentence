/// 弱连接学习小队视图（GET /client/team/my、POST /client/team/match）。
///
/// 与后端 `TeamService.TeamView` 同构。队员之间只暴露昵称与今日打卡状态，
/// 不做好友、不做聊天，前端只负责把「还差谁」的提醒画出来。
class TeamView {
  const TeamView({
    required this.id,
    required this.name,
    required this.code,
    required this.source,
    required this.isOwner,
    required this.streak,
    required this.memberCount,
    required this.maxMembers,
    required this.doneCount,
    required this.todayFull,
    required this.myCheckedIn,
    required this.hint,
    required this.hintTone,
    required this.members,
  });

  final int id;
  final String name;

  /// 组队码（凭码加入）
  final String code;

  /// random 随机匹配 / create 自建
  final String source;

  /// 我是否为队长（自建队伍的创建者）
  final bool isOwner;
  final int streak;
  final int memberCount;
  final int maxMembers;
  final int doneCount;
  final bool todayFull;
  final bool myCheckedIn;
  final String hint;

  /// info / urge / success
  final String hintTone;
  final List<TeamMemberView> members;

  factory TeamView.fromJson(Map<String, dynamic> json) {
    return TeamView(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: json['name'] as String? ?? '',
      code: json['code'] as String? ?? '',
      source: json['source'] as String? ?? 'random',
      isOwner: json['isOwner'] as bool? ?? false,
      streak: (json['streak'] as num?)?.toInt() ?? 0,
      memberCount: (json['memberCount'] as num?)?.toInt() ?? 0,
      maxMembers: (json['maxMembers'] as num?)?.toInt() ?? 10,
      doneCount: (json['doneCount'] as num?)?.toInt() ?? 0,
      todayFull: json['todayFull'] as bool? ?? false,
      myCheckedIn: json['myCheckedIn'] as bool? ?? false,
      hint: json['hint'] as String? ?? '',
      hintTone: json['hintTone'] as String? ?? 'info',
      members: (json['members'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(TeamMemberView.fromJson)
              .toList() ??
          const <TeamMemberView>[],
    );
  }
}

/* ------------------------------ 群聊 ------------------------------ */

/// 引用的消息。
class TeamMessageQuote {
  const TeamMessageQuote({
    required this.id,
    required this.nickname,
    required this.content,
    required this.status,
  });

  final int id;
  final String nickname;
  final String content;
  final String status;

  factory TeamMessageQuote.fromJson(Map<String, dynamic> json) {
    return TeamMessageQuote(
      id: (json['id'] as num?)?.toInt() ?? 0,
      nickname: json['nickname'] as String? ?? '队友',
      content: json['content'] as String? ?? '',
      status: json['status'] as String? ?? 'normal',
    );
  }
}

/// 一条小队群聊消息。
class TeamMessage {
  const TeamMessage({
    required this.id,
    required this.userId,
    required this.nickname,
    required this.avatarFileId,
    required this.isMe,
    required this.content,
    required this.status,
    required this.canRecall,
    required this.quote,
    required this.createdAt,
  });

  final int id;
  final int userId;
  final String nickname;
  final int avatarFileId;
  final bool isMe;
  final String content;

  /// normal / recalled / hidden
  final String status;
  final bool canRecall;
  final TeamMessageQuote? quote;
  final DateTime createdAt;

  factory TeamMessage.fromJson(Map<String, dynamic> json) {
    final quote = json['quote'];
    return TeamMessage(
      id: (json['id'] as num?)?.toInt() ?? 0,
      userId: (json['userId'] as num?)?.toInt() ?? 0,
      nickname: json['nickname'] as String? ?? '队友',
      avatarFileId: (json['avatarFileId'] as num?)?.toInt() ?? 0,
      isMe: json['isMe'] as bool? ?? false,
      content: json['content'] as String? ?? '',
      status: json['status'] as String? ?? 'normal',
      canRecall: json['canRecall'] as bool? ?? false,
      quote: quote is Map<String, dynamic> ? TeamMessageQuote.fromJson(quote) : null,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    );
  }

  TeamMessage copyWith({String? content, String? status, bool? canRecall}) {
    return TeamMessage(
      id: id,
      userId: userId,
      nickname: nickname,
      avatarFileId: avatarFileId,
      isMe: isMe,
      content: content ?? this.content,
      status: status ?? this.status,
      canRecall: canRecall ?? this.canRecall,
      quote: quote,
      createdAt: createdAt,
    );
  }
}

/// 群聊消息分页。
class TeamMessagePage {
  const TeamMessagePage({required this.list, required this.hasMore});

  final List<TeamMessage> list;
  final bool hasMore;

  factory TeamMessagePage.fromJson(Map<String, dynamic> json) {
    return TeamMessagePage(
      list: (json['list'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(TeamMessage.fromJson)
              .toList() ??
          const <TeamMessage>[],
      hasMore: json['hasMore'] as bool? ?? false,
    );
  }
}

class TeamMemberView {
  const TeamMemberView({
    required this.userId,
    required this.nickname,
    required this.avatarFileId,
    required this.xp,
    required this.checkedIn,
    required this.isMe,
  });

  final int userId;
  final String nickname;
  final int avatarFileId;
  final int xp;
  final bool checkedIn;
  final bool isMe;

  factory TeamMemberView.fromJson(Map<String, dynamic> json) {
    return TeamMemberView(
      userId: json['userId'] as int? ?? 0,
      nickname: json['nickname'] as String? ?? '队友',
      avatarFileId: json['avatarFileId'] as int? ?? 0,
      xp: json['xp'] as int? ?? 0,
      checkedIn: json['checkedIn'] as bool? ?? false,
      isMe: json['isMe'] as bool? ?? false,
    );
  }
}
