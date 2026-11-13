/// 用户资料编解码测试。
///
/// 这条链路是「登录成功 → 写安全存储 → 下次启动恢复」的关键，
/// 任一端字段漏写/写错都会导致重启后资料丢失（且很难在 UI 上发现）。
library;

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:client_android/api/models/user.dart';
import 'package:client_android/state/auth_controller.dart';

void main() {
  final json = <String, dynamic>{
    'id': 21,
    'email': 'lanyun@example.com',
    'nickname': 'lanyun',
    'avatarUrl': null,
    'gender': 'secret',
    'signature': '慢慢来',
    'birthday': null,
    'createdAt': '2026-10-20T08:00:00.000Z',
    'bgCardId': 0,
    'bgCardTitle': null,
    'bgImageUrl': null,
  };

  test('fromJson 解析后端字段', () {
    final profile = UserProfile.fromJson(json);

    expect(profile.id, 21);
    expect(profile.email, 'lanyun@example.com');
    expect(profile.nickname, 'lanyun');
    expect(profile.avatarUrl, isNull);
    expect(profile.genderLabel, '保密');
    expect(profile.bgCardId, 0);
  });

  test('fromJson 容忍缺字段（后端新增字段前的兼容）', () {
    final profile = UserProfile.fromJson(<String, dynamic>{'id': 3, 'email': 'a@b.com'});
    expect(profile.id, 3);
    expect(profile.nickname, '');
    expect(profile.genderLabel, '保密');
  });

  test('往返：encode → decode 保持字段一致', () {
    final profile = UserProfile.fromJson(json);
    final decoded = UserProfile.fromJson(
      jsonDecode(encodeProfile(profile)) as Map<String, dynamic>,
    );

    expect(decoded.id, profile.id);
    expect(decoded.email, profile.email);
    expect(decoded.nickname, profile.nickname);
    expect(decoded.gender, profile.gender);
    expect(decoded.signature, profile.signature);
    expect(decoded.bgCardId, profile.bgCardId);
    // 新增字段也要能安全往返（否则重启后提醒开关会丢）
    expect(decoded.emailReminder, profile.emailReminder);
  });

  test('日期格式化为本地日期', () {
    final profile = UserProfile.fromJson(json);
    // createdAt 是 UTC，转本地后按机器时区显示，只验证「形如 YYYY-MM-DD」
    expect(RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(profile.createdAtLabel), isTrue);
  });

  test('性别文案映射', () {
    expect(UserProfile.fromJson({...json, 'gender': 'male'}).genderLabel, '男');
    expect(UserProfile.fromJson({...json, 'gender': 'female'}).genderLabel, '女');
  });
}
