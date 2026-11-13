import 'package:flutter_test/flutter_test.dart';
import 'package:client_android/config/password_policy.dart';

/// 口令长度口径：前端只做前置提示与按钮禁用，后端仍是唯一权威。
void main() {
  group('口令长度口径', () {
    test('边界：下限与上限包含，越界拒绝', () {
      expect(isPasswordLengthValid('a' * (kPasswordMinLength - 1)), isFalse);
      expect(isPasswordLengthValid('a' * kPasswordMinLength), isTrue);
      expect(isPasswordLengthValid('a' * kPasswordMaxLength), isTrue);
      expect(isPasswordLengthValid('a' * (kPasswordMaxLength + 1)), isFalse);
    });

    test('提示文案与常量一致', () {
      expect(kPasswordHint, contains('$kPasswordMinLength'));
      expect(kPasswordHint, contains('$kPasswordMaxLength'));
      expect(kPasswordHint, contains('字母'));
    });
  });
}
