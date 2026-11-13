/**
 * 邮箱脱敏展示（如 `1****3@qq.com`）。
 *
 * 仅用于「验证码发送到哪个邮箱」这类提示文案——完整邮箱仍由 /me 返回，
 * 这里只是避免把完整地址糊在表单上。本地部分长度 ≤2 时不露任何字符，
 * 非法格式（无 @）原样返回。
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) {
    return email;
  }
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) {
    return `****${domain}`;
  }
  return `${local[0]}****${local[local.length - 1]}${domain}`;
}
