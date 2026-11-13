/// 口令长度边界（客户端展示与前置校验用）。
///
/// 权威口径在后端 `api/src/common/auth/password-policy.ts`
/// （可用 `PASSWORD_MIN_LENGTH` / `PASSWORD_MAX_LENGTH` 调整）。
/// 这里只是固定提示口径，真正判定始终在后端。
library;

/// 最小长度。
const int kPasswordMinLength = 8;

/// 最大长度。
const int kPasswordMaxLength = 20;

/// 统一提示文案（注册 / 改密共用，避免各写一份后走样）。
const String kPasswordHint = '$kPasswordMinLength~$kPasswordMaxLength 位，需同时包含字母和数字';

/// 纯长度判定（复杂度由后端判定，客户端不重复一套正则）。
bool isPasswordLengthValid(String value) =>
    value.length >= kPasswordMinLength && value.length <= kPasswordMaxLength;
