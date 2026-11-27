/// 客户端用户资料。
///
/// 字段与后端 `ClientUserProfile` **一一对应**（见 api 的
/// `modules/client/auth/client-auth.service.ts`），也即与 Web 端
/// `client-web/app/types/index.ts` 的 `ClientUserProfile` 同构——
/// 三端共用一套契约，任一端加字段时另外两端要同步。
///
/// 刻意不引 `intl`：整个 App 只有「日期 + 千分位」两类格式化，
/// 用 Dart 内建能力手写更轻（少一个依赖、少一次包体积开销）。
library;

class UserProfile {
  const UserProfile({
    required this.id,
    required this.email,
    required this.nickname,
    required this.avatarUrl,
    required this.gender,
    required this.signature,
    required this.createdAt,
    required this.bgCardId,
    required this.bgCardTitle,
    required this.bgImageUrl,
    required this.emailReminder,
    required this.weeklyReportEmail,
    this.birthday,
  });

  final int id;
  final String email;

  /// 昵称（后端保证非空，缺省取邮箱前缀）。
  final String nickname;

  /// 头像 URL（未设置为 null，前端回退「取昵称首字符」）。
  final String? avatarUrl;

  /// 性别：male / female / secret。
  final String gender;

  /// 个性签名。
  final String? signature;

  /// 生日（YYYY-MM-DD，未设置 null）。
  final String? birthday;

  /// 每日邮件提醒：1 = 开启（当天未达标傍晚发提醒邮件），0 = 关闭。
  /// 与 Web 端 `emailReminder` 同字段、同口径；后端未返回时按 0（关闭）处理。
  final int emailReminder;

  /// 每周学习报告邮件：1 = 开启（每周一发上一完整周汇总），0 = 关闭。
  final int weeklyReportEmail;

  /// 注册时间（ISO 字符串）。
  final DateTime createdAt;

  /// 个人主页背景句签 id（0 = 未设置，用默认品牌渐变）。
  final int bgCardId;

  /// 背景句签标题（未设置为 null）。
  final String? bgCardTitle;

  /// 背景句签配图 URL（未设置 / 配图缺失为 null，前端回退渐变）。
  final String? bgImageUrl;

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: (json['id'] as num?)?.toInt() ?? 0,
      email: json['email'] as String? ?? '',
      nickname: json['nickname'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      gender: json['gender'] as String? ?? 'secret',
      signature: json['signature'] as String?,
      birthday: json['birthday'] as String?,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      bgCardId: (json['bgCardId'] as num?)?.toInt() ?? 0,
      bgCardTitle: json['bgCardTitle'] as String?,
      bgImageUrl: json['bgImageUrl'] as String?,
      emailReminder: (json['emailReminder'] as num?)?.toInt() ?? 0,
      weeklyReportEmail: (json['weeklyReportEmail'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'nickname': nickname,
      'avatarUrl': avatarUrl,
      'gender': gender,
      'signature': signature,
      'birthday': birthday,
      'createdAt': createdAt.toIso8601String(),
      'bgCardId': bgCardId,
      'bgCardTitle': bgCardTitle,
      'bgImageUrl': bgImageUrl,
      'emailReminder': emailReminder,
      'weeklyReportEmail': weeklyReportEmail,
    };
  }

  /// 性别中文文案。
  String get genderLabel {
    switch (gender) {
      case 'male':
        return '男';
      case 'female':
        return '女';
      default:
        return '保密';
    }
  }

  /// 注册时间中文文案（YYYY-MM-DD）。
  String get createdAtLabel {
    final local = createdAt.toLocal();
    final month = local.month.toString().padLeft(2, '0');
    final day = local.day.toString().padLeft(2, '0');
    return '${local.year}-$month-$day';
  }
}
