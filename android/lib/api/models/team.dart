/// 弱连接学习小队视图（GET /client/team/my、POST /client/team/match）。
///
/// 与后端 `TeamService.TeamView` 同构。队员之间只暴露昵称与今日打卡状态，
/// 不做好友、不做聊天，前端只负责把「还差谁」的提醒画出来。
class TeamView {
  const TeamView({
    required this.id,
    required this.name,
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
      id: json['id'] as int? ?? 0,
      name: json['name'] as String? ?? '',
      streak: json['streak'] as int? ?? 0,
      memberCount: json['memberCount'] as int? ?? 0,
      maxMembers: json['maxMembers'] as int? ?? 4,
      doneCount: json['doneCount'] as int? ?? 0,
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
