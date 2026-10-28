import { describe, expect, it } from 'vitest';

import { isPasswordLengthValid, PASSWORD_HINT, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '~/utils/password';

/**
 * 口令长度口径。
 *
 * 后端 `common/auth/password-policy.ts` 是唯一权威；前端这组常量只用于
 * 「提前禁用按钮 + 提示文案」。曾出现前端写 6~32、后端要 8~20，
 * 用户输 6 位被拒却看到「6~32 位」的矛盾提示（2026-10-28 一并统一）。
 */
describe('口令长度口径', () => {
  it('长度边界：下限与上限包含，越界拒绝', () => {
    expect(isPasswordLengthValid('a'.repeat(PASSWORD_MIN_LENGTH - 1))).toBe(false);
    expect(isPasswordLengthValid('a'.repeat(PASSWORD_MIN_LENGTH))).toBe(true);
    expect(isPasswordLengthValid('a'.repeat(PASSWORD_MAX_LENGTH))).toBe(true);
    expect(isPasswordLengthValid('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe(false);
  });

  it('提示文案里的数字与常量一致（改边界时不会漏改文案）', () => {
    expect(PASSWORD_HINT).toContain(String(PASSWORD_MIN_LENGTH));
    expect(PASSWORD_HINT).toContain(String(PASSWORD_MAX_LENGTH));
    expect(PASSWORD_HINT).toContain('字母');
  });
});
