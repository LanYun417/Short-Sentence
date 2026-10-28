/**
 * 口令长度边界（客户端展示与前置校验用）。
 *
 * 权威口径在后端 `api/src/common/auth/password-policy.ts`（可用
 * `PASSWORD_MIN_LENGTH` / `PASSWORD_MAX_LENGTH` / `PASSWORD_REQUIRE_COMPLEXITY`
 * 调整）。这里只是「固定提示口径」——后端一旦改配置，前端文案需同步，
 * 但即便不同步也只是提示偏差：真正的判定始终在后端。
 */
export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_MAX_LENGTH = 20;

/** 统一提示文案，避免注册 / 改密两处各写一份后走样。 */
export const PASSWORD_HINT = `${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH} 位，需同时包含字母和数字`;

/** 纯长度判定（复杂度由后端判定，前端不重复一套正则）。 */
export function isPasswordLengthValid(value: string): boolean {
  return value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH;
}
