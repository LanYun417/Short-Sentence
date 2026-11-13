/// 邮箱脱敏展示（如 `1****3@qq.com`）。
///
/// 仅用于「验证码发到哪个邮箱」的提示文案；完整邮箱仍由 /me 返回。
/// 本地部分长度 ≤2 时不露任何字符，非法格式（无 @）原样返回。
String maskEmail(String email) {
  final at = email.lastIndexOf('@');
  if (at <= 0 || at == email.length - 1) {
    return email;
  }
  final local = email.substring(0, at);
  final domain = email.substring(at);
  if (local.length <= 2) {
    return '****$domain';
  }
  return '${local[0]}****${local[local.length - 1]}$domain';
}
